#!/usr/bin/env bash
# Sets the app version in the four files that have to agree. Tauri reads
# tauri.conf.json, cargo reads Cargo.toml, and Cargo.lock has to follow or the
# next build rewrites it and leaves the tree dirty.
set -euo pipefail

VERSION="${1:?usage: bump-version.sh <version>}"
cd "$(dirname "$0")/../.."

node -e '
  const fs = require("fs");
  const version = process.argv[1];
  for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    config.version = version;
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  }
' "$VERSION"

# Scoped to [package] so a dependency's own `version =` is never touched.
sed -i "/^\[package\]/,/^\[/ s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# The lockfile entry is found by the name on the line before the version.
sed -i "/^name = \"portbaba\"$/{n;s/^version = \".*\"/version = \"$VERSION\"/;}" src-tauri/Cargo.lock
