#!/bin/bash
# ============================================================
# SalesFAST 7 — Build & Deploy NestJS Services to Lambda
#
# Builds each service, creates Lambda deployment package,
# and uploads to the corresponding Lambda function.
#
# USAGE:
#   bash deploy-services.sh [--region ap-southeast-1] [--env prod]
#
# Run this after deploy.sh to upload actual service code.
# deploy.sh creates Lambda placeholders; this replaces them
# with real NestJS code.
# ============================================================

set -e

REGION="${1:-ap-southeast-1}"
ENV="${2:-prod}"

# Service name → Lambda function name mapping
declare -A SERVICES
SERVICES=(
  ["auth-service"]="sf7-${ENV}-auth"
  ["crm-service"]="sf7-${ENV}-crm"
  ["sales-service"]="sf7-${ENV}-sales"
  ["quotation-service"]="sf7-${ENV}-quotation"
  ["notification-service"]="sf7-${ENV}-notification"
)

# Find project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================"
echo "  SalesFAST 7 — Deploy Services to Lambda"
echo "============================================"
echo "  Region: $REGION"
echo "  Root:   $PROJECT_ROOT"
echo ""

# Install root dependencies if needed
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo "Installing root dependencies..."
  (cd "$PROJECT_ROOT" && npm install --silent)
fi

# Build shared packages first
echo "[0] Building shared packages..."
for PKG in shared-types utils; do
  if [ -f "$PROJECT_ROOT/packages/$PKG/package.json" ]; then
    (cd "$PROJECT_ROOT/packages/$PKG" && npm run build --silent 2>/dev/null || true)
  fi
done
echo "  Shared packages built."
echo ""

# Build and deploy each service
TOTAL=${#SERVICES[@]}
COUNT=0

for SVC in "${!SERVICES[@]}"; do
  COUNT=$((COUNT + 1))
  FN_NAME="${SERVICES[$SVC]}"
  SVC_DIR="$PROJECT_ROOT/services/$SVC"

  echo "[$COUNT/$TOTAL] $SVC → $FN_NAME"

  # Build
  echo "  Building..."
  (cd "$SVC_DIR" && npm run build --silent 2>&1 | tail -1) || {
    echo "  ⚠️ Build failed for $SVC — skipping"
    continue
  }

  if [ ! -d "$SVC_DIR/dist" ]; then
    echo "  ⚠️ No dist/ directory — skipping"
    continue
  fi

  # Create Lambda handler wrapper
  # NestJS needs a Lambda adapter to work with API Gateway
  cat > "$SVC_DIR/dist/lambda.js" << 'LAMBDA_HANDLER'
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');
const serverlessExpress = require('@codegenie/serverless-express');
const express = require('express');

let cachedServer;

async function bootstrap() {
  if (cachedServer) return cachedServer;

  const expressApp = express();
  const app = await NestFactory.create(
    require('./app.module').AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'] }
  );

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') || ['*'], credentials: true });

  await app.init();
  cachedServer = serverlessExpress({ app: expressApp });
  return cachedServer;
}

exports.handler = async (event, context) => {
  const server = await bootstrap();
  return server(event, context);
};
LAMBDA_HANDLER

  # Create deployment package
  echo "  Packaging..."
  DEPLOY_DIR=$(mktemp -d)
  cp -r "$SVC_DIR/dist/"* "$DEPLOY_DIR/"
  cp "$SVC_DIR/package.json" "$DEPLOY_DIR/"

  # Install production dependencies + Lambda adapter
  (cd "$DEPLOY_DIR" && npm install --production --silent 2>/dev/null)
  (cd "$DEPLOY_DIR" && npm install @codegenie/serverless-express express --silent 2>/dev/null)

  # Also copy workspace dependencies
  for DEP in shared-types utils; do
    if [ -d "$PROJECT_ROOT/packages/$DEP/dist" ]; then
      mkdir -p "$DEPLOY_DIR/node_modules/@thai-smb-crm/$DEP"
      cp -r "$PROJECT_ROOT/packages/$DEP/dist/"* "$DEPLOY_DIR/node_modules/@thai-smb-crm/$DEP/" 2>/dev/null || true
      cp "$PROJECT_ROOT/packages/$DEP/package.json" "$DEPLOY_DIR/node_modules/@thai-smb-crm/$DEP/" 2>/dev/null || true
    fi
  done

  # Zip
  ZIP_FILE="/tmp/sf7-${SVC}.zip"
  (cd "$DEPLOY_DIR" && zip -qr "$ZIP_FILE" .)
  ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
  echo "  Package: $ZIP_SIZE"

  # Check size (Lambda limit: 50MB zipped, 250MB unzipped)
  ZIP_BYTES=$(wc -c < "$ZIP_FILE" | tr -d ' ')
  if [ "$ZIP_BYTES" -gt 52428800 ]; then
    echo "  ⚠️ Package too large ($ZIP_SIZE) — Lambda limit is 50MB"
    echo "  Consider using Lambda container image instead"
    rm -rf "$DEPLOY_DIR"
    continue
  fi

  # Upload to Lambda
  echo "  Deploying to Lambda..."
  aws lambda update-function-code \
    --function-name "$FN_NAME" \
    --zip-file "fileb://$ZIP_FILE" \
    --region "$REGION" > /dev/null 2>&1

  aws lambda wait function-updated \
    --function-name "$FN_NAME" \
    --region "$REGION" 2>/dev/null || sleep 5

  # Update handler to use lambda.handler
  aws lambda update-function-configuration \
    --function-name "$FN_NAME" \
    --handler "lambda.handler" \
    --region "$REGION" > /dev/null 2>&1

  aws lambda wait function-updated \
    --function-name "$FN_NAME" \
    --region "$REGION" 2>/dev/null || sleep 5

  echo "  ✅ $SVC deployed."

  # Cleanup
  rm -rf "$DEPLOY_DIR"
  rm -f "$ZIP_FILE"
  echo ""
done

echo "============================================"
echo "  All services deployed!"
echo "============================================"
echo ""
echo "  Test: curl \$(aws cloudformation describe-stacks --stack-name salesfast7-prod --region $REGION --query \"Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue\" --output text)/auth/login"
