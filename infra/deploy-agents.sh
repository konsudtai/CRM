#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SalesFAST 7 — Deploy All 3 Agent Runtimes to AgentCore
# Run this in AWS CloudShell (has Docker + AWS CLI)
#
# Usage:
#   git clone https://github.com/konsudtai/CRM.git && cd CRM
#   bash infra/deploy-agents.sh
# ══════════════════════════════════════════════════════════════
set -e

REGION="ap-southeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
RUNTIME_NAME="sf7_agents_v2"
ROLE_NAME="BedrockAgentCoreRuntimeRole"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  SalesFAST 7 — Deploy 3 Agent Runtimes (Claude Sonnet 4.6)"
echo "════════════════════════════════════════════════════════"
echo "  Account: $ACCOUNT_ID"
echo "  Region:  $REGION"
echo "  Model:   Claude Sonnet 4.6"
echo "════════════════════════════════════════════════════════"
echo ""

# ── Get Runtime ID ──
RUNTIME_ID=$(aws bedrock-agentcore-control list-agent-runtimes --region $REGION \
  --query "agentRuntimeSummaries[?contains(agentRuntimeName,'sf7_agents')].agentRuntimeId" \
  --output text 2>/dev/null | head -1)

if [ -z "$RUNTIME_ID" ] || [ "$RUNTIME_ID" = "None" ]; then
  echo "ERROR: No AgentCore runtime found. Create one first."
  exit 1
fi
echo "  Runtime ID: $RUNTIME_ID"

# ── Get Role ARN ──
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null || echo "")
if [ -z "$ROLE_ARN" ]; then
  echo "ERROR: IAM Role $ROLE_NAME not found."
  exit 1
fi
echo "  Role ARN: $ROLE_ARN"

# ── ECR Login ──
echo ""
echo "[1/4] ECR Login..."
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# ── Create ECR repos if needed ──
for REPO in sf7-sales-assistant sf7-admin-ai sf7-analytics; do
  aws ecr create-repository --repository-name $REPO --region $REGION 2>/dev/null || true
done

# ── Build & Push all 3 runtimes ──
echo ""
echo "[2/4] Building & pushing Docker images..."

RUNTIMES_DIR="services/agent-service/runtimes"

# Sales Assistant
echo "  Building น้องขายไว..."
docker build --platform linux/arm64 -t sf7-sales-assistant "$RUNTIMES_DIR/sales-assistant"
docker tag sf7-sales-assistant:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-sales-assistant:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-sales-assistant:latest

# Admin AI
echo "  Building น้องแอ๊ด..."
docker build --platform linux/arm64 -t sf7-admin-ai "$RUNTIMES_DIR/admin-ai"
docker tag sf7-admin-ai:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-admin-ai:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-admin-ai:latest

# Analytics
echo "  Building น้องวิ..."
docker build --platform linux/arm64 -t sf7-analytics "$RUNTIMES_DIR/analytics"
docker tag sf7-analytics:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-analytics:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-analytics:latest

# ── Update AgentCore Runtime ──
echo ""
echo "[3/4] Updating AgentCore Runtime..."
# Use sales-assistant as the primary runtime image (it handles routing)
CONTAINER_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-sales-assistant:latest"

aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id "$RUNTIME_ID" \
  --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"${CONTAINER_URI}\"}}" \
  --role-arn "$ROLE_ARN" \
  --region $REGION

# ── Wait for READY ──
echo ""
echo "[4/4] Waiting for runtime to be READY..."
for i in $(seq 1 30); do
  STATUS=$(aws bedrock-agentcore-control get-agent-runtime \
    --agent-runtime-id "$RUNTIME_ID" --region $REGION \
    --query 'status' --output text 2>/dev/null || echo "UNKNOWN")
  echo "  Status: $STATUS ($i/30)"
  if [ "$STATUS" = "READY" ]; then break; fi
  sleep 10
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ All Agents Deployed with Claude Sonnet 4.6!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  Runtime: $RUNTIME_ID ($STATUS)"
echo "  Model:   apac.anthropic.claude-sonnet-4-6-20250514-v1:0"
echo ""
echo "  Agents:"
echo "    🟣 น้องขายไว — Sales Assistant (14 tools)"
echo "    🔵 น้องแอ๊ด  — Admin AI / Customer-facing (5 tools)"
echo "    🟢 น้องวิ    — Analytics (7 tools)"
echo ""
echo "  Test:"
echo "    curl -X POST https://d8fvblqbvfcc.cloudfront.net/agents/chat \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"message\":\"สวัสดี\",\"agentType\":\"sales-assistant\"}'"
echo ""
