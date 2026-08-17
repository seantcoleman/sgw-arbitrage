#!/bin/bash
# SGW Arbitrage backend startup script for launchd

set -e

cd /Users/seancoleman/Desktop/Coding/sgw-arbitrage/backend

# Load credentials from .env (never commit .env — add keys there)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Activate venv and run
source venv/bin/activate
exec uvicorn api:app --port 8000 --host 127.0.0.1
