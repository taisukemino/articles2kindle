#!/bin/bash
# AI code review against CLAUDE.md guidelines.
# Runs as a pre-commit hook via husky.
# Skips gracefully if the claude CLI is not installed.

set -euo pipefail

if ! command -v claude &>/dev/null; then
  echo "AI review skipped (claude CLI not found)"
  exit 0
fi

STAGED_DIFF=$(git diff --cached --diff-filter=ACMR -- '*.ts' '*.tsx')

if [ -z "$STAGED_DIFF" ]; then
  exit 0
fi

CLAUDE_MD_PATH="${HOME}/.claude/CLAUDE.md"
if [ ! -f "$CLAUDE_MD_PATH" ]; then
  echo "AI review skipped (CLAUDE.md not found)"
  exit 0
fi
CLAUDE_MD=$(cat "$CLAUDE_MD_PATH")

PROMPT=$(cat <<PROMPT_END
You are a code reviewer. Review the diff below against the project CLAUDE.md guidelines (provided after the diff).

Focus ONLY on things a linter cannot catch:
- Poor or generic naming (tmp, str, obj, retval, get, data, etc.)
- Missing explaining variables (complex inline expressions that should be named)
- YAGNI violations (unnecessary parameters, premature abstractions, speculative code)
- Functions doing too many things (should be split)
- Commented-out code that should be deleted
- Missing boolean prefixes (is, has, can) on boolean variables

Do NOT flag:
- Formatting or style (handled by Prettier)
- Unused variables or imports (handled by ESLint)
- Type issues (handled by TypeScript)
- Anything already enforced by a linter

If everything looks good, respond with exactly: LGTM

Otherwise, list each suggestion as:
FILE:LINE - description

Be concise. Only flag clear violations, not subjective preferences.
PROMPT_END
)

FULL_PROMPT=$(printf '%s\n\n--- DIFF ---\n%s\n\n--- CLAUDE.MD ---\n%s' "$PROMPT" "$STAGED_DIFF" "$CLAUDE_MD")

echo "Running AI review..."

REVIEW=$(claude -p "$FULL_PROMPT" 2>/dev/null) || {
  echo "AI review skipped (claude command failed)"
  exit 0
}

if echo "$REVIEW" | grep -qi "^LGTM$"; then
  echo "AI review passed"
  exit 0
fi

echo ""
echo "AI Review Suggestions:"
echo "─────────────────────"
echo "$REVIEW"
echo "─────────────────────"
echo ""
echo "Fix the suggestions above, or use 'git commit --no-verify' to skip."
exit 1
