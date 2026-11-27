#!/usr/bin/env bash
# Set up the Saraban Play Area API on a PythonAnywhere free account.
#
# Run this from a PythonAnywhere Bash console:
#     bash ~/setup.sh
#
# It expects ~/saraban.zip (uploaded by the deployment helper). If the zip is
# missing it downloads the repository archive from GitHub instead.

set -euo pipefail

APP_DIR="$HOME/saraban"
VENV_DIR="$HOME/.virtualenvs/saraban"
ZIP_PATH="$HOME/saraban.zip"
PYTHON_BIN="${PYTHON_BIN:-python3.11}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python3"
fi

if [ ! -f "$ZIP_PATH" ]; then
  echo "Downloading repository archive..."
  "$PYTHON_BIN" - "$ZIP_PATH" <<'PY'
import sys
import urllib.request

url = "https://github.com/kamaresh2004/saraban-play-area/archive/refs/heads/main.zip"
urllib.request.urlretrieve(url, sys.argv[1])
PY
fi

echo "Extracting into $APP_DIR..."
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
"$PYTHON_BIN" - "$ZIP_PATH" "$APP_DIR" <<'PY'
import os
import sys
import zipfile

zip_path, destination = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as archive:
    names = archive.namelist()
    prefix = ""
    if names and "/" in names[0]:
        candidate = names[0].split("/")[0] + "/"
        if all(name.startswith(candidate) for name in names):
            prefix = candidate
    for member in archive.infolist():
        target = member.filename
        if prefix and target.startswith(prefix):
            target = target[len(prefix):]
        if not target:
            continue
        output = os.path.join(destination, target)
        if member.is_dir():
            os.makedirs(output, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(output), exist_ok=True)
            with archive.open(member) as source, open(output, "wb") as sink:
                sink.write(source.read())
PY

echo "Creating virtualenv at $VENV_DIR..."
rm -rf "$VENV_DIR"
if ! "$PYTHON_BIN" -m venv "$VENV_DIR" >/dev/null 2>&1; then
  "$PYTHON_BIN" -m virtualenv "$VENV_DIR"
fi

echo "Installing dependencies (this can take a few minutes)..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$APP_DIR/backend/requirements.txt"
"$VENV_DIR/bin/python" -c 'import sys; print(f"python{sys.version_info.major}{sys.version_info.minor}")' > "$APP_DIR/.python_version"

echo "Writing production environment..."
SECRET="$("$VENV_DIR/bin/python" -c 'import secrets; print(secrets.token_urlsafe(48))')"
"$VENV_DIR/bin/python" - "$SECRET" <<'PY'
import sys
from pathlib import Path

secret = sys.argv[1]
content = f"""ENVIRONMENT=production
SECRET_KEY={secret}
DEMO_SEED_ON_STARTUP=true
CORS_ORIGIN_REGEX=https://.*\\.onrender\\.com|https://kamaresh2004\\.github\\.io
"""
Path.home().joinpath("saraban", "backend", ".env").write_text(content)
PY

echo "Smoke-testing the WSGI application..."
cd "$APP_DIR/backend"
DEMO_SEED_ON_STARTUP=true "$VENV_DIR/bin/python" - <<'PY'
from wsgiref.util import setup_testing_defaults
from app.wsgi import application

environ = {}
setup_testing_defaults(environ)
environ["REQUEST_METHOD"] = "GET"
environ["PATH_INFO"] = "/api/health"
environ["wsgi.url_scheme"] = "http"

captured = {}


def start_response(status, headers, exc_info=None):
    captured["status"] = status


body = b"".join(application(environ, start_response))
print(captured["status"], body.decode())
assert captured["status"].startswith("200"), captured["status"]
PY

echo ""
echo "PythonAnywhere setup complete."
echo "  App directory : $APP_DIR"
echo "  Virtualenv    : $VENV_DIR"
echo "  WSGI target   : /home/$(whoami)/saraban/backend/app/wsgi.py -> application"
echo ""
