#!/bin/bash
# Forward local :8000 to Oracle VM backend (use while Mac is awake for the UI)
KEY="${HOME}/.ssh/sgw-bot.key"
HOST="ubuntu@129.146.162.189"
# kill existing tunnel on 8000 if any
if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 8000 already in use:"
  lsof -nP -iTCP:8000 -sTCP:LISTEN
  exit 0
fi
ssh -i "$KEY" -f -N -L 8000:127.0.0.1:8000 "$HOST" && echo "Tunnel up: http://localhost:8000 -> Oracle"
