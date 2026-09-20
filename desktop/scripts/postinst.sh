#!/bin/bash
# Register breeze:// protocol handler
xdg-mime default breeze-desktop.desktop x-scheme-handler/breeze 2>/dev/null || true
update-desktop-database /usr/share/applications 2>/dev/null || true
