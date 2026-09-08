#!/usr/bin/env bash
# Render startup script for Django backend
set -e

PORT="${PORT:-8000}"
echo "--- Starting Gunicorn on port $PORT ---"
exec gunicorn backend.wsgi:application \
    --bind "0.0.0.0:${PORT}" \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
