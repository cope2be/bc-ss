#!/bin/sh

if !command -v clang &> /dev/null; then
  echo "clang isn't installed"
  exit 1
fi

root=$(cd -- "$(dirname -- "$0")/.." && pwd -P)

clang \
  --target=wasm32 \
  -nostdlib \
  -Wl,--no-entry \
  -Wl,--export=seek_seed \
  -Wl,--export=get_seed_begin \
  -Wl,--export=get_seed_end \
  -Wl,--export=get_found_seeds \
  -Wl,--export=get_run \
  -O3 \
  -o "${root}/docs/seeker.wasm" \
  "${root}/src/Seeker-VampireFlower.c"
