#!/bin/sh
# Runs the command it is given with the BarentsWatch client secret in its environment.
# The secret comes from the macOS keychain (service barentswatch-ais, account client_secret).
# It is never printed, logged, or saved. The shell execs the command, so the command replaces this shell.
set -eu

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <command> [args...]" >&2
  exit 2
fi

secret="$(security find-generic-password -s barentswatch-ais -a client_secret -w 2>/dev/null)" || secret=""
if [ -z "$secret" ]; then
  echo 'Keychain entry "barentswatch-ais" (account "client_secret") is missing or unreadable. Add it with: security add-generic-password -s barentswatch-ais -a client_secret -w' >&2
  exit 1
fi

BARENTSWATCH_CLIENT_SECRET="$secret"
export BARENTSWATCH_CLIENT_SECRET
exec "$@"
