#!/bin/sh
set -eu
cd "$1"

# Hash the complete app before rewriting it: changing an imported module must
# also invalidate its entry point. Vendor modules keep their existing URLs.
version=$(cat css/*.css js/*.js | sha256sum | cut -c1-12)
for file in css/*.css js/*.js; do
  path_pattern=$(printf '%s' "$file" | sed 's/\./\\./g')
  # Cover attributes, import maps, static imports and dynamic import() in HTML,
  # including the single-quoted ./js/clay-farm.js entry point.
  sed -i -E "s#([\"'])(\./)?${path_pattern}([\"'])#\1\2${file}?v=${version}\3#g" ./*.html
done
for file in js/*.js; do
  name=${file#js/}
  name_pattern=$(printf '%s' "$name" | sed 's/\./\\./g')
  sed -i -E "s#([\"'])\./${name_pattern}([\"'])#\1./${name}?v=${version}\2#g" js/*.js
done
printf 'Site asset version: %s\n' "$version"
