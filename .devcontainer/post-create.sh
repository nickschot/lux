#!/usr/bin/env bash
set -euo pipefail

# A named volume mounted at a path the image does not pre-create comes up
# root-owned. Path-agnostic, so it holds wherever the IDE puts the checkout.
if [ ! -w . ]; then
  echo "==> fixing ownership of $(pwd)"
  sudo chown -R node:node .
fi

# Attribute container-side commits if the host exported an identity.
if [ -n "${GIT_AUTHOR_NAME:-}" ]; then
  git config --global user.name "$GIT_AUTHOR_NAME"
fi
if [ -n "${GIT_AUTHOR_EMAIL:-}" ]; then
  git config --global user.email "$GIT_AUTHOR_EMAIL"
fi

# Resolved at runtime rather than hardcoded: with "clone sources" the IDE picks
# the checkout path. Only strictly needed when the tree is bind-mounted from the
# host (different uid), but harmless otherwise.
git config --global --add safe.directory "$(pwd)"

# Pushing from inside the container.
#
# The repo's remote is SSH (git@github.com:...), but this container has no SSH
# key and no agent forwarding, and a token only authenticates over HTTPS — so
# `git push` would fail. Rewriting the URL makes git use HTTPS with gh's
# credential helper instead.
#
# This is safe precisely because it is global-but-container-local: ~/.gitconfig
# lives in the container image, not the bind mount, so the host keeps using SSH.
# The rewrite is only applied when we actually have GitHub credentials, so
# forwarding an SSH agent instead still works.
if [ -n "${GH_TOKEN:-}" ] || gh auth status >/dev/null 2>&1; then
  if gh auth setup-git 2>/dev/null; then
    git config --global url."https://github.com/".insteadOf "git@github.com:"
    echo "==> git will push over HTTPS as $(gh api user --jq .login 2>/dev/null || echo 'the token owner')"
  else
    echo "==> WARNING: 'gh auth setup-git' failed; pushes may not work"
  fi
else
  cat <<'MSG'
==> No GitHub credentials found (GH_TOKEN unset, gh not logged in).
    Commits will work; pushes will not, because the remote is SSH and this
    container has no key. To enable pushing:
      gh auth login && gh auth setup-git
      git config --global url."https://github.com/".insteadOf "git@github.com:"
MSG
fi

echo "==> installing dependencies"
pnpm install --frozen-lockfile
pnpm --dir test/test-app install --frozen-lockfile

# The app compiler bundles dist/index.mjs, so the suite runs against the last
# build rather than the working tree — build before the first test run.
echo "==> building"
pnpm build

echo
echo "devcontainer ready."
echo "  pnpm test        # expect 552 passing"
echo "  claude           # first run will prompt for login"
echo "  gh auth status   # or: gh auth login"
