#!/bin/sh
# Entrypoint for the EARAS / REXA API container.
#
# When DATABASE_URL points at a network database (e.g. PostgreSQL running in
# the `db` service of docker-compose), the API container can start faster
# than the database is ready to accept connections. This script blocks
# briefly until the database's TCP port is reachable (or a timeout elapses)
# before handing off to Uvicorn, so `docker compose up` works reliably on
# the first try without relying on a fixed `sleep`.
#
# SQLite (the default for local, non-Docker development) needs no such
# wait, so it is skipped automatically.
set -e

python <<'PY'
import os
import re
import socket
import sys
import time
from urllib.parse import urlparse

url = os.environ.get("DATABASE_URL", "")

if not url or url.startswith("sqlite"):
    sys.exit(0)

# Normalize SQLAlchemy's "postgresql+psycopg2://" style URLs (strip the
# "+driver" suffix from the scheme) so urlparse can extract host/port.
normalized_url = re.sub(r"^([a-zA-Z0-9]+)\+[a-zA-Z0-9]+://", r"\1://", url)
parsed = urlparse(normalized_url)
host = parsed.hostname or "db"
port = parsed.port or 5432

print(f"[entrypoint] Waiting for database at {host}:{port} ...", flush=True)
deadline = time.time() + 60
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            print("[entrypoint] Database is reachable.", flush=True)
            sys.exit(0)
    except OSError:
        time.sleep(1)

print(f"[entrypoint] Database at {host}:{port} did not become reachable within 60s.", file=sys.stderr)
sys.exit(1)
PY

PORT="${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
