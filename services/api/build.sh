#!/bin/bash
# Build script that works regardless of terminal state
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
ESBUILD="$DIR/node_modules/.bin/esbuild"
if [ ! -x "$ESBUILD" ]; then
  ESBUILD="$DIR/node_modules/@esbuild/darwin-arm64/bin/esbuild"
fi
"$ESBUILD" src/lambda.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/lambda.js \
  --external:pg-native \
  --external:@aws-sdk/client-sns \
  --minify
echo "Built: $DIR/dist/lambda.js"
ls -lh "$DIR/dist/lambda.js"
