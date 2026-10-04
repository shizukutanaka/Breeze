#!/bin/bash
# Register breeze:// protocol handler.
# The generated .desktop filename follows electron-builder's naming
# (executableName — unset today, so it derives from productName), which has
# differed from the hardcoded name this hook used to reference: the old
# single-name call silently no-oped via `|| true` whenever they mismatched.
# Loop over the plausible names so the registration lands regardless.
for d in breeze.desktop breeze-desktop.desktop Breeze.desktop; do
  if [ -f "/usr/share/applications/$d" ]; then
    xdg-mime default "$d" x-scheme-handler/breeze 2>/dev/null || true
    break
  fi
done
update-desktop-database /usr/share/applications 2>/dev/null || true
