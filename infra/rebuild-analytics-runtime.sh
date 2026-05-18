#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Rebuild & Deploy Analytics Runtime (น้องวิ)
# Run in AWS CloudShell
#
# Fixes:
# 1. /ping handler BrokenPipeError → AgentCore health check fails
# 2. Image was missing in sf7-agent repo
# ══════════════════════════════════════════════════════════════
set -e
REGION=ap-southeast-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "════════════════════════════════════════════"
echo "  Rebuild Analytics Runtime (น้องวิ)"
echo "════════════════════════════════════════════"
echo ""

# Pull latest code from git
echo "[1/6] Pulling latest code..."
cd ~
if [ ! -d "CRM" ]; then git clone https://github.com/konsudtai/CRM.git; fi
cd CRM
git pull
echo ""

# Login to ECR
echo "[2/6] Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY
echo ""

# Build analytics image
echo "[3/6] Building analytics image (ARM64)..."
docker buildx create --use --name multiarch-builder 2>/dev/null || docker buildx use multiarch-builder
docker buildx build --platform linux/arm64 \
  -t ${REGISTRY}/sf7-analytics:latest \
  -t ${REGISTRY}/sf7-agent:v0.7.5 \
  --push \
  services/agent-service/runtimes/analytics/
echo ""

# Trigger AgentCore to use new image
echo "[4/6] Triggering AgentCore runtime restart..."
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id sf7_analytics-AY5sRH2Qtv \
  --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"${REGISTRY}/sf7-agent:v0.7.5\"}}" \
  --network-configuration '{"networkMode":"PUBLIC"}' \
  --role-arn "arn:aws:iam::${ACCOUNT_ID}:role/sf7-agentcore-role" \
  --region $REGION
echo ""

# Wait for ready
echo "[5/6] Waiting for runtime to be READY..."
for i in $(seq 1 30); do
  STATUS=$(aws bedrock-agentcore-control get-agent-runtime \
    --agent-runtime-id sf7_analytics-AY5sRH2Qtv --region $REGION \
    --query 'status' --output text 2>/dev/null || echo "UNKNOWN")
  echo "  $STATUS ($i/30)"
  if [ "$STATUS" = "READY" ]; then break; fi
  sleep 10
done
echo ""

# Test invoke
echo "[6/6] Testing invoke..."
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn "arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT_ID}:runtime/sf7_analytics-AY5sRH2Qtv" \
  --runtime-session-id "test-fix-$(date +%s)pad33chars" \
  --payload '{"message":"สวัสดี ทดสอบระบบ","agentType":"analytics","tenantId":"test"}' \
  --content-type application/json \
  /tmp/test-out.json --region $REGION
cat /tmp/test-out.json
echo ""

echo "════════════════════════════════════════════"
echo "  ✅ น้องวิพร้อมใช้งานแล้ว!"
echo "════════════════════════════════════════════"
