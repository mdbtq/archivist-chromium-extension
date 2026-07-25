#!/bin/bash
# Wrapper so Chrome can launch the native messaging host: the manifest must
# point at an executable, and it is started with a minimal PATH that usually
# does not include node.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prefer an explicit node path recorded at install time, then common locations.
if [ -f "$DIR/node-path" ]; then
  NODE="$(cat "$DIR/node-path")"
fi

if [ ! -x "$NODE" ]; then
  NODE="$(command -v node 2>/dev/null)"
fi

for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
  if [ ! -x "$NODE" ] && [ -x "$candidate" ]; then
    NODE="$candidate"
  fi
done

if [ ! -x "$NODE" ]; then
  echo "archivist_host: could not locate node" >&2
  exit 1
fi

exec "$NODE" "$DIR/archivist_host.js"
