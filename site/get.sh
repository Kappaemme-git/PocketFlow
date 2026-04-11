#!/usr/bin/env bash
set -e

V="0.1.0"
URL="https://github.com/Kappaemme-git/PocketFlow/releases/download/v${V}/PocketFlow-${V}.dmg"

echo && echo "  PocketFlow — installing v${V}..." && echo

[ "$(uname)" = "Darwin" ] || { echo "  ✗ macOS only."; exit 1; }
[ -d /Applications/PocketFlow.app ] && rm -rf /Applications/PocketFlow.app

T=$(mktemp -d)
echo "  → Downloading..."
curl -fsSL --progress-bar -o "$T/pf.dmg" "$URL"

echo "  → Installing to /Applications..."
MNT=$(hdiutil attach "$T/pf.dmg" -nobrowse -quiet | tail -1 | awk '{print $NF}')
cp -R "$MNT/PocketFlow.app" /Applications/
hdiutil detach "$MNT" -quiet
xattr -dr com.apple.quarantine /Applications/PocketFlow.app 2>/dev/null || true
rm -rf "$T"

echo && echo "  ✓ Done — launch from Spotlight or /Applications." && echo
open /Applications/PocketFlow.app
