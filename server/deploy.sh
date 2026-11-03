#!/bin/bash
# Publica en Urpilandia la rama indicada en ~/.bisontesdux-branch.
set -euo pipefail
umask 022

REPO="$HOME/bisontesdux-web"
WEB=/var/www/bisontesdux
BRANCH="$(cat "$HOME/.bisontesdux-branch" 2>/dev/null || echo main)"
MARKER="$WEB/bisontes-deploy.json"
BUILD_NOW=false
LOCAL_BUILD=false
FORCE=false
COMMIT_OVERRIDE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --build) BUILD_NOW=true ;;
    --local-build) BUILD_NOW=true; LOCAL_BUILD=true ;;
    --force) FORCE=true ;;
    --commit) shift; COMMIT_OVERRIDE="${1:-}" ;;
    *) echo "Uso: $0 [--build|--local-build] [--commit SHA] [--force]" >&2; exit 64 ;;
  esac
  shift
done

if "$LOCAL_BUILD" && ! [[ "$COMMIT_OVERRIDE" =~ ^[0-9a-f]{40}$ ]]; then
  echo "--local-build requiere --commit SHA" >&2
  exit 64
fi

# El temporizador y una publicación inmediata pueden coincidir. Una sola
# ejecución escribe la web cada vez, evitando archivos a medio copiar.
exec 9>/tmp/bisontesdux-publish.lock
flock 9

write_marker() {
  local commit parent deployed_at temporary
  commit="${COMMIT_OVERRIDE:-$(git rev-parse HEAD)}"
  # En una publicación inmediata el commit todavía puede no existir en el
  # clon local; en ese caso no inventar un padre para el marcador.
  parent="$(git rev-parse --verify "${commit}^" 2>/dev/null || true)"
  deployed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  temporary="$(mktemp "$WEB/.bisontes-deploy.XXXXXX")"
  printf '{"commit":"%s","parent":"%s","branch":"%s","deployed_at":"%s"}\n' "$commit" "$parent" "$BRANCH" "$deployed_at" > "$temporary"
  chmod 0644 "$temporary"
  mv "$temporary" "$MARKER"
}

cd "$REPO"
current="$(git rev-parse HEAD)"
old_api="$(git rev-parse HEAD:server 2>/dev/null || true)"
if ! "$LOCAL_BUILD"; then
  git fetch -q origin "$BRANCH"
  target="$(git rev-parse "origin/$BRANCH")"
  if [ "$current" = "$target" ] && ! "$FORCE" && ! "$BUILD_NOW"; then
    [ -f "$MARKER" ] || write_marker
    exit 0
  fi
  git checkout -q -B "$BRANCH" "origin/$BRANCH"
  git reset -q --hard "origin/$BRANCH"
fi
if "$BUILD_NOW"; then
  # En publicación inmediata el API ya ha escrito los datos en este árbol.
  # Así evitamos esperar a que GitHub esté disponible para el git fetch.
  npm run build
fi
rsync -a --delete \
  --exclude ".git" --exclude ".github" --exclude ".claude" --exclude ".impeccable" \
  --exclude "supabase" --exclude "server" --exclude "scripts" --exclude "node_modules" --exclude "newsletter" \
  --exclude "*.md" --exclude "package.json" --exclude "package-lock.json" --exclude ".gitignore" --exclude ".nojekyll" \
  "$REPO/" "$WEB/"

new_api="$(git rev-parse HEAD:server 2>/dev/null || true)"
if [ "$old_api" != "$new_api" ] || "$FORCE"; then
  sudo -n systemctl restart bisontesdux-api
  for _ in {1..20}; do
    if curl -fsS http://127.0.0.1:8810/api/health >/dev/null; then break; fi
    sleep 0.25
  done
  curl -fsS http://127.0.0.1:8810/api/health >/dev/null
fi

write_marker
echo "$(date -Is) publicado ${COMMIT_OVERRIDE:-$(git rev-parse --short HEAD)} ($BRANCH)"
