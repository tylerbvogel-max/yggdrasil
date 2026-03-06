#!/bin/bash
# Deploy to public repo with monetization stripped.
# Usage: ./scripts/deploy-public.sh
#
# What it does:
#   1. Creates a temporary branch from current HEAD
#   2. Removes MonetizationPage component and all references
#   3. Rebuilds frontend (so dist/ is clean)
#   4. Force-pushes to the 'public' remote's main branch
#   5. Returns to original branch and cleans up
#
# Safe: never modifies your working branch or private remote.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
cd "$REPO_DIR"

ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
TEMP_BRANCH="public-deploy-$(date +%s)"

echo "=== Deploying to public repo ==="
echo "Source: $ORIGINAL_BRANCH"
echo "Temp branch: $TEMP_BRANCH"
echo ""

# Ensure clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "ERROR: Working tree is dirty. Commit or stash changes first."
    exit 1
fi

# Create temp branch
git checkout -b "$TEMP_BRANCH"

# --- Strip monetization ---

# 1. Remove the component file
rm -f frontend/src/components/MonetizationPage.tsx

# 2. Remove import, tab type entry, nav item, and render line from App.tsx
sed -i "/import MonetizationPage/d" frontend/src/App.tsx
sed -i "s/ | 'monetization'//g" frontend/src/App.tsx
sed -i "/key: 'monetization'/d" frontend/src/App.tsx
sed -i "/tab === 'monetization'/d" frontend/src/App.tsx

# 3. Remove CSS rules for nav-monetization
sed -i "/\.nav-monetization/d" frontend/src/App.css

# 4. Commit the stripped version
git add -A
git commit -m "$(cat <<'EOF'
Public release — strip internal monetization analysis

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

# 5. Push to public remote
echo ""
echo "Pushing to public remote..."
git push public "$TEMP_BRANCH":main --force

# 6. Clean up — return to original branch and delete temp
git checkout "$ORIGINAL_BRANCH"
git branch -D "$TEMP_BRANCH"

echo ""
echo "=== Done! Public repo updated ==="
echo "https://github.com/tylerbvogel-max/yggdrasil-public"
