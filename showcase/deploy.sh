#!/usr/bin/env bash
# Deploys the three public Unite showcase sites to Vercel with the Vercel CLI (signed in).
#   unite-overview   showcase/overview   static page + walkthrough videos (from the showcase-media branch)
#   unite-assemblies redesign/           the host-scoped Unite app, in demo mode (no database)
#   common-picture   common-picture/     the Common Picture demonstration
# Usage: showcase/deploy.sh [overview|assemblies|common-picture ...]   (no args = all three)
# Run from anywhere inside a checkout of the claude/unite-showcase branch. Idempotent.
set -euo pipefail

SCOPE="jesse-wrights-projects-776f60ef"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
VERCEL="vercel"
command -v vercel >/dev/null 2>&1 || VERCEL="npx --yes vercel@latest"
TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(assemblies common-picture overview)

log() { printf '\n=== %s\n' "$*"; }

# Adds an env var to production only if it is not already there.
ensure_env() { # project-dir key value
  local dir="$1" key="$2" value="$3"
  if (cd "$dir" && $VERCEL env ls production --scope "$SCOPE" 2>/dev/null | grep -qE "^\s*$key\s"); then
    echo "env $key already set"
  else
    (cd "$dir" && printf '%s' "$value" | $VERCEL env add "$key" production --scope "$SCOPE" >/dev/null) && echo "env $key added"
  fi
}

# Creates a private Blob store for the project and connects it, if the CLI supports it and none exists.
ensure_blob() { # project-dir store-name
  local dir="$1" name="$2"
  if (cd "$dir" && $VERCEL env ls production --scope "$SCOPE" 2>/dev/null | grep -q BLOB_READ_WRITE_TOKEN); then
    echo "Blob store already connected"; return 0
  fi
  if (cd "$dir" && $VERCEL blob --help >/dev/null 2>&1); then
    (cd "$dir" && { $VERCEL blob store add "$name" --access private --scope "$SCOPE" --yes 2>&1 \
      || $VERCEL blob create-store "$name" --access private --scope "$SCOPE" --yes 2>&1; } ) \
      || echo "WARNING: could not create the Blob store from the CLI; create a private one in the dashboard (Storage) and connect it to $name"
  else
    echo "WARNING: this CLI has no 'blob' command; create a private Blob store in the dashboard and connect it"
  fi
}

public() { # project
  $VERCEL project protection disable "$1" --sso --scope "$SCOPE" >/dev/null 2>&1 \
    && echo "Vercel Authentication off for $1" \
    || echo "NOTE: could not change protection from the CLI; production *.vercel.app domains are public by default"
}

for t in "${TARGETS[@]}"; do
  case "$t" in
    assemblies)
      log "unite-assemblies (redesign/)"
      cd "$ROOT/redesign"
      $VERCEL link --yes --project unite-assemblies --scope "$SCOPE"
      ensure_env . UNITE_DEMO 1
      ensure_env . UNITE_SECRET "$(openssl rand -base64 32 | tr -d '\n')"
      ensure_env . VITE_OVERVIEW_URL "https://unite-overview.vercel.app/#unite"
      ensure_blob . unite-assemblies-feedback
      $VERCEL deploy --prod --yes --scope "$SCOPE"
      public unite-assemblies
      ;;
    common-picture)
      log "common-picture (common-picture/)"
      cd "$ROOT/common-picture"
      $VERCEL link --yes --project common-picture --scope "$SCOPE"
      ensure_env . VITE_OVERVIEW_URL "https://unite-overview.vercel.app/#common-picture"
      ensure_blob . common-picture-feedback
      $VERCEL deploy --prod --yes --scope "$SCOPE"
      public common-picture
      ;;
    overview)
      log "unite-overview (showcase/overview + videos)"
      MEDIA="$(mktemp -d)"
      git clone -q --depth 1 -b showcase-media https://github.com/jeswr/unite "$MEDIA"
      cp "$MEDIA"/*.mp4 "$MEDIA"/*.vtt "$ROOT/showcase/overview/media/" 2>/dev/null || true
      cp "$MEDIA"/*.jpg "$ROOT/showcase/overview/media/" 2>/dev/null || true
      rm -rf "$MEDIA"
      cd "$ROOT/showcase/overview"
      $VERCEL link --yes --project unite-overview --scope "$SCOPE"
      $VERCEL deploy --prod --yes --scope "$SCOPE"
      public unite-overview
      ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
done

log "checks"
for u in https://unite-overview.vercel.app/ https://unite-overview.vercel.app/media/unite-walkthrough.mp4 \
         https://unite-assemblies.vercel.app/ https://unite-assemblies.vercel.app/healthz \
         https://common-picture.vercel.app/ https://common-picture.vercel.app/picture; do
  printf '%s  %s\n' "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$u")" "$u"
done
