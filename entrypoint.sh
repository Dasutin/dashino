#!/usr/bin/env sh
set -eu

seedDirIfEmpty() {
  src="$1"
  dst="$2"

  mkdir -p "$dst"

  # If dst is empty (no entries), seed it
  if [ -z "$(ls -A "$dst" 2>/dev/null || true)" ]; then
    echo "[dashino] Seeding $(basename "$dst") from defaults..."
    # Use tar to preserve perms and copy dotfiles
    (cd "$src" && tar -cf - .) | (cd "$dst" && tar -xpf -)
  else
    echo "[dashino] $(basename "$dst") already has content; skipping seed."
  fi
}

# Ensure runtime dirs exist (these are volume mounts)
mkdir -p /app/dashboards /app/widgets /app/themes /app/assets /app/jobs /app/logs /app/backups

# Fix ownership so the node user can write into fresh volumes
chown -R node:node /app/dashboards /app/widgets /app/themes /app/assets /app/jobs /app/logs /app/backups || true

# Seed only when empty
seedDirIfEmpty /defaults/dashboards /app/dashboards
seedDirIfEmpty /defaults/widgets    /app/widgets
seedDirIfEmpty /defaults/themes     /app/themes
seedDirIfEmpty /defaults/assets     /app/assets
seedDirIfEmpty /defaults/jobs       /app/jobs
seedDirIfEmpty /defaults/backups    /app/backups

# Optional sentinel for humans/debugging
touch /app/.dashino-initialized || true
chown node:node /app/.dashino-initialized || true

# Drop to node and run CMD
exec su -s /bin/sh node -c "$*"
