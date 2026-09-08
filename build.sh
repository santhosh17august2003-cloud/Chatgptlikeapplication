#!/usr/bin/env bash
set -o errexit

cd backend
chmod +x build.sh start.sh 2>/dev/null || true
./build.sh
