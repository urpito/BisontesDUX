#!/bin/bash
# Publica en Urpilandia la rama indicada en ~/.bisontesdux-branch.
set -euo pipefail
umask 022

REPO="$HOME/bisontesdux-web"
WEB=/var/www/bisontesdux
BRANCH="$(cat "$HOME/.bisontesdux-branch" 2>/dev/null || echo main)"
MARKER="$WEB/bisontes-deploy.json"

write_marker() {
  local commit deployed_at temporary
  commit="$(git rev-parse HEAD)"
  deployed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  temporary="$(mktemp "$WEB/.bisontes-deploy.XXXXXX")"
  printf '{"commit":"%s","branch":"%s","deployed_at":"%s"}\n' "$commit" "$BRANCH" "$deployed_at" > "$temporary"
  chmod 0644 "$temporary"
  mv "$temporary" "$MARKER"
}

cd "$REPO"
git fetch -q origin "$BRANCH"
target="$(git rev-parse "origin/$BRANCH")"
current="$(git rev-parse HEAD)"
if [ "$current" = "$target" ] && [ "${1:-}" != "--force" ]; then
  [ -f "$MARKER" ] || write_marker
  exit 0
fi

old_api="$(git rev-parse HEAD:server 2>/dev/null || true)"
git checkout -q -B "$BRANCH" "origin/$BRANCH"
git reset -q --hard "origin/$BRANCH"
rsync -a --delete \
  --exclude ".git" --exclude ".github" --exclude ".claude" --exclude ".impeccable" \
  --exclude "supabase" --exclude "server" --exclude "scripts" --exclude "node_modules" --exclude "newsletter" \
  --exclude "*.md" --exclude "package.json" --exclude "package-lock.json" --exclude ".gitignore" --exclude ".nojekyll" \
  "$REPO/" "$WEB/"

new_api="$(git rev-parse HEAD:server 2>/dev/null || true)"
if [ "$old_api" != "$new_api" ] || [ "${1:-}" = "--force" ]; then
  sudo -n systemctl restart bisontesdux-api
  for _ in {1..20}; do
    if curl -fsS http://127.0.0.1:8810/api/health >/dev/null; then break; fi
    sleep 0.25
  done
  curl -fsS http://127.0.0.1:8810/api/health >/dev/null
fi

write_marker
echo "$(date -Is) publicado $(git rev-parse --short HEAD) ($BRANCH)"
