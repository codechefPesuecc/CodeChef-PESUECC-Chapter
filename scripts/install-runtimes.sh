#!/usr/bin/env sh
# Install the language runtimes CP Arena needs into the running Piston container.
# Run once after `docker compose up` (Piston stores packages on a volume, so this
# only needs re-running if that volume is removed).
#
#   ./scripts/install-runtimes.sh
#
# List everything Piston can install:  curl "$PISTON_URL/api/v2/packages"
set -e

PISTON="${PISTON_URL:-http://localhost:2000}"

install() {
  echo "Installing $1 $2 ..."
  curl -s -X POST "$PISTON/api/v2/packages" \
    -H 'Content-Type: application/json' \
    -d "{\"language\":\"$1\",\"version\":\"$2\"}"
  echo
}

# Versions available in Piston's public package index.
install gcc 10.2.0     # C / C++
install python 3.12.0  # Python
install java 15.0.2    # Java

echo "Done. Installed runtimes:"
curl -s "$PISTON/api/v2/runtimes"
echo
