#!/usr/bin/env bash
# Backup configuration for FreeLLM API
# Keeps the last 5 timestamped backups
set -e

BACKUP_DIR="${1:-/home/nanobot/.nanobot/backups/freellmapi}"
PROJECT_DIR="/home/nanobot/projects/freellmapi"
RETENTION=5

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DEST="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$DEST"

# Backup configuration files
cp "$PROJECT_DIR/.env" "$DEST/.env" 2>/dev/null && echo "  ✓ .env" || echo "  ✗ .env (not found)"
cp "$PROJECT_DIR/server/data/freeapi.db" "$DEST/freeapi.db" 2>/dev/null && echo "  ✓ freeapi.db" || echo "  ✗ freeapi.db (not found)"
cp "$PROJECT_DIR/server/package.json" "$DEST/package.json" 2>/dev/null && echo "  ✓ package.json" || echo "  ✗ package.json (not found)"

echo ""
echo "Backup saved: $TIMESTAMP"

# Rotate old backups
BACKUPS=($(ls -1d "$BACKUP_DIR"/2* 2>/dev/null | sort -r))
COUNT=${#BACKUPS[@]}
if [ "$COUNT" -gt "$RETENTION" ]; then
  TO_DELETE=$((COUNT - RETENTION))
  echo "Removing $TO_DELETE old backup(s)..."
  for ((i=COUNT-1; i>=RETENTION; i--)); do
    echo "  Removing ${BACKUPS[$i]}"
    rm -rf "${BACKUPS[$i]}"
  done
fi

echo ""
echo "Final backup list:"
ls -1d "$BACKUP_DIR"/2* 2>/dev/null | sort || echo "  (empty)"
