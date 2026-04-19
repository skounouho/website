#!/usr/bin/env bash
# Start the devcontainer and drop into a zsh shell inside it.
# Usage:
#   ./.devcontainer/start.sh              # up + shell
#   ./.devcontainer/start.sh --rebuild    # force a clean rebuild first
#   ./.devcontainer/start.sh --up-only    # start without opening a shell
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REBUILD=0
SHELL_AFTER_UP=1
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --up-only) SHELL_AFTER_UP=0 ;;
    -h|--help)
      sed -n '2,6p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

command -v docker >/dev/null || { echo "Docker not found. Install Docker Desktop." >&2; exit 1; }
command -v devcontainer >/dev/null || { echo "devcontainer CLI not found. Install with: npm i -g @devcontainers/cli" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker daemon is not running. Start Docker Desktop." >&2; exit 1; }

UP_ARGS=(--workspace-folder "$REPO_ROOT")
[[ "$REBUILD" == 1 ]] && UP_ARGS+=(--remove-existing-container)

echo "Starting devcontainer in $REPO_ROOT ..."
devcontainer up "${UP_ARGS[@]}"

if [[ "$SHELL_AFTER_UP" == 1 ]]; then
  echo "Opening shell. Type 'exit' to leave the container."
  exec devcontainer exec --workspace-folder "$REPO_ROOT" zsh
fi
