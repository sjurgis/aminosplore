#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (GitHub Pages "deploy from branch").
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
rev=$(git rev-parse --short HEAD)
tmp=$(mktemp -d)
cp -r dist/. "$tmp"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name || echo deploy)" -c user.email="$(git -C "$OLDPWD" config user.email || echo deploy@localhost)" commit -qm "Deploy $rev"
git push -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
rm -rf "$tmp"
