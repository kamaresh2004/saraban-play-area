"""Deploy the Saraban API to PythonAnywhere using its public API.

Usage (from the repository root):

    $env:PA_USERNAME = "your-username"
    $env:PA_TOKEN = "your-api-token"
    python deploy/pythonanywhere/deploy.py

The script is idempotent:

1. Uploads ``saraban.zip`` and ``setup.sh`` to the account's home directory.
2. If the virtualenv is missing, it prints the single Bash-console command to
   run. Run that command, then run this script again.
3. When the virtualenv exists, it creates/updates the WSGI web app, uploads the
   WSGI entry file, reloads the app and waits for ``/api/health``.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import uuid
from pathlib import Path
from urllib import error, parse, request

try:
    import certifi

    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # pragma: no cover - certifi ships with most installs
    SSL_CONTEXT = ssl.create_default_context()

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_HOST = "www.pythonanywhere.com"


def _request(
    method: str,
    url: str,
    *,
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    req = request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with request.urlopen(req, timeout=120, context=SSL_CONTEXT) as response:
            return response.status, response.read()
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} -> HTTP {exc.code}: {body}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"{method} {url} failed: {exc.reason}") from exc


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Token {token}"}


def _api_url(host: str, username: str, path: str) -> str:
    return f"https://{host}/api/v0/user/{username}/{path.lstrip('/')}"


def _multipart(field: str, filename: str, content: bytes) -> tuple[bytes, str]:
    boundary = "----Saraban" + uuid.uuid4().hex
    head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8")
    tail = f"\r\n--{boundary}--\r\n".encode("utf-8")
    return head + content + tail, f"multipart/form-data; boundary={boundary}"


def _upload(
    host: str, username: str, token: str, remote_path: str, content: bytes, filename: str
) -> None:
    body, content_type = _multipart("content", filename, content)
    _request(
        "POST",
        f"https://{host}/api/v0/user/{username}/files/path{remote_path}",
        data=body,
        headers={**_auth(token), "Content-Type": content_type},
    )
    print(f"  uploaded {remote_path}")


def _form(
    host: str, username: str, token: str, path: str, fields: dict[str, str]
) -> bytes:
    body = parse.urlencode(fields).encode("utf-8")
    _, response = _request(
        "POST",
        _api_url(host, username, path),
        data=body,
        headers={
            **_auth(token),
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    return response


def _patch(
    host: str, username: str, token: str, path: str, fields: dict[str, str]
) -> bytes:
    body = parse.urlencode(fields).encode("utf-8")
    _, response = _request(
        "PATCH",
        _api_url(host, username, path),
        data=body,
        headers={
            **_auth(token),
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    return response


def _exists(host: str, username: str, token: str, path: str) -> bool:
    url = _api_url(host, username, f"files/tree/?{parse.urlencode({'path': path})}")
    try:
        _request("GET", url, headers=_auth(token))
        return True
    except RuntimeError as exc:
        if "HTTP 404" in str(exc) or "HTTP 400" in str(exc):
            return False
        raise


def _read_text(host: str, username: str, token: str, path: str) -> str:
    url = _api_url(host, username, f"files/path{path}")
    _, body = _request("GET", url, headers=_auth(token))
    return body.decode("utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", default=os.environ.get("PA_USERNAME"))
    parser.add_argument("--token", default=os.environ.get("PA_TOKEN"))
    parser.add_argument("--host", default=os.environ.get("PA_HOST", DEFAULT_HOST))
    parser.add_argument(
        "--zip",
        default=str(REPO_ROOT / "saraban.zip"),
        help="Repository archive to upload (default: saraban.zip in the repo root)",
    )
    args = parser.parse_args()

    if not args.username or not args.token:
        parser.error("Set PA_USERNAME and PA_TOKEN (or pass --username/--token).")

    username = args.username.strip()
    host = args.host.strip().rstrip("/")
    token = args.token.strip()
    domain = (
        f"{username}.pythonanywhere.com"
        if host == "www.pythonanywhere.com"
        else f"{username}.eu.pythonanywhere.com"
    )

    print(f"Checking PythonAnywhere token for {username} on {host}...")
    _, cpu = _request("GET", _api_url(host, username, "cpu/"), headers=_auth(token))
    print(f"  token OK; CPU usage: {json.loads(cpu).get('daily_cpu_total_usage_seconds')}s")

    zip_path = Path(args.zip)
    setup_path = REPO_ROOT / "deploy" / "pythonanywhere" / "setup.sh"
    if not zip_path.is_file():
        print(f"Missing {zip_path}. Create it with: git archive --format=zip --output=saraban.zip HEAD")
        return 1

    print("Uploading deployment files...")
    _upload(
        host, username, token, f"/home/{username}/saraban.zip", zip_path.read_bytes(), "saraban.zip"
    )
    _upload(
        host,
        username,
        token,
        f"/home/{username}/setup.sh",
        setup_path.read_bytes(),
        "setup.sh",
    )

    venv_path = f"/home/{username}/.virtualenvs/saraban"
    if not _exists(host, username, token, venv_path + "/"):
        print("")
        print("=" * 72)
        print("One console step is required before the web app can start.")
        print("Open a Bash console on PythonAnywhere and run:")
        print("")
        print("    bash ~/setup.sh")
        print("")
        print("Then run this script again.")
        print("=" * 72)
        return 2

    try:
        python_version = _read_text(
            host, username, token, f"/home/{username}/saraban/.python_version"
        ).strip()
    except RuntimeError:
        python_version = "python311"
    if not python_version.startswith("python"):
        python_version = "python311"
    print(f"Detected web app Python version: {python_version}")

    print("Creating/updating the WSGI web app...")
    _, webapps_body = _request(
        "GET", _api_url(host, username, "webapps/"), headers=_auth(token)
    )
    webapps = json.loads(webapps_body or b"[]")
    if not any(app.get("domain_name") == domain for app in webapps):
        _form(
            host,
            username,
            token,
            "webapps/",
            {"domain_name": domain, "python_version": python_version},
        )
        print(f"  created {domain}")
    else:
        print(f"  found existing {domain}")

    _patch(
        host,
        username,
        token,
        f"webapps/{domain}/",
        {
            "source_directory": f"/home/{username}/saraban/backend",
            "virtualenv_path": venv_path,
            "force_https": "true",
        },
    )
    print("  configured source directory and virtualenv")

    wsgi_name = domain.lower().replace(".", "_") + "_wsgi.py"
    wsgi_content = (
        "import sys\n"
        f'sys.path.insert(0, "/home/{username}/saraban/backend")\n'
        "from app.wsgi import application  # noqa: E402,F401\n"
    ).encode("utf-8")
    _upload(host, username, token, f"/var/www/{wsgi_name}", wsgi_content, wsgi_name)

    print("Reloading the web app...")
    _request(
        "POST",
        _api_url(host, username, f"webapps/{domain}/reload/"),
        data=b"",
        headers=_auth(token),
    )

    print("Waiting for the live health check...")
    health_url = f"https://{domain}/api/health"
    for attempt in range(1, 41):
        try:
            with request.urlopen(health_url, timeout=25, context=SSL_CONTEXT) as response:
                if response.status == 200:
                    print(f"  {health_url} -> {response.read().decode()}")
                    print("")
                    print("=" * 72)
                    print(f"Backend live: https://{domain}")
                    print(f"API base    : https://{domain}/api")
                    print("=" * 72)
                    return 0
        except Exception:
            pass
        if attempt == 10 or attempt == 25:
            print(f"  still starting (attempt {attempt}/40)...")
        time.sleep(3)

    print("The web app has not answered yet. Check the Web tab's error log.")
    print(f"Expected URL: https://{domain}/api/health")
    return 3


if __name__ == "__main__":
    sys.exit(main())
