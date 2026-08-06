#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../seed-data/traffic-tickets"
SPLIT_SIZE="95M"

split_if_needed() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "SKIP: $file (arquivo nao encontrado)"
    return
  fi
  local prefix="${file}.part"
  if ls "${prefix}"[0-9][0-9] >/dev/null 2>&1; then
    echo "SKIP: $file (partes ja existem)"
    return
  fi
  echo "SPLIT: $(basename "$file") ($(du -h "$file" | cut -f1))"
  split -b "$SPLIT_SIZE" -d "$file" "$prefix"
  for p in "${prefix}"[0-9][0-9]; do
    echo "       -> $(basename "$p") ($(du -h "$p" | cut -f1))"
  done
}

echo "=== Split de arquivos grandes para GitHub (< 100 MB) ==="
echo ""

split_if_needed "$DATA_DIR/traffic-tickets-compiled.tsv"
split_if_needed "$DATA_DIR/location-descriptions.tsv"

echo ""
echo "OK."
