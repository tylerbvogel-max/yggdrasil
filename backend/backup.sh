#!/usr/bin/env bash
# Yggdrasil automated backup — runs every 2 weeks via cron
# 1. Copies DB to Google Drive (rotating backup_a / backup_b)
# 2. Runs checkpoint endpoint (JSON export + git commit)
# 3. Pushes to GitHub
#
# Rotation: even-numbered fortnights write backup_a, odd write backup_b
# Result: two copies always 2 weeks apart

set -euo pipefail

DB_PATH="$HOME/Projects/yggdrasil/backend/yggdrasil.db"
GDRIVE_DIR="/mnt/chromeos/GoogleDrive/MyDrive/yggdrasil-backups"
REPO_DIR="$HOME/Projects/yggdrasil"
LOG_FILE="$HOME/Projects/yggdrasil/backend/backup.log"
API_BASE="http://localhost:8002"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "=== Backup triggered ==="

# Skip alternate weeks — only run on even-numbered ISO weeks
WEEK=$(date +%V)
if [ $(( WEEK % 2 )) -ne 0 ]; then
    log "Skipping: odd week ($WEEK), next run on even week"
    exit 0
fi

log "Running backup (week $WEEK)"

# --- 1. Google Drive rotating copy ---
if [ -d "$GDRIVE_DIR" ]; then
    # Rotate between two slots based on week number
    SLOT=$(( (WEEK / 2) % 2 ))
    if [ "$SLOT" -eq 0 ]; then
        TARGET="backup_a.db"
    else
        TARGET="backup_b.db"
    fi

    cp "$DB_PATH" "$GDRIVE_DIR/$TARGET"
    log "Google Drive: wrote $TARGET ($(du -h "$GDRIVE_DIR/$TARGET" | cut -f1))"
else
    log "WARNING: Google Drive not mounted at $GDRIVE_DIR, skipping Drive backup"
fi

# --- 2. Checkpoint (JSON export + git commit) ---
CHECKPOINT_RESPONSE=$(curl -s -X POST "$API_BASE/admin/checkpoint" 2>&1) || true
if echo "$CHECKPOINT_RESPONSE" | grep -q '"status"'; then
    log "Checkpoint: $CHECKPOINT_RESPONSE"
else
    log "WARNING: Checkpoint endpoint failed or server not running: $CHECKPOINT_RESPONSE"
fi

# --- 3. Git push ---
cd "$REPO_DIR"
git push origin main >> "$LOG_FILE" 2>&1 && log "Git: pushed to origin" || log "WARNING: git push failed"

log "=== Backup complete ==="
