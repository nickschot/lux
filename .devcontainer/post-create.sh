#!/usr/bin/env bash
set -euo pipefail

# Named volumes occasionally come up root-owned depending on the Docker version;
# make sure the non-root user can write before installing into them.
for dir in node_modules test/test-app/node_modules; do
  if [ ! -w "$dir" ]; then
    echo "==> fixing ownership of $dir"
    sudo chown -R node:node "$dir"
  fi
done

# Attribute container-side commits if the host exported an identity.
if [ -n "${GIT_AUTHOR_NAME:-}" ]; then
  git config --global user.name "$GIT_AUTHOR_NAME"
fi
if [ -n "${GIT_AUTHOR_EMAIL:-}" ]; then
  git config --global user.email "$GIT_AUTHOR_EMAIL"
fi

# The repo is bind-mounted from the host, where it is owned by a different uid.
git config --global --add safe.directory /workspaces/lux

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
