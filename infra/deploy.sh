#!/bin/bash
# ============================================================
# SalesFAST 7 — Deploy via CloudShell
# Run this script in AWS CloudShell
# ============================================================

set -e

# ── Config ──
STACK_NAME="salesfast7-prod"
REGION="${AWS_REGION:-ap-southeast-7}"
ENV="prod"

echo "============================================"
echo "  SalesFAST 7 — Deployment"
echo "  Region: $REGION"
echo "  Stack:  $STACK_NAME"
echo "============================================"
echo ""

# ── Step 1: Get parameters ──
if [ -z "$DB_PASSWORD" ]; then
  read -sp "Enter DB password (min 8 chars): " DB_PASSWORD
  echo ""
fi
if [ -z "$JWT_SECRET" ]; then
  read -sp "Enter JWT secret (min 16 chars): " JWT_SECRET
  echo ""
fi

echo ""
echo "[1/5] Deploying CloudFormation stack..."

# ── Step 2: Deploy CloudFormation ──
aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="$ENV" \
    DBPassword="$DB_PASSWORD" \
    JWTSecret="$JWT_SECRET" \
  --no-fail-on-empty-changeset

echo "[1/5] Stack deployed."

# ── Step 3: Get outputs ──
echo "[2/5] Getting stack outputs..."

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucket'].OutputValue" \
  --output text)

FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text)

DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" \
  --output text)

echo "  API:      $API_URL"
echo "  Frontend: $FRONTEND_URL"
echo "  DB:       $DB_ENDPOINT"

# ── Step 4: Upload frontend to S3 ──
echo "[3/5] Uploading frontend to S3..."

if [ -d "../frontend" ]; then
  FRONTEND_DIR="../frontend"
elif [ -d "frontend" ]; then
  FRONTEND_DIR="frontend"
else
  echo "  Frontend directory not found. Skipping upload."
  FRONTEND_DIR=""
fi

if [ -n "$FRONTEND_DIR" ]; then
  aws s3 sync "$FRONTEND_DIR" "s3://$FRONTEND_BUCKET" \
    --region "$REGION" \
    --delete \
    --cache-control "max-age=3600" \
    --exclude ".DS_Store"

  # Set correct content types
  aws s3 cp "s3://$FRONTEND_BUCKET" "s3://$FRONTEND_BUCKET" \
    --recursive \
    --region "$REGION" \
    --content-type "text/html" \
    --exclude "*" --include "*.html" \
    --metadata-directive REPLACE

  aws s3 cp "s3://$FRONTEND_BUCKET" "s3://$FRONTEND_BUCKET" \
    --recursive \
    --region "$REGION" \
    --content-type "text/css" \
    --exclude "*" --include "*.css" \
    --metadata-directive REPLACE

  aws s3 cp "s3://$FRONTEND_BUCKET" "s3://$FRONTEND_BUCKET" \
    --recursive \
    --region "$REGION" \
    --content-type "application/javascript" \
    --exclude "*" --include "*.js" \
    --metadata-directive REPLACE

  echo "  Frontend uploaded."
fi

# ── Step 5: Initialize database ──
echo "[4/5] Database initialization..."
echo "  DB endpoint: $DB_ENDPOINT"
echo ""
echo "  To initialize the database, run these commands:"
echo "  (You need psql client or connect via RDS Query Editor)"
echo ""
echo "  psql -h $DB_ENDPOINT -U salesfast7 -d salesfast7 < database/schema.sql"
echo "  psql -h $DB_ENDPOINT -U salesfast7 -d salesfast7 < database/seed.sql"
echo ""

# ── Done ──
echo "[5/5] Deployment complete!"
echo ""
echo "============================================"
echo "  SalesFAST 7 — Deployed!"
echo "============================================"
echo ""
echo "  Frontend:  $FRONTEND_URL"
echo "  API:       $API_URL"
echo "  Database:  $DB_ENDPOINT"
echo ""
echo "  Default login: admin@salesfast7.com / Admin@1234"
echo ""
echo "  Next steps:"
echo "  1. Initialize database (schema.sql + seed.sql)"
echo "  2. Deploy Lambda code (replace placeholder functions)"
echo "  3. (Optional) Set up CloudFront for custom domain"
echo "============================================"
