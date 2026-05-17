#!/bin/bash
# Fix agent routing — rebuild container with agentType support
set -e
REGION="ap-southeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="sf7-sales-assistant"
RUNTIME_ID="sf7_agents_v2-HGDCxK46cL"

echo "Rebuilding agent container with agentType routing fix..."

# ECR Login
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# Build & Push
docker build --platform linux/arm64 -t $ECR_REPO services/agent-service/python_agent
docker tag ${ECR_REPO}:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest

# Update runtime to pick up new image
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id "$RUNTIME_ID" \
  --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest\"}}" \
  --role-arn "arn:aws:iam::${ACCOUNT_ID}:role/sf7-agentcore-role" \
  --network-configuration '{"networkMode":"PUBLIC"}' \
  --region $REGION

echo "Waiting for READY..."
for i in $(seq 1 20); do
  STATUS=$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$RUNTIME_ID" --region $REGION --query 'status' --output text)
  echo "  $STATUS ($i/20)"
  if [ "$STATUS" = "READY" ]; then break; fi
  sleep 10
done
echo "Done! Runtime is $STATUS"
