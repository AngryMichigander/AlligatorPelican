#!/usr/bin/env bash
set -euo pipefail
git push --all origin "$@"
git push --all mirror "$@"
git push --tags origin
git push --tags mirror
