#!/bin/bash
# ============================================================
# SalesFAST 7 — Deploy AI Resources (Bedrock Agents + KB)
#
# This deploys AI resources to a Bedrock-supported region.
# Run AFTER the main deploy.sh has completed.
#
# USAGE:
#   bash deploy-ai.sh
#   bash deploy-ai.sh --region ap-southeast-1
#   bash deploy-ai.sh --help
# ============================================================

set -e

STACK_NAME="salesfast7-ai-prod"
ENV="prod"
CRM_STACK="salesfast7-prod"
CRM_REGION="${AWS_REGION:-ap-southeast-7}"

# Default AI region — Singapore (recommended: closest to Thailand + full Bedrock support)
AI_REGION="ap-southeast-1"

# ── Parse CLI flags ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --region)     AI_REGION="$2";    shift 2 ;;
    --stack)      STACK_NAME="$2";   shift 2 ;;
    --crm-stack)  CRM_STACK="$2";    shift 2 ;;
    --crm-region) CRM_REGION="$2";   shift 2 ;;
    --help|-h)
      echo ""
      echo "SalesFAST 7 — Deploy AI Resources"
      echo ""
      echo "Usage:"
      echo "  bash deploy-ai.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --region      AI region (default: ap-southeast-1 — Singapore)"
      echo "  --stack       AI stack name (default: salesfast7-ai-prod)"
      echo "  --crm-stack   Main CRM stack name (default: salesfast7-prod)"
      echo "  --crm-region  Main CRM region (default: ap-southeast-7)"
      echo ""
      echo "Recommended Bedrock Regions:"
      echo "  ap-southeast-1  Singapore (recommended — closest to Thailand)"
      echo "  us-east-1       Virginia (most models available)"
      echo "  us-west-2       Oregon"
      echo "  ap-northeast-1  Tokyo"
      echo ""
      exit 0
      ;;
    *) echo "Unknown option: $1 (use --help)"; exit 1 ;;
  esac
done

echo ""
echo "============================================"
echo "  SalesFAST 7 — AI Deployment"
echo "============================================"
echo ""
echo "  AI Region:   $AI_REGION"
echo "  AI Stack:    $STACK_NAME"
echo "  CRM Region:  $CRM_REGION"
echo "  CRM Stack:   $CRM_STACK"
echo ""

# ── Recommend Singapore ──
if [ "$AI_REGION" != "ap-southeast-1" ]; then
  echo "  NOTE: ap-southeast-1 (Singapore) is recommended"
  echo "  for lowest latency from Thailand + full Bedrock support."
  echo ""
  read -p "  Continue with $AI_REGION? (Y/n) " CONFIRM
  if [ "$CONFIRM" = "n" ] || [ "$CONFIRM" = "N" ]; then
    AI_REGION="ap-southeast-1"
    echo "  Changed to: $AI_REGION"
  fi
  echo ""
fi

# ── Step 1: Deploy AI CloudFormation ──
echo "[1/4] Deploying AI stack to $AI_REGION..."

aws cloudformation deploy \
  --template-file cloudformation-ai.yaml \
  --stack-name "$STACK_NAME" \
  --region "$AI_REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="$ENV" \
    CRMStackName="$CRM_STACK" \
    CRMRegion="$CRM_REGION" \
  --no-fail-on-empty-changeset

echo "  AI stack deployed."

# ── Step 2: Get outputs ──
echo "[2/4] Getting AI stack outputs..."

_get() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$AI_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

KB_BUCKET=$(_get KBBucketName)
AGENT_ROLE=$(_get BedrockAgentRoleArn)
KB_ROLE=$(_get KBRoleArn)

echo "  KB Bucket:    $KB_BUCKET"
echo "  Agent Role:   $AGENT_ROLE"
echo "  KB Role:      $KB_ROLE"

# ── Step 3: Upload sample KB documents ──
echo "[3/4] Uploading sample Knowledge Base documents..."

KB_DIR=""
if [ -d "../database" ]; then
  KB_DIR=".."
elif [ -d "database" ]; then
  KB_DIR="."
fi

# Create sample documents
cat > /tmp/sf7-company-profile.md << 'KBEOF'
# Company Profile

This is a sample company profile. Replace with your actual company information.

## About Us
- Company Name: [Your Company Name]
- Address: [Your Address]
- Phone: [Your Phone]
- Email: [Your Email]
- Business Hours: Monday-Friday 9:00-18:00

## Services
- CRM System for SME
- ERP Solutions
- IT Consulting
KBEOF

cat > /tmp/sf7-faq.md << 'KBEOF'
# FAQ - Frequently Asked Questions

Q: How long does installation take?
A: 2-4 weeks depending on business size.

Q: Is there after-sales support?
A: Yes, 1 year support included in the package.

Q: How many users are supported?
A: Unlimited users.

Q: What payment methods are accepted?
A: Bank transfer, cheque, cash, or credit card.
KBEOF

aws s3 cp /tmp/sf7-company-profile.md "s3://$KB_BUCKET/company/" --region "$AI_REGION"
aws s3 cp /tmp/sf7-faq.md "s3://$KB_BUCKET/faq/" --region "$AI_REGION"

echo "  Sample documents uploaded."

# ── Step 4: Instructions ──
echo "[4/4] Setup complete!"
echo ""
echo "============================================"
echo "  SalesFAST 7 — AI Resources Deployed!"
echo "============================================"
echo ""
echo "  Region:     $AI_REGION"
echo "  KB Bucket:  $KB_BUCKET"
echo "  Agent Role: $AGENT_ROLE"
echo "  KB Role:    $KB_ROLE"
echo ""
echo "  NEXT STEPS (do in AWS Console):"
echo ""
echo "  1. Go to Amazon Bedrock Console in $AI_REGION"
echo "     https://console.aws.amazon.com/bedrock/home?region=$AI_REGION"
echo ""
echo "  2. Create Knowledge Base:"
echo "     - Name: sf7-knowledge-base"
echo "     - IAM Role: $KB_ROLE"
echo "     - Data source: S3 → $KB_BUCKET"
echo "     - Embedding model: Amazon Titan Embed v2"
echo "     - Vector store: Bedrock managed (or use pgvector)"
echo "     - Copy the Knowledge Base ID"
echo ""
echo "  3. Agent Service (Strands Agents SDK):"
echo "     Agents are now built-in via agent-service (Port 3006)"
echo "     No need to create Bedrock Agents manually."
echo "     Set these env vars for agent-service Lambda:"
echo "       BEDROCK_REGION=$AI_REGION"
echo "       BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0"
echo "       KNOWLEDGE_BASE_ID=<from step 2>"
echo "       SQS_AGENT_QUEUE_URL=<from CRM stack output>"
echo ""
echo "  4. Enter Knowledge Base ID in CRM:"
echo "     Settings > Add-ons > AI Configuration"
echo "     - Bedrock Region: $AI_REGION"
echo "     - Agent IDs + KB ID"
echo ""
echo "  5. Upload your documents:"
echo "     Settings > AI Configuration > Knowledge Base > Upload"
echo "     Or: aws s3 cp your-file.pdf s3://$KB_BUCKET/company/"
echo ""
echo "============================================"
