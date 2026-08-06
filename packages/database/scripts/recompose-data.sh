#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../seed-data/traffic-tickets"

recompose() {
  local output="$1"
  shift
  local parts=( "$@" )

  if [ ${#parts[@]} -eq 0 ]; then
    echo "ERRO: nenhuma parte encontrada para $(basename "$output")"
    return 1
  fi

  if [ -f "$output" ]; then
    echo "SKIP: $(basename "$output") (ja existe)"
    return
  fi

  echo "RECOMPOSE: $(basename "$output") (${#parts[@]} partes)"
  cat "${parts[@]}" > "$output"
  echo "            -> $(du -h "$output" | cut -f1)"
}

echo "=== Recomposicao de arquivos splitados ==="
echo ""

recompose "$DATA_DIR/traffic-tickets-compiled.tsv" \
          "$DATA_DIR"/traffic-tickets-compiled.tsv.part[0-9][0-9]

recompose "$DATA_DIR/location-descriptions.tsv" \
          "$DATA_DIR"/location-descriptions.tsv.part[0-9][0-9]

echo ""
echo "OK."
