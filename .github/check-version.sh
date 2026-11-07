#!/usr/bin/env bash
# Vérifie que les numéros ?v= d'index.html ont changé pour chaque fichier modifié
# (sinon les téléphones gardent l'ancienne version en mémoire).
#
#   .github/check-version.sh <commit de référence>
#
# - css/easyroute.css et js/qrcode.js ont chacun leur numéro.
# - Les modules js/*.js (main.js et ce qu'il importe) partagent un seul numéro :
#   celui de js/main.js, repris par chaque module dans l'import map d'index.html.
#   Si l'un d'eux change, ce numéro commun doit changer.
#
# Lancé par GitHub Actions (voir workflows/tests.yml) ; marche aussi en local,
# par exemple : .github/check-version.sh origin/main
set -euo pipefail

BASE="${1:-}"
FILES=(css/easyroute.css js/qrcode.js)

# Numéro de version d'un fichier dans un index.html lu sur l'entrée standard
version() { grep -o "\"$1?v=[^\"]*\"" | head -1 || true; }
# Numéro seul (sans le nom du fichier ni les guillemets)
number() { sed -e 's/.*?v=//' -e 's/"$//'; }

fail=0

# Toujours : chaque module figure dans l'import map, avec le même numéro que js/main.js
common=$(version js/main.js < index.html | number)
if [ -z "$common" ]; then
  echo "::error file=index.html::index.html ne charge pas js/main.js avec un numéro ?v=."
  fail=1
else
  for f in js/*.js; do
    case "$f" in js/qrcode.js|js/main.js) continue ;; esac
    if ! grep -q "\"./$f\": *\"./$f?v=$common\"" index.html; then
      echo "::error file=index.html::$f doit figurer dans l'import map d'index.html avec le numéro de js/main.js : \"./$f\": \"./$f?v=$common\"."
      fail=1
    fi
  done
fi

if [ -z "$BASE" ] || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "Pas de version de référence : comparaison ignorée."
  exit "$fail"
fi

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

# Modules : un fichier js/*.js modifié, ajouté ou supprimé (hors qrcode.js) demande un nouveau numéro commun
changed=$(git diff --name-only "$BASE" HEAD -- 'js/*.js' | grep -v '^js/qrcode\.js$' || true)
if [ -n "$changed" ] && [ -n "$common" ]; then
  baseindex=$(git show "$BASE:index.html" 2>/dev/null || true)
  old=$(version js/main.js <<< "$baseindex" | number)
  [ -n "$old" ] || old=$(version js/easyroute.js <<< "$baseindex" | number) # avant le découpage en modules
  if [ "$old" = "$common" ]; then
    echo "::error file=index.html::Modules modifiés ($(echo $changed | tr ' ' ',')), mais pas leur numéro commun ?v= dans index.html (toujours $common). Changez-le pour js/main.js et dans toute l'import map, par exemple avec la date du jour."
    fail=1
  else
    echo "OK : modules js/ (${changed//$'\n'/, }), ?v=${old:-aucun} → ?v=$common"
  fi
fi

if [ "$fail" = 0 ]; then echo "Numéros ?v= à jour."; fi
exit "$fail"
