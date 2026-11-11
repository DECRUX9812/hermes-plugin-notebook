#!/usr/bin/env bash
# Deploy the desktop half to every plugin root the app might read, and install
# the package half into the profile's plugins/ so its backend mounts.
#
#   tools/deploy.sh            # copy + hash-compare only
#   tools/deploy.sh --enable   # also enable the plugin in the profile config
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ID="hermes-notebook"
SRC="$ROOT/desktop/plugin.js"

[ -f "$SRC" ] || { echo "build first: node $ROOT/build.mjs" >&2; exit 1; }

DESKTOP_ROOTS=(
  "$HOME/.hermes-webapp/desktop-plugins"
  "$HOME/.hermes/desktop-plugins"
  "/home/streamuser/.hermes/desktop-plugins"
)

echo "artefact $SRC"
md5sum "$SRC" | awk '{print "  "$1"  "$2}'

for base in "${DESKTOP_ROOTS[@]}"; do
  parent="$(dirname "$base")"
  if [ ! -d "$parent" ]; then
    echo "skip $base (no $parent)"
    continue
  fi
  mkdir -p "$base/$ID"
  cp "$SRC" "$base/$ID/plugin.js"
  echo "  -> $base/$ID/plugin.js"
done

# the package half: the same folder the loader mounts plugin_api.py from
for pkgroot in "$HOME/.hermes-webapp/plugins" "$HOME/.hermes/plugins"; do
  [ -d "$(dirname "$pkgroot")" ] || continue
  mkdir -p "$pkgroot/$ID"
  cp "$ROOT/plugin.yaml" "$pkgroot/$ID/" 2>/dev/null || true
  rm -rf "$pkgroot/$ID/hermes_notebook" "$pkgroot/$ID/dashboard" "$pkgroot/$ID/desktop"
  cp -r "$ROOT/hermes_notebook" "$pkgroot/$ID/"
  cp -r "$ROOT/dashboard" "$pkgroot/$ID/"
  # NOT copied: desktop/. The shell's `reconcile` publishes any package that
  # ships a desktop/ folder into desktop-plugins/ WITH a .hermes-package.json
  # marker, and a marker means defaultEnabled:false — the plugin then loads
  # disabled and never appears in the nav, which is exactly what "the plugin is
  # broken" looked like. The front-end is deployed separately below; the backend
  # does not need it.

  cp "$ROOT/__init__.py" "$pkgroot/$ID/" 2>/dev/null || true
  echo "  pkg -> $pkgroot/$ID"
done

echo
echo "hash check (repo artefact vs every deployed copy):"
repo_sum=$(md5sum "$SRC" | awk '{print $1}')
bad=0
for base in "${DESKTOP_ROOTS[@]}"; do
  f="$base/$ID/plugin.js"
  [ -f "$f" ] || continue
  sum=$(md5sum "$f" | awk '{print $1}')
  if [ "$sum" = "$repo_sum" ]; then
    echo "  OK   $f"
  else
    echo "  DIFF $f ($sum)"
    bad=1
  fi
done
[ "$bad" = 0 ] || exit 1

if [ "${1:-}" = "--enable" ]; then
  HOME_CFG="$HOME/.hermes-webapp/config.yaml"
  if [ -f "$HOME_CFG" ] && ! grep -q "^    - $ID$" <(sed -n '/^plugins:/,/^[a-z]/p' "$HOME_CFG"); then
    python3 - "$HOME_CFG" "$ID" <<'PY'
import sys, re
path, pid = sys.argv[1], sys.argv[2]
text = open(path).read()
if re.search(r'^plugins:\n(?:.*\n)*?\s+enabled:\n', text, re.M):
    # insert after the enabled: line inside the plugins block
    m = re.search(r'^(plugins:\n(?:.*\n)*?\s+enabled:\n)', text, re.M)
    text = text[:m.end()] + f"    - {pid}\n" + text[m.end():]
else:
    text += f"\nplugins:\n  enabled:\n    - {pid}\n"
open(path, 'w').write(text)
print(f"enabled {pid} in {path}")
PY
  else
    echo "  already enabled in $HOME_CFG (or no config)"
  fi
fi

echo
echo "next: reload the desktop window (the app watches desktop-plugins/; palette ->"
echo "\"Reload desktop plugins\"). The gateway hot-mounts /api/plugins/$ID/ on the"
echo "first request, so a *new* plugin needs no restart — only an *edited* one does."
