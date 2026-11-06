#!/usr/bin/env bash
# Vérifie que le numéro ?v= d'index.html a changé pour chaque fichier modifié
# (sinon les téléphones gardent l'ancienne version en mémoire).
#
#   .github/check-version.sh <commit de référence>
#
# Lancé par GitHub Actions (voir workflows/tests.yml) ; marche aussi en local,
# par exemple : .github/check-version.sh origin/main
set -euo pipefail

BASE="${1:-}"
FILES=(css/easyroute.css js/easyroute.js js/qrcode.js)

if [ -z "$BASE" ] || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "Pas de version de référence : contrôle ignoré."
  exit 0
fi

# Numéro de version d'un fichier dans un index.html lu sur l'entrée standard
version() { grep -o "\"$1?v=[^\"]*\"" | head -1 || true; }

fail=0
for f in "${FILES[@]}"; do
  if git diff --quiet "$BASE" HEAD -- "$f"; then continue; fi
  old=$(git show "$BASE:index.html" 2>/dev/null | version "$f")
  new=$(version "$f" < index.html)
  if [ -z "$new" ]; then
    echo "::error file=index.html::$f a changé, mais index.html ne le charge pas avec un numéro ?v=."
    fail=1
  elif [ "$old" = "$new" ]; then
    echo "::error file=index.html::$f a changé, mais pas son numéro ?v= dans index.html (toujours ${new//\"/}). Changez-le, par exemple avec la date du jour."
    fail=1
  else
    echo "OK : $f, ${old//\"/} → ${new//\"/}"
  fi
done

if [ "$fail" = 0 ]; then echo "Numéros ?v= à jour."; fi
exit "$fail"
