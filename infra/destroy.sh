#!/bin/bash
# ============================================================
# SalesFAST 7 — Destroy All Stacks
# Removes CRM + AI stacks and all associated resources
#
# USAGE:
#   bash destroy.sh
#   bash destroy.sh --region ap-southeast-7
#   bash destroy.sh --stack salesfast7-prod --region ap-southeast-1
#
# ⚠️  WARNING: This will DELETE everything including:
#     - Database (RDS) and all data
#     - S3 buckets and all files
#     - Lambda functions
#     - CloudFront distribution
#     - DynamoDB tables
#     - All AI resources
# ============================================================

set -e

STACK_NAME="salesfast7-prod"
AI_STACK_NAME="salesfast7-ai-prod"
ENV="prod"
REGION="ap-southeast-1"
AI_REGION="ap-southeast-1"
SKIP_CONFIRM=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack)      STACK_NAME="$2";     shift 2 ;;
    --region)     REGION="$2";         shift 2 ;;
    --ai-region)  AI_REGION="$2";      shift 2 ;;
    --yes|-y)     SKIP_CONFIRM="yes";  shift ;;
    --help|-h)
      echo ""
      echo "SalesFAST 7 — Destroy All Stacks"
      echo ""
      echo "OPTIONS:"
      echo "  --stack     <name>    Stack name (default: salesfast7-prod)"
      echo "  --region    <region>  CRM region (default: ap-southeast-1)"
      echo "  --ai-region <region>  AI region (default: ap-southeast-1)"
      echo "  --yes, -y             Skip confirmation prompt"
      echo ""
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

AI_STACK_NAME="${STACK_NAME}-ai"
[ "$STACK_NAME" = "salesfast7-prod" ] && AI_STACK_NAME="salesfast7-ai-prod"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")

echo ""
echo "============================================"
echo "  SalesFAST 7 — DESTROY"
echo "============================================"
echo ""
echo "  CRM Stack:  $STACK_NAME ($REGION)"
echo "  AI Stack:   $AI_STACK_NAME ($AI_REGION)"
echo "  Account:    $ACCOUNT_ID"
echo ""
echo "  ⚠️  This will PERMANENTLY DELETE:"
echo "     - RDS database and all data"
echo "     - S3 buckets and all files"
echo "     - Lambda functions"
echo "     - CloudFront distribution"
echo "     - DynamoDB tables"
echo "     - All AI resources (KB bucket, IAM roles)"
echo ""

if [ "$SKIP_CONFIRM" != "yes" ]; then
  read -p "  Type 'destroy' to confirm: " CONFIRM
  if [ "$CONFIRM" != "destroy" ]; then
    echo "  Aborted."
    exit 0
  fi
fi

echo ""

# ── Helper: get stack output ──
_get() {
  aws cloudformation describe-stacks \
    --stack-name "$1" --region "$2" \
    --query "Stacks[0].Outputs[?OutputKey=='$3'].OutputValue" \
    --output text 2>/dev/null || echo ""
}

# ══════════════════════════════════════════════════════════
# Step 1: Disable RDS deletion protection
# ══════════════════════════════════════════════════════════

echo "[1/6] Disabling RDS deletion protection..."
aws rds modify-db-instance \
  --db-instance-identifier "sf7-${ENV}" \
  --no-deletion-protection \
  --region "$REGION" 2>/dev/null || echo "  (skipped — RDS not found or already removed)"

# ══════════════════════════════════════════════════════════
# Step 2: Empty S3 buckets (required before stack delete)
# ══════════════════════════════════════════════════════════

echo "[2/6] Emptying S3 buckets..."

FRONTEND_BUCKET=$(_get "$STACK_NAME" "$REGION" "FrontendBucket")
FILES_BUCKET=$(_get "$STACK_NAME" "$REGION" "FilesBucket")
KB_BUCKET=$(_get "$AI_STACK_NAME" "$AI_REGION" "KBBucketName")

for BUCKET in "$FRONTEND_BUCKET" "sf7-${ENV}-files-${ACCOUNT_ID}" "$FILES_BUCKET" "$KB_BUCKET"; do
  if [ -n "$BUCKET" ] && [ "$BUCKET" != "None" ] && [ "$BUCKET" != "" ]; then
    echo "  Emptying s3://$BUCKET ..."
    aws s3 rm "s3://$BUCKET" --recursive --region "$REGION" 2>/dev/null || true
  fi
done
echo "  Buckets emptied."

# ══════════════════════════════════════════════════════════
# Step 3: Cancel CloudFront Pro Plan (if subscribed)
# ══════════════════════════════════════════════════════════

echo "[3/6] Note: If CloudFront Pro Plan is subscribed,"
echo "  cancel it manually in Console BEFORE deleting distribution."
echo "  Console > CloudFront > Distribution > Cancel pricing plan"

# ══════════════════════════════════════════════════════════
# Step 4: Delete AI Stack
# ══════════════════════════════════════════════════════════

echo "[4/6] Deleting AI stack ($AI_STACK_NAME)..."
aws cloudformation delete-stack \
  --stack-name "$AI_STACK_NAME" \
  --region "$AI_REGION" 2>/dev/null || echo "  (AI stack not found)"

aws cloudformation wait stack-delete-complete \
  --stack-name "$AI_STACK_NAME" \
  --region "$AI_REGION" 2>/dev/null || true
echo "  AI stack deleted."

# ══════════════════════════════════════════════════════════
# Step 5: Delete CRM Stack
# ══════════════════════════════════════════════════════════

echo "[5/6] Deleting CRM stack ($STACK_NAME)..."
echo "  (this takes 10-15 minutes — RDS deletion is slow)"
aws cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION" 2>/dev/null || echo "  (CRM stack not found)"

aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION" 2>/dev/null || true
echo "  CRM stack deleted."

# ══════════════════════════════════════════════════════════
# Step 6: Cleanup leftover S3 buckets (if stack delete missed them)
# ══════════════════════════════════════════════════════════

echo "[6/6] Cleaning up leftover resources..."
for BUCKET in "$FRONTEND_BUCKET" "sf7-${ENV}-files-${ACCOUNT_ID}" "$FILES_BUCKET" "$KB_BUCKET"; do
  if [ -n "$BUCKET" ] && [ "$BUCKET" != "None" ] && [ "$BUCKET" != "" ]; then
    aws s3 rb "s3://$BUCKET" --force --region "$REGION" 2>/dev/null || true
  fi
done
echo "  Cleanup done."

echo ""
echo "============================================"
echo "  SalesFAST 7 — Destroyed"
echo "============================================"
echo ""
echo "  All resources have been removed."
echo "  To redeploy: bash deploy.sh --email ... --name ... --password ... --db-pass auto --tenant ..."
echo ""
