#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_DIR="$ROOT/handoff/rc10-archive"
TMP_B64="$ROOT/handoff/rc10.zip.b64"
ZIP="$ROOT/handoff/Maps-Hunter-Pro-8.4.0-RC10-MAPS-FIRST.zip"
EXPECTED_SHA="fd73d74df1cb0ef073a47374ba4064733093bdf18a1218442c34b931c558eb21"

printf 'Rebuilding RC10 archive...\n'
cat "$ARCHIVE_DIR"/rc10.zip.b64.part* > "$TMP_B64"
base64 -d "$TMP_B64" > "$ZIP"

printf '%s  %s\n' "$EXPECTED_SHA" "$ZIP" | sha256sum -c -

printf 'Restoring exact RC10 source into extension/...\n'
rm -rf "$ROOT/extension"
mkdir -p "$ROOT/extension"
unzip -q "$ZIP" -d "$ROOT/extension"
rm -f "$TMP_B64"

printf 'RC10 restored successfully.\n'
printf 'Extension path: %s\n' "$ROOT/extension"
printf 'Archive: %s\n' "$ZIP"
