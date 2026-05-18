#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Deploy Strands Agents to Production AgentCore Runtimes
# 
# Replaces old agent-service runtimes with Strands SDK versions
# Uses existing runtime IDs (sf7_agents_v2 + sf7_analytics)
#
# Run in CloudShell:
#   git clone -b feature/fargate-migration https://github.com/konsudtai/CRM.git
#   cd CRM/services/agents-strands
#   bash deploy-production.sh
# ══════════════════════════════════════════════════════════════
set -e

REGION=ap-southeast-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/sf7-agentcore-role"

# Runtime IDs (existing production runtimes)
SALES_RUNTIME_ID="sf7_agents_v2-HGDCxK46cL"
ANALYTICS_RUNTIME_ID="sf7_analytics-AY5sRH2Qtv"

# Config
MEMORY_ID="sf7_agents_memory-Ye8E3AGtiH"
GATEWAY_URL="https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp"
MODEL_ID="global.anthropic.claude-sonnet-4-6"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Deploy Strands Agents → Production AgentCore"
echo "════════════════════════════════════════════════════════"
echo "  Account:   $ACCOUNT_ID"
echo "  Region:    $REGION"
echo "  Sales RT:  $SALES_RUNTIME_ID"
echo "  Analytics: $ANALYTICS_RUNTIME_ID"
echo "  Memory:    $MEMORY_ID"
echo "════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Login ECR ──
echo "[1/5] Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY
echo ""

# ── Step 2: Build Sales Agent ──
echo "[2/5] Building Sales Agent (น้องขายไว)..."
docker build --platform linux/arm64 \
  -t ${REGISTRY}/sf7-agent:strands-sales \
  sales_agent/
docker push ${REGISTRY}/sf7-agent:strands-sales
echo "  ✓ Pushed sf7-agent:strands-sales"
echo ""

# ── Step 3: Build Analytics Agent ──
echo "[3/5] Building Analytics Agent (น้องวิ)..."
docker build --platform linux/arm64 \
  -t ${REGISTRY}/sf7-agent:strands-analytics \
  analytics_agent/
docker push ${REGISTRY}/sf7-agent:strands-analytics
echo "  ✓ Pushed sf7-agent:strands-analytics"
echo ""

# ── Step 4: Update Runtimes ──
echo "[4/5] Updating AgentCore Runtimes..."

SALES_ARN="arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT_ID}:runtime/${SALES_RUNTIME_ID}"
ANALYTICS_ARN="arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT_ID}:runtime/${ANALYTICS_RUNTIME_ID}"

echo "  Updating น้องขายไว..."
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id $SALES_RUNTIME_ID \
  --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"${REGISTRY}/sf7-agent:strands-sales\"}}" \
  --network-configuration '{"networkMode":"PUBLIC"}' \
  --role-arn $ROLE_ARN \
  --environment-variables "{\"MODEL_ID\":\"${MODEL_ID}\",\"MEMORY_ID\":\"${MEMORY_ID}\",\"GATEWAY_URL\":\"${GATEWAY_URL}\",\"ANALYTICS_RUNTIME_ARN\":\"${ANALYTICS_ARN}\"}" \
  --region $REGION \
  --query status --output text

echo "  Updating น้องวิ..."
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id $ANALYTICS_RUNTIME_ID \
  --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"${REGISTRY}/sf7-agent:strands-analytics\"}}" \
  --network-configuration '{"networkMode":"PUBLIC"}' \
  --role-arn $ROLE_ARN \
  --environment-variables "{\"MODEL_ID\":\"${MODEL_ID}\",\"MEMORY_ID\":\"${MEMORY_ID}\",\"GATEWAY_URL\":\"${GATEWAY_URL}\",\"SALES_RUNTIME_ARN\":\"${SALES_ARN}\"}" \
  --region $REGION \
  --query status --output text
echo ""

# ── Step 5: Wait for READY ──
echo "[5/5] Waiting for runtimes to be READY..."
for i in $(seq 1 30); do
  S1=$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id $SALES_RUNTIME_ID --region $REGION --query status --output text 2>/dev/null || echo "?")
  S2=$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id $ANALYTICS_RUNTIME_ID --region $REGION --query status --output text 2>/dev/null || echo "?")
  echo "  [$i/30] น้องขายไว=$S1 | น้องวิ=$S2"
  if [ "$S1" = "READY" ] && [ "$S2" = "READY" ]; then
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo "  ✅ Both Agents READY! (Strands SDK + Memory + Gateway)"
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "  Test: ลองคุยกับน้องขายไว/น้องวิ ผ่าน UI"
    echo "  Memory: จำ context ได้ภายใน session"
    echo "  Tools: ดึงข้อมูลจาก DB ผ่าน Gateway"
    echo "  A2A: น้องขายไว ↔ น้องวิ สื่อสารกันได้"
    echo ""
    exit 0
  fi
  sleep 15
done

echo "⚠️ Timeout — check status manually:"
echo "  aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id $SALES_RUNTIME_ID --region $REGION"
echo "  aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id $ANALYTICS_RUNTIME_ID --region $REGION"
