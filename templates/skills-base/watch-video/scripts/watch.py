#!/usr/bin/env python3
"""watch.py: give Jarvis eyes and ears on a video (URL or local file), local first.

Part of the Jarvis `watch-video` skill (templates/skills-base/watch-video/SKILL.md).
Own lean rewrite inspired by bradautomates/claude-video ("watch", MIT License,
https://github.com/bradautomates/claude-video). No code copied; same idea: captions
first, timestamped frames only when the question is visual, Whisper when there are
no captions. Differences on purpose: never installs anything, no hooks, no cookies
or logins, no cloud engine, strict URL rules, temp folder always cleaned.

Run it with `python3 -I` (isolated mode: no imports from the current folder).

  python3 -I watch.py [--detail transcript|balanced|visual] [--start MM:SS] [--end MM:SS]
                      [--max-frames N] [--lang es] [--json] [--delete-input] -- SOURCE
  (--detail defaults to transcript: frames only when the question is visual)
  python3 -I watch.py --cleanup /tmp/jarvis-watch-XXXX

Frames stay in a jarvis-watch-* temp folder (outside the workspace) only until Jarvis has
read them; the skill then runs --cleanup. Folders older than 2 hours are swept on every run.

Env (names only; values live in the Jarvis .env):
  JARVIS_WHISPER_MODEL  GGML model for whisper.cpp (default: the first of models/ggml-large-v3-turbo-q5_0.bin,
                        ggml-small.bin, ggml-base-q5_1.bin that exists)
  JARVIS_DIR            Jarvis folder (default: current directory)
  JARVIS_AUDIT_LOG      audit file (default $JARVIS_DIR/logs/audit.jsonl, only if logs/ exists)

Exit codes: 0 ok · 2 refused input · 3 missing tool · 4 processing failure.
"""

import argparse
import datetime
import glob
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse

MAX_FRAMES_CAP = 100
FRAME_BOX = 512          # frames fit in 512x512
MAX_FPS = 2.0
TMP_PREFIX = "jarvis-watch-"
STALE_SECONDS = 2 * 3600
URL_MAX_DOWNLOAD = "500M"
URL_MAX_VIDEO_SECONDS = 3600   # longer URLs need --start/--end
LOCAL_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".ogg", ".oga", ".opus", ".mp3",
             ".m4a", ".wav", ".aiff", ".aif"}
LANG = ["es"]   # set from --lang in main()
TIMEOUT = 900


class Refused(Exception):
    pass


class Missing(Exception):
    pass


def fail(code, msg):
    print("watch-video: " + msg, file=sys.stderr)
    sys.exit(code)


def load_dotenv(names=("JARVIS_WHISPER_MODEL", "JARVIS_STT_LANG")):
    """Claude Code's Bash tool doesn't load .env: read only these names from $JARVIS_DIR/.env
    (plain NAME=value lines, never executed) when they aren't already in the environment."""
    path = os.path.join(os.environ.get("JARVIS_DIR", "."), ".env")
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                key, sep, val = line.strip().partition("=")
                if sep and key in names and not os.environ.get(key):
                    os.environ[key] = val.strip().strip("\"'")
    except OSError:
        pass


def need(tool, hint):
    path = shutil.which(tool)
    if not path:
        raise Missing("falta %s. Instálalo tú con: %s" % (tool, hint))
    return path


def run(cmd, timeout=TIMEOUT, check=True):
    """Always a list, never a shell."""
    p = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, timeout=timeout, text=True)
    if check and p.returncode != 0:
        tail = (p.stderr or "").strip().splitlines()[-2:]
        raise RuntimeError("%s falló: %s" % (os.path.basename(cmd[0]), " | ".join(tail)))
    return p


def parse_ts(value):
    if value is None:
        return None
    if not re.fullmatch(r"\d{1,3}(:\d{1,2}){0,2}(\.\d+)?", value):
        raise Refused("tiempo inválido: %r (usa MM:SS o HH:MM:SS)" % value)
    secs = 0.0
    for part in value.split(":"):
        secs = secs * 60 + float(part)
    return secs


def fmt_ts(secs):
    secs = int(round(secs))
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    return "%d:%02d:%02d" % (h, m, s) if h else "%02d:%02d" % (m, s)


# ---------------------------------------------------------------- source validation
def check_url(url):
    """http(s) only, no credentials, standard ports, every resolved address public."""
    if url.startswith("-"):
        raise Refused("una fuente que empieza con '-' se rechaza")
    if any(c in url for c in "\r\n\t ") or len(url) > 2048:
        raise Refused("URL con espacios o demasiado larga")
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise Refused("solo se aceptan enlaces http(s), no %r" % (parts.scheme or "?"))
    if "@" in parts.netloc:
        raise Refused("URL con usuario o contraseña: rechazada")
    host = parts.hostname
    if not host:
        raise Refused("URL sin servidor")
    try:
        port = parts.port
    except ValueError:
        raise Refused("puerto inválido")
    if port not in (None, 80, 443):
        raise Refused("solo puertos estándar (80/443)")
    try:
        literal = ipaddress.ip_address(host)
        addrs = [literal]
    except ValueError:
        if host.lower() in ("localhost",) or host.lower().endswith((".local", ".localhost", ".internal")):
            raise Refused("servidor local o interno: rechazado")
        try:
            infos = socket.getaddrinfo(host, port or 443, proto=socket.IPPROTO_TCP)
        except socket.gaierror:
            raise Refused("no pude resolver %s" % host)
        addrs = [ipaddress.ip_address(i[4][0].split("%")[0]) for i in infos]
    for a in addrs:
        mapped = getattr(a, "ipv4_mapped", None)
        a = mapped or a
        if not a.is_global or a.is_private or a.is_loopback or a.is_link_local \
                or a.is_multicast or a.is_reserved or a.is_unspecified:
            raise Refused("dirección privada, local o reservada (%s): rechazada" % a)
    return url


def sniff_media(path):
    """Content allowlist by magic bytes, before ffmpeg sees the file: MP4/MOV, Matroska/WebM,
    Ogg, MP3, WAV, AIFF, FLAC, AAC. A playlist, script or archive renamed to .mp4 is refused."""
    with open(path, "rb") as fh:
        head = fh.read(16)
    ok = (head[4:8] in (b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip")
          or head.startswith((b"\x1a\x45\xdf\xa3", b"OggS", b"ID3", b"fLaC"))
          or (head[:4] == b"RIFF" and head[8:12] == b"WAVE")
          or (head[:4] == b"FORM" and head[8:12] in (b"AIFF", b"AIFC"))
          or (len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0))  # MP3/AAC frame sync
    if not ok:
        raise Refused("el contenido no es audio ni video conocido (¿lista de reproducción o archivo renombrado?)")


def check_local(path):
    if path.startswith("-"):
        raise Refused("una fuente que empieza con '-' se rechaza")
    if not os.path.isfile(path) or os.path.islink(path):
        raise Refused("no existe o no es un archivo normal: %s" % path)
    ext = os.path.splitext(path)[1].lower()
    if ext not in LOCAL_EXT:
        raise Refused("tipo de archivo no permitido (%s)" % (ext or "sin extensión"))
    sniff_media(path)
    return os.path.abspath(path)


# ---------------------------------------------------------------- temp folders
def sweep_stale():
    base = tempfile.gettempdir()
    now = time.time()
    for d in glob.glob(os.path.join(base, TMP_PREFIX + "*")):
        try:
            if os.path.isdir(d) and not os.path.islink(d) and now - os.path.getmtime(d) > STALE_SECONDS:
                shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass


def cleanup(path):
    real = os.path.realpath(path)
    base = os.path.realpath(tempfile.gettempdir())
    if os.path.dirname(real) != base or not os.path.basename(real).startswith(TMP_PREFIX):
        fail(2, "--cleanup solo borra carpetas %s* del directorio temporal" % TMP_PREFIX)
    shutil.rmtree(real, ignore_errors=True)
    print("Carpeta temporal borrada: %s" % real)


# ---------------------------------------------------------------- media helpers
def probe(path):
    ffprobe = need("ffprobe", "brew install ffmpeg")
    p = run([ffprobe, "-v", "error", "-protocol_whitelist", "file",
             "-show_entries", "format=duration:stream=codec_type",
             "-of", "json", "file:" + path], timeout=60)
    data = json.loads(p.stdout or "{}")
    dur = float((data.get("format") or {}).get("duration") or 0)
    kinds = {s.get("codec_type") for s in data.get("streams", [])}
    return dur, "video" in kinds, "audio" in kinds


def vtt_to_text(vtt_path, offset=0.0):
    """VTT -> 'MM:SS text' lines, rolling-caption duplicates removed."""
    out, last, stamp = [], "", None
    cue = re.compile(r"^(\d+:)?\d{2}:\d{2}[.,]\d{3}\s+-->")
    with open(vtt_path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")):
                continue
            if cue.match(line):
                stamp = parse_ts(line.split("-->")[0].strip().replace(",", ".").split(".")[0])
                continue
            text = re.sub(r"<[^>]+>", "", line).strip()
            if not text or text == last or (out and out[-1].endswith(text)):
                continue
            last = text
            out.append("%s %s" % (fmt_ts((stamp or 0) + offset), text))
    return "\n".join(out)


def whisper(wav_dir, wav, lang, offset=0.0):
    cli = need("whisper-cli", "brew install whisper.cpp")
    model = os.environ.get("JARVIS_WHISPER_MODEL")
    if not model:  # .env is unreadable inside the Claude Code sandbox: take the pinned models in order
        mdir = os.path.join(os.environ.get("JARVIS_DIR", "."), "models")
        cands = [os.path.join(mdir, m) for m in
                 ("ggml-large-v3-turbo-q5_0.bin", "ggml-small.bin", "ggml-base-q5_1.bin")]
        model = next((c for c in cands if os.path.isfile(c)), cands[0])
    if not os.path.isfile(model):
        raise Missing("falta el modelo de Whisper en %s (ver RUNBOOK.md § Medios)" % model)
    base = os.path.join(wav_dir, "speech")
    args = ["-m", model, "-l", lang, "-np", "-ovtt", "-of", base, "-f", wav]
    if run([cli] + args, check=False).returncode != 0:
        run([cli, "-ng"] + args)  # the Claude Code sandbox blocks Metal (GPU): retry once on the CPU
    return vtt_to_text(base + ".vtt", offset)


def extract_audio(ffmpeg, src, dst, start, end):
    cmd = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file"]
    if start:
        cmd += ["-ss", str(start)]
    if end:
        cmd += ["-to", str(end)]
    cmd += ["-i", "file:" + src, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", dst]
    run(cmd)


def extract_frames(ffmpeg, src, out_dir, start, end, offset, duration, detail, max_frames):
    span = max(1.0, min(end or duration, duration) - (start or 0))
    per = 6.0 if detail == "balanced" else 2.0          # seconds between frames
    target = min(max_frames, max(8, int(round(span / per))))
    fps = min(MAX_FPS, target / span)
    vf = ("fps=%.6f,mpdecimate,scale=w='min(%d,iw)':h='min(%d,ih)':"
          "force_original_aspect_ratio=decrease" % (fps, FRAME_BOX, FRAME_BOX))
    cmd = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file"]
    if start:
        cmd += ["-ss", str(start)]
    if end:
        cmd += ["-to", str(end)]
    cmd += ["-i", "file:" + src, "-an", "-vf", vf, "-fps_mode", "passthrough",
            "-frame_pts", "1", "-frames:v", str(target), "-q:v", "5",
            os.path.join(out_dir, "f_%08d.jpg")]
    run(cmd)
    frames = []
    for f in sorted(glob.glob(os.path.join(out_dir, "f_*.jpg"))):
        pts = int(re.search(r"f_(\d+)\.jpg$", f).group(1))
        t = offset + pts / fps
        new = os.path.join(out_dir, "t%06d.jpg" % int(round(t)))
        if os.path.exists(new):
            os.remove(f)
            continue
        os.rename(f, new)
        frames.append({"t": fmt_ts(t), "seconds": round(t, 1), "path": new})
    if len(frames) > max_frames:                       # even subsample, never above the cap
        step = len(frames) / float(max_frames)
        keep = {int(i * step) for i in range(max_frames)}
        for i, fr in enumerate(frames):
            if i not in keep:
                os.remove(fr["path"])
        frames = [fr for i, fr in enumerate(frames) if i in keep]
    return frames


# ---------------------------------------------------------------- URL path (yt-dlp)
def ytdlp_base(tmp):
    ytdlp = need("yt-dlp", "brew install yt-dlp (y mantenlo al día con brew upgrade yt-dlp)")
    return [ytdlp, "--ignore-config", "--no-plugin-dirs", "--no-cookies", "--no-playlist",
            "--no-progress", "--quiet", "--no-warnings", "--socket-timeout", "30",
            "--match-filters", "!is_live", "--restrict-filenames",
            "-P", tmp, "-o", "src.%(ext)s"]


def pick_caption(raw, lang):
    """Manual subtitles first, then the auto captions in the spoken language (never a
    machine translation chain, which costs one request per language)."""
    manual = raw.get("subtitles") or {}
    auto = raw.get("automatic_captions") or {}
    for want in (lang, "es", "en"):
        for key in sorted(manual):
            if key == want or key.startswith(want + "-"):
                return key
    spoken = (raw.get("language") or "").split("-")[0]
    for key in (spoken + "-orig", lang + "-orig", spoken, lang):
        if key and key in auto:
            return key
    origs = sorted(k for k in auto if k.endswith("-orig"))
    return origs[0] if origs else None


def url_captions(tmp, url):
    run(ytdlp_base(tmp) + ["--skip-download", "--write-info-json", "--", url], timeout=180)
    files = glob.glob(os.path.join(tmp, "src*.info.json"))
    if not files:
        raise RuntimeError("yt-dlp no pudo leer el video")
    with open(files[0], encoding="utf-8") as fh:
        raw = json.load(fh)
    info = {"title": raw.get("title"), "uploader": raw.get("uploader"),
            "duration": raw.get("duration"), "webpage_url": raw.get("webpage_url")}
    text = ""
    key = pick_caption(raw, LANG[0])
    if key:
        # Reuse the metadata already fetched (no second page load); one subtitle request only.
        run(ytdlp_base(tmp) + ["--load-info-json", files[0], "--skip-download",
                               "--write-subs", "--write-auto-subs",
                               "--sub-langs", "^%s$" % re.escape(key), "--sub-format", "vtt"],
            timeout=180, check=False)
        subs = glob.glob(os.path.join(tmp, "src*.vtt"))
        if subs:
            text = vtt_to_text(subs[0])
        for f in subs:
            os.remove(f)
    for f in files:
        os.remove(f)
    return info, text


def url_download(tmp, url, start, end, audio_only):
    fmt = "ba/b" if audio_only else "bv*[height<=480]+ba/b[height<=480]/wv*+ba/w"
    cmd = ytdlp_base(tmp) + ["-f", fmt, "--max-filesize", URL_MAX_DOWNLOAD]
    if start is not None or end is not None:
        cmd += ["--download-sections", "*%s-%s" % (start or 0, end if end is not None else "inf")]
    run(cmd + ["--", url])
    files = [f for f in glob.glob(os.path.join(tmp, "src.*")) if not f.endswith((".part", ".json", ".vtt"))]
    if not files:
        raise RuntimeError("yt-dlp no descargó nada (¿demasiado grande o no disponible?)")
    sniff_media(files[0])
    return files[0]


# ---------------------------------------------------------------- main
def audit(event):
    path = os.environ.get("JARVIS_AUDIT_LOG") or os.path.join(
        os.environ.get("JARVIS_DIR", "."), "logs", "audit.jsonl")
    if os.path.isdir(os.path.dirname(path) or "."):
        event.update({"ts": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                      "source": "watch-video", "action": "media.watch"})
        try:
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(event, ensure_ascii=False) + "\n")
        except OSError:
            pass


def main(argv):
    load_dotenv()
    ap = argparse.ArgumentParser(prog="watch.py", add_help=True)
    ap.add_argument("--detail", choices=["transcript", "balanced", "visual"], default="transcript")
    ap.add_argument("--start")
    ap.add_argument("--end")
    ap.add_argument("--max-frames", type=int, default=MAX_FRAMES_CAP)
    ap.add_argument("--lang", default=os.environ.get("JARVIS_STT_LANG", "es"))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--delete-input", action="store_true",
                    help="borra el archivo local al terminar (solo adjuntos recibidos por un canal)")
    ap.add_argument("--cleanup", metavar="DIR")
    ap.add_argument("source", nargs="?")
    a = ap.parse_args(argv)

    sweep_stale()
    if a.cleanup:
        cleanup(a.cleanup)
        return 0
    if not a.source:
        fail(2, "falta la fuente (uso: watch.py [opciones] -- URL_o_archivo)")
    if not re.fullmatch(r"[a-z]{2}|auto", a.lang):
        fail(2, "--lang inválido")
    max_frames = max(1, min(MAX_FRAMES_CAP, a.max_frames))
    LANG[0] = a.lang if a.lang != "auto" else "es"

    tmp = None
    keep_tmp = False
    local_ok = None          # set only after the local file passed every check
    try:
        start, end = parse_ts(a.start), parse_ts(a.end)
        if start is not None and end is not None and end <= start:
            raise Refused("--end debe ser mayor que --start")
        is_url = "://" in a.source or a.source.startswith("-")
        src = check_url(a.source) if is_url else check_local(a.source)
        if not is_url:
            local_ok = src
        ffmpeg = need("ffmpeg", "brew install ffmpeg")
        tmp = tempfile.mkdtemp(prefix=TMP_PREFIX)
        result = {"source": "url" if is_url else "file", "detail": a.detail,
                  "transcript_source": None, "transcript": "", "frames": [], "frames_dir": None,
                  "notes": []}

        media = None
        if is_url:
            info, captions = url_captions(tmp, src)
            result.update({"title": info.get("title"), "uploader": info.get("uploader"),
                           "duration": info.get("duration")})
            if captions:
                result["transcript"], result["transcript_source"] = captions, "captions"
            dur = float(info.get("duration") or 0)
            if dur > URL_MAX_VIDEO_SECONDS and start is None and end is None and \
                    (a.detail != "transcript" or not captions):
                raise Refused("video de más de 60 minutos: dime qué parte (--start/--end)")
            want_frames = a.detail != "transcript"
            if want_frames or not captions:
                media = url_download(tmp, src, start, end, audio_only=not want_frames)
            # yt-dlp already cut the section: no second seek, but labels keep the real time.
            start_local = end_local = None
        else:
            media = src
            start_local, end_local = start, end
        offset = start or 0.0

        if media:
            duration, has_video, has_audio = probe(media)
            result["duration"] = result.get("duration") or round(duration, 1)
            if a.detail != "transcript" and has_video:
                fdir = os.path.join(tmp, "frames")
                os.mkdir(fdir)
                result["frames"] = extract_frames(ffmpeg, media, fdir, start_local, end_local,
                                                  offset, duration, a.detail, max_frames)
                result["frames_dir"] = tmp if result["frames"] else None
            elif a.detail != "transcript":
                result["notes"].append("el archivo no tiene imagen; solo audio")
            if not result["transcript"] and has_audio:
                wav = os.path.join(tmp, "speech.wav")
                extract_audio(ffmpeg, media, wav, start_local, end_local)
                try:
                    result["transcript"] = whisper(tmp, wav, a.lang, offset)
                    result["transcript_source"] = "whisper.cpp"
                except Missing as e:
                    result["notes"].append("sin transcripción: " + str(e))
                for f in glob.glob(os.path.join(tmp, "speech.*")):
                    os.remove(f)
            if is_url:
                os.remove(media)                      # never keep the downloaded video
        if not result["transcript"]:
            result["notes"].append("no hay voz ni subtítulos que transcribir")
            if a.detail == "transcript":
                result["notes"].append("para ver las imágenes, repite con --detail balanced")

        # Speaker or caption text could try to close the wrapper: strip tag-like text.
        clean = re.sub(r"</?\s*[A-Za-z_]*media[^>]*>", "", result["transcript"])
        result["transcript"] = clean
        audit({"kind": result["source"], "detail": a.detail, "frames": len(result["frames"]),
               "transcript_source": result["transcript_source"], "ok": True})

        keep_tmp = bool(result["frames"])        # frames live until --cleanup
        if a.json:
            print(json.dumps(result, ensure_ascii=False, indent=1))
        else:
            head = result.get("title") or os.path.basename(a.source)
            print("# Video: %s (%s)" % (head, fmt_ts(float(result.get("duration") or 0))))
            if result["transcript"]:
                print('<untrusted_media src="video" transcript="%s">' % result["transcript_source"])
                print(result["transcript"])
                print("</untrusted_media>")
            for n in result["notes"]:
                print("Nota: " + n)
            if result["frames"]:
                print("\n## Frames (%d, máx. %dpx) — léelos con Read en orden:" % (len(result["frames"]), FRAME_BOX))
                for fr in result["frames"]:
                    print("t=%s %s" % (fr["t"], fr["path"]))
                print("\nCuando termines: python3 -I %s --cleanup %s" % (os.path.abspath(__file__), tmp))
        return 0
    except Refused as e:
        audit({"ok": False, "reason": "refused"})
        fail(2, str(e))
    except Missing as e:
        fail(3, str(e))
    except (RuntimeError, subprocess.TimeoutExpired, OSError, ValueError) as e:
        fail(4, str(e))
    finally:
        if tmp and not keep_tmp:
            shutil.rmtree(tmp, ignore_errors=True)
        # Only a file that passed check_local is ever deleted; a refused path is left alone.
        if a.delete_input and local_ok and os.path.isfile(local_ok):
            os.remove(local_ok)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
