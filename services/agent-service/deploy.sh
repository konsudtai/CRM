#!/bin/bash
# ============================================================
# Deploy Agent Service to AWS Lambda
# ============================================================
set -e

REGION="${AWS_REGION:-ap-southeast-1}"
FUNCTION_NAME="sf7-prod-agent"
STACK_NAME="salesfast7-prod"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  SalesFAST 7 — Agent Service Deployment"
echo "═══════════════════════════════════════════════════"
echo "  Region:   ${REGION}"
echo "  Function: ${FUNCTION_NAME}"
echo "  Stack:    ${STACK_NAME}"
echo "═══════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

# ── Step 1: Build ──
echo "[1/4] Building Agent Service..."
npm install --no-audit --no-fund
npm run build
echo "  Build complete."

# ── Step 2: Package for Lambda ──
echo "[2/4] Packaging for Lambda..."
rm -rf /tmp/agent-deploy
mkdir -p /tmp/agent-deploy
cp -r dist/* /tmp/agent-deploy/
cp package.json /tmp/agent-deploy/
cd /tmp/agent-deploy
npm install --production --ignore-scripts --no-audit --no-fund
rm -rf /tmp/agent-lambda.zip
cd /tmp/agent-deploy && zip -qr /tmp/agent-lambda.zip .
SIZE=$(du -h /tmp/agent-lambda.zip | cut -f1)
echo "  Package: /tmp/agent-lambda.zip (${SIZE})"

# ── Step 3: Get stack outputs ──
echo "[3/4] Getting stack configuration..."
DB_HOST=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
AGENT_QUEUE_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AgentEventsQueueUrl'].OutputValue" --output text 2>/dev/null || echo "")
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>/dev/null || echo "")

echo "  DB_HOST:    ${DB_HOST}"
echo "  Queue:      ${AGENT_QUEUE_URL}"
echo "  API URL:    ${API_URL}"

if [ -z "$DB_HOST" ] || [ "$DB_HOST" = "None" ]; then
  echo "  ERROR: Could not get DB_HOST from stack outputs."
  echo "  Make sure the main stack '${STACK_NAME}' is deployed."
  exit 1
fi

# ── Step 4: Deploy Lambda ──
echo "[4/4] Deploying Lambda function..."

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null; then
  echo "  Updating existing function code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb:///tmp/agent-lambda.zip \
    --region "$REGION" > /dev/null

  echo "  Waiting for update..."
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || true

  echo "  Updating environment variables..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --timeout 60 \
    --memory-size 1024 \
    --environment "Variables={
      BEDROCK_REGION=ap-southeast-1,
      BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0,
      DB_HOST=${DB_HOST},
      DB_PORT=5432,
      DB_USER=salesfast7,
      DB_NAME=salesfast7,
      DB_SSL=true,
      CORS_ORIGIN=*,
      NODE_ENV=production,
      SQS_AGENT_QUEUE_URL=${AGENT_QUEUE_URL},
      CRM_API_URL=${API_URL},
      SALES_API_URL=${API_URL},
      QUOTATION_API_URL=${API_URL},
      NOTIFICATION_API_URL=${API_URL},
      AUTH_API_URL=${API_URL},
      ENABLE_EVENT_LISTENER=true,
      ENABLE_SCHEDULER=true
    }" > /dev/null
else
  echo "  Function not found. Deploy the main CloudFormation stack first:"
  echo "    cd infra && bash deploy.sh"
  echo ""
  echo "  Then re-run this script to update the function code."
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Agent Service Deployed!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Function: ${FUNCTION_NAME}"
echo "  Region:   ${REGION}"
echo "  Agents:   น้องแอ๊ด, น้องขายไว, น้องวิ"
echo ""
echo "  Endpoints (via API Gateway + CloudFront):"
echo "    POST /agents/chat     — Send message (JSON response)"
echo "    POST /agents/stream   — Send message (SSE streaming)"
echo "    POST /agents/line-webhook — LINE message handler"
echo ""
echo "  Features:"
echo "    ✅ A2A (Agent-to-Agent communication)"
echo "    ✅ MCP (CRM Database via PostgreSQL)"
echo "    ✅ Event-driven (SQS → proactive actions)"
echo "    ✅ Scheduler (daily digest, deal health, reminders)"
echo "    ✅ Knowledge Base (Bedrock RAG)"
echo ""
echo "  Next steps:"
echo "    1. Set DB_PASS env var (from Secrets Manager)"
echo "    2. Set JWT_SECRET env var"
echo "    3. Set KNOWLEDGE_BASE_ID after creating KB"
echo "    4. Test: curl -X POST ${API_URL}/agents/chat \\"
echo "         -H 'Content-Type: application/json' \\"
echo "         -d '{\"message\":\"สวัสดี\",\"agentType\":\"auto\"}'"
echo "═══════════════════════════════════════════════════"
