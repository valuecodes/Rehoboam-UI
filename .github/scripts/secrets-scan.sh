#!/bin/sh
# Scan the repo's git history for committed secrets with gitleaks.
#
# Used by `pnpm secrets:scan` and by the `secrets-scan` CI job, so the pinned
# version below is the single source of truth for both. A local `gitleaks`
# binary is preferred when it is on PATH and new enough to have the `git`
# subcommand (v8.19+); otherwise the pinned Docker image runs instead. Extra
# arguments are passed through to `gitleaks git`, e.g.
# `pnpm secrets:scan --log-opts="origin/main..HEAD"`.
#
# Exit code is gitleaks' own: 0 clean, 1 leaks found. 2 means neither runner
# is available.
set -eu

GITLEAKS_VERSION="8.30.1"
# Digest of the v$GITLEAKS_VERSION multi-arch image, so a re-pushed tag cannot
# change what runs. Bump both together.
GITLEAKS_DIGEST="sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"

repo_root=$(git rev-parse --show-toplevel)

if command -v gitleaks >/dev/null 2>&1 && gitleaks git --help >/dev/null 2>&1; then
  exec gitleaks git --redact --verbose "$@" "$repo_root"
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # Mount read-only (gitleaks only reads) at the real absolute path, not /repo:
  # in a git worktree `.git` is a file pointing at an absolute path inside the
  # main checkout's git dir, which therefore has to be mounted at its own path.
  git_common_dir=$(cd "$repo_root" && cd "$(git rev-parse --git-common-dir)" && pwd)
  set -- -v "$repo_root:$repo_root:ro" \
    "ghcr.io/gitleaks/gitleaks:v$GITLEAKS_VERSION@$GITLEAKS_DIGEST" \
    git --redact --verbose "$@" "$repo_root"
  case "$git_common_dir" in
    "$repo_root"/*) ;;
    *) set -- -v "$git_common_dir:$git_common_dir:ro" "$@" ;;
  esac
  exec docker run --rm "$@"
fi

cat >&2 <<EOF
secrets:scan needs gitleaks v8.19+ or a running Docker daemon.
Install gitleaks v$GITLEAKS_VERSION: https://github.com/gitleaks/gitleaks#installing
  (e.g. \`brew install gitleaks\` or \`go install github.com/zricethezav/gitleaks/v8@v$GITLEAKS_VERSION\`)
EOF
exit 2
