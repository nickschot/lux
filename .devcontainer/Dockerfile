# trixie, not bookworm: Meta's prebuilt watchman links against GLIBC 2.38 /
# GLIBCXX 3.4.32, and bookworm only ships glibc 2.36 — the binary refuses to run
# there. trixie has glibc 2.41. Its node is 20.20.2, matching the version Volta
# pins on the host.
FROM mcr.microsoft.com/devcontainers/typescript-node:20-trixie

# unzip is for the watchman release below; python3/make/g++ are a fallback for
# native modules — sqlite3 normally fetches a prebuilt N-API binary, but the
# toolchain being present means a cache miss degrades to a slow build rather
# than a failed install.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# watchman. `src/packages/fs/watcher` falls back to native fs.watch when
# `which watchman` fails, so the framework works without it — but the
# "class Watcher - client Watchman" test asserts a real watchman client, and the
# 552-passing suite is this project's main gate. Not packaged for Debian, so use
# Meta's prebuilt release.
ARG WATCHMAN_VERSION=v2026.07.13.00
RUN curl -fsSL -o /tmp/watchman.zip \
        "https://github.com/facebook/watchman/releases/download/${WATCHMAN_VERSION}/watchman-${WATCHMAN_VERSION}-linux.zip" \
    && unzip -q /tmp/watchman.zip -d /tmp \
    && cp /tmp/watchman-${WATCHMAN_VERSION}-linux/bin/* /usr/local/bin/ \
    && cp -r /tmp/watchman-${WATCHMAN_VERSION}-linux/lib/* /usr/local/lib/ \
    && mkdir -p /usr/local/var/run/watchman \
    && chmod 2777 /usr/local/var/run/watchman \
    && rm -rf /tmp/watchman*

# NOTE: Claude Code is installed further down, as the `node` user, via the
# native installer — NOT via the claude-code devcontainer feature. The feature
# installs through global npm, which lands in
# /usr/local/share/npm-global/lib/node_modules owned by root:npm with no group
# write bit, so `claude update` fails with a permission error. The native
# installer puts everything under the user's own $HOME instead.

# pnpm comes from corepack, which honours the `packageManager` field in
# package.json (pnpm@10.34.5) — so the container pins the same version as the
# host without Volta. This also removes the host's VOLTA_FEATURE_PNPM gotcha
# entirely: node here is simply the image's node.
#
# The base image ships its own globally npm-installed pnpm which is newer than
# this project's pin and requires Node >= 22.13 (it imports `node:sqlite`), so it
# hard-crashes on Node 20 and would shadow corepack's shim. Remove it first.
RUN npm uninstall -g pnpm || true \
    && corepack enable

# Without this, corepack interactively prompts before downloading the pinned
# pnpm, which would hang the non-interactive postCreate step.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Pre-create the directories that get named volumes, owned by the non-root user.
# A volume mounted at a path that does not exist in the image comes up
# root-owned, and the clone then fails with "Permission denied" — so the
# conventional workspace root is created here too. It is only a default: if the
# IDE clones somewhere else this is simply unused, and post-create re-checks
# writability at runtime.
RUN mkdir -p \
        /workspaces/lumen \
        /home/node/.claude \
        /home/node/.config/gh \
    && chown -R node:node /workspaces /home/node/.claude /home/node/.config

USER node

# Claude Code, installed natively as the unprivileged user so it can update
# itself. Layout this produces:
#   ~/.local/bin/claude                  launcher symlink
#   ~/.local/share/claude/versions/      the binaries `claude update` replaces
#   ~/.claude/                           auth + config (a named volume, so
#                                        logins survive a rebuild)
# Only the first two matter for updating, and both are plain node-owned image
# directories — nothing here is root-owned, and nothing the updater writes to is
# shadowed by a mount.
#
# The installer refuses to run under sudo on purpose (it would install into
# root's home), which is precisely the failure mode this replaces.
#
# This fetches whatever is current at build time, so a rebuild also refreshes
# the version; `claude update` handles the gap in between. Updates land in the
# image layer, so they reset on rebuild — deliberate, since a rebuild pulls a
# newer version anyway.
RUN curl -fsSL https://claude.ai/install.sh | bash

# The installer appends this to the shell rc files, which non-interactive
# lifecycle commands (postCreateCommand) and some IDE terminals do not source.
# Setting it here makes `claude` resolvable in every context.
ENV PATH="/home/node/.local/bin:${PATH}"

# Cache the project's pinned pnpm as node's corepack default. Inside the repo
# corepack reads `packageManager` and gets this anyway; OUTSIDE it (e.g. running
# `pnpm` from $HOME) corepack otherwise fetches the newest pnpm, which requires
# Node >= 22.13 and dies with a confusing `No such built-in module: node:sqlite`.
# Pinning the fallback turns that into a working command.
RUN corepack prepare pnpm@10.34.5 --activate
