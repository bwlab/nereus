#!/usr/bin/env bash
# Sync Design System bwlab v2 da astro-primereact a claudecodeui.
# Copia design-tokens.css e design-primitives.css.
# shadcn-compat.css resta manuale: se DS cambia i valori HEX delle surface/fg/
# accent, aggiornare a mano le HSL-triple in src/styles/shadcn-compat.css.

set -euo pipefail

DS="/media/extra/Progetti/astrojs-primereact/CascadeProjects/windsurf-project/astro-primereact/src/styles"
DEST="$(cd "$(dirname "$0")/.." && pwd)/src/styles"

if [[ ! -d "$DS" ]]; then
  echo "ERRORE: DS non trovato in $DS" >&2
  exit 1
fi

cp "$DS/design-tokens.css" "$DEST/design-tokens.css"
cp "$DS/design-primitives.css" "$DEST/design-primitives.css"

echo "DS sync completato."
echo "Ricordati di verificare shadcn-compat.css se sono cambiate le surface-*/fg-*/accent-*."
