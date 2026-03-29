#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Activate venv
source venv/bin/activate

# Kill child processes on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$REDIS_PID" "$WORKER_PID" 2>/dev/null
    wait "$REDIS_PID" "$WORKER_PID" 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Start Redis
redis-server --daemonize no --loglevel warning &
REDIS_PID=$!
echo "[1/3] Redis started (pid $REDIS_PID)"

# Wait for Redis to be ready
until redis-cli ping &>/dev/null; do sleep 0.1; done

# Start RQ worker (OBJC_DISABLE_INITIALIZE_FORK_SAFETY fixes macOS fork/ObjC crash)
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES rq worker recon-tasks &
WORKER_PID=$!
echo "[2/3] Worker started (pid $WORKER_PID)"

# Start Flask (foreground)
echo "[3/3] Starting recon-web..."
./recon-web
