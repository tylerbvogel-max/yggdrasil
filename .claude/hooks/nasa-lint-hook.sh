#!/bin/bash
# Claude Code PostToolUse hook — runs NASA linter on edited/written files
# Provides immediate feedback so violations are caught during editing, not at commit time.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Skip non-Python files
if [[ ! "$FILE_PATH" =~ \.py$ ]]; then
    exit 0
fi

# Skip files outside backend/app
if [[ ! "$FILE_PATH" =~ /backend/app/ ]]; then
    exit 0
fi

REPO_ROOT=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null)
LINTER="$REPO_ROOT/scripts/nasa_lint.py"

if [ ! -f "$LINTER" ]; then
    # Fall back to looking relative to this script
    LINTER="$(dirname "$(dirname "$(dirname "$0")")")/scripts/nasa_lint.py"
fi

if [ ! -f "$LINTER" ]; then
    exit 0
fi

# Run with both strict and warn
OUTPUT=$(python3 "$LINTER" --strict --warn "$FILE_PATH" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    # All clean — no need to bother Claude
    exit 0
fi

if [ $EXIT_CODE -eq 1 ]; then
    # Strict violations — Claude must fix before committing
    echo "$OUTPUT" >&2
    exit 2
fi

if [ $EXIT_CODE -eq 2 ]; then
    # Warnings — inform Claude but don't block
    echo "$OUTPUT" >&2
    exit 0
fi

exit 0
