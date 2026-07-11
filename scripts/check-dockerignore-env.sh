#!/usr/bin/env bash
# Verify Docker excludes local env files from the build context.
set -euo pipefail
cd "$(dirname "$0")/.."

tmpdir="$(mktemp -d)"
control_tag="fs-dockerignore-canary-$$"
docker_build=(env DOCKER_BUILDKIT=0 docker build)
cleanup() {
  docker image rm -f "$control_tag" >/dev/null 2>&1 || true
  rm -rf "$tmpdir"
}
trap cleanup EXIT

context="$tmpdir/context"
dockerfile="$tmpdir/Dockerfile"

mkdir -p "$context/frontend"
cp .dockerignore "$context/.dockerignore"

printf 'CANARY_CONTEXT=1\n' > "$context/keep.txt"
printf 'DOCKERIGNORE_CANARY=1\n' > "$context/.env"
printf 'DOCKERIGNORE_CANARY=1\n' > "$context/.env.local"
printf 'DOCKERIGNORE_CANARY=1\n' > "$context/frontend/.env"
printf 'DOCKERIGNORE_CANARY=1\n' > "$context/frontend/.env.production"

printf 'FROM scratch\nCOPY keep.txt /keep.txt\n' > "$dockerfile"
"${docker_build[@]}" -q -f "$dockerfile" -t "$control_tag" "$context" >/dev/null

for path in .env .env.local frontend/.env frontend/.env.production; do
  printf 'FROM scratch\nCOPY %s /leaked-env-file\n' "$path" > "$dockerfile"
  if "${docker_build[@]}" -q -f "$dockerfile" "$context" >/dev/null 2>"$tmpdir/docker-build.err"; then
    echo "BLOCKED: $path was included in the Docker build context." >&2
    exit 1
  fi
  if ! grep -Eq 'not found|excluded by \.dockerignore|no source files were specified|no such file or directory|file does not exist' "$tmpdir/docker-build.err"; then
    echo "BLOCKED: Docker ignore canary failed while checking $path:" >&2
    cat "$tmpdir/docker-build.err" >&2
    exit 1
  fi
done
