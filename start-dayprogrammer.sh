#!/usr/bin/env bash

ROOT="/home/vocrow/Documents/dayProgrammer"
PIDFILE="$ROOT/.dayprogrammer_server.pid"
LOGFILE="$ROOT/server.log"

cd "$ROOT" || exit 1

# If already running, do nothing.
if [ -f "$PIDFILE" ]; then
  existing_pid="$(cat "$PIDFILE" 2>/dev/null)"
  if [ -n "$existing_pid" ] && kill -0 "$existing_pid" >/dev/null 2>&1; then
    exit 0
  else
    rm -f "$PIDFILE"
  fi
fi

nohup python3 -m http.server 5500 >>"$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
