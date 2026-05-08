#!/bin/bash
# ============================================================
# SalesFAST 7 — Deploy to Amazon Bedrock AgentCore Runtime
#
# Prerequisites:
#   - Docker (with buildx for ARM64)
#   - AWS CLI configured
#   - ECR repository created
#
# Usage:
#   bash deploy.sh
#   bash deploy.sh --region ap-southeast-1
# ============================================================
set -e

REGION="${1:-ap-southeast-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AGENT_NAME="sf7-agents"
ECR_REPO="sf7-agentcore"
IMAGE_TAG="latest"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  SalesFAST 7 — AgentCore Deployment"
echo "═══════════════════════════════════════════════════"
echo "  Region:    ${REGION}"
echo "  Account:   ${ACCOUNT_ID}"
echo "  Image:     ${ECR_URI}"
echo "═══════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

# ── Step 1: Install & Build ──
echo "[1/5] Building application..."
npm install --no-audit --no-fund
npm run build
echo "  Build complete: dist/app.js"

# ── Step 2: Create ECR Repository (if not exists) ──
echo "[2/5] Setting up ECR..."
aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" --region "$REGION" --image-scanning-configuration scanOnPush=true
echo "  ECR ready: ${ECR_REPO}"

# ── Step 3: Build ARM64 Docker Image ──
echo "[3/5] Building Docker image (ARM64)..."
docker buildx create --use 2>/dev/null || true
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
docker buildx build --platform linux/arm64 -t "$ECR_URI" --push .
echo "  Image pushed: ${ECR_URI}"

# ── Step 4: Deploy to AgentCore Runtime ──
echo "[4/5] Deploying to AgentCore Runtime..."

# Get DB connection info from existing stack
DB_HOST=$(aws cloudformation describe-stacks --stack-name salesfast7-prod --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
DB_PASS=$(aws lambda get-function-configuration --function-name sf7-prod-crm --region "$REGION" --query "Environment.Variables.DB_PASS" --output text 2>/dev/null || echo "")
BEDROCK_MODEL_ID=$(aws lambda get-function-configuration --function-name sf7-prod-crm --region "$REGION" --query "Environment.Variables.BEDROCK_MODEL_ID" --output text 2>/dev/null || echo "apac.anthropic.claude-3-5-sonnet-20241022-v2:0")

# Create IAM Role for AgentCore (if not exists)
ROLE_NAME="sf7-agentcore-role"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if ! aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
  echo "  Creating IAM role..."
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "bedrock-agentcore.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
  aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "sf7-agentcore-ecr" --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {"Effect": "Allow", "Action": ["ecr:GetDownloadUrlForLayer","ecr:BatchGetImage","ecr:GetAuthorizationToken"], "Resource": "*"},
      {"Effect": "Allow", "Action": ["rds-db:connect"], "Resource": "*"},
      {"Effect": "Allow", "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"], "Resource": "*"}
    ]
  }'
  echo "  Waiting for role propagation..."
  sleep 10
fi

# Deploy via AWS SDK (Python script)
python3 - <<PYTHON
import boto3, json, sys

client = boto3.client('bedrock-agentcore-control', region_name='${REGION}')

env_vars = {
    'DB_HOST': '${DB_HOST}',
    'DB_PORT': '5432',
    'DB_USER': 'salesfast7',
    'DB_PASS': '${DB_PASS}',
    'DB_NAME': 'salesfast7',
    'DB_SSL': 'true',
    'BEDROCK_MODEL_ID': '${BEDROCK_MODEL_ID}',
    'BEDROCK_REGION': '${REGION}',
}

try:
    # Try to update existing runtime
    response = client.update_agent_runtime(
        agentRuntimeName='${AGENT_NAME}',
        agentRuntimeArtifact={
            'containerConfiguration': {
                'containerUri': '${ECR_URI}'
            }
        },
        environmentVariables=env_vars,
    )
    print(f"  Agent Runtime updated: {response.get('agentRuntimeArn', 'OK')}")
except client.exceptions.ResourceNotFoundException:
    # Create new runtime
    response = client.create_agent_runtime(
        agentRuntimeName='${AGENT_NAME}',
        agentRuntimeArtifact={
            'containerConfiguration': {
                'containerUri': '${ECR_URI}'
            }
        },
        networkConfiguration={'networkMode': 'PUBLIC'},
        roleArn='${ROLE_ARN}',
        environmentVariables=env_vars,
        lifecycleConfiguration={
            'idleRuntimeSessionTimeout': 600,   # 10 min idle before shutdown
            'maxLifetime': 3600                  # 1 hour max session
        },
    )
    print(f"  Agent Runtime created: {response.get('agentRuntimeArn', 'OK')}")
except Exception as e:
    print(f"  Error: {e}")
    sys.exit(1)

print(f"  Status: {response.get('status', 'DEPLOYING')}")
PYTHON

# ── Step 5: Output ──
echo ""
echo "[5/5] Deployment complete!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  AgentCore Runtime: ${AGENT_NAME}"
echo "  Region: ${REGION}"
echo "  Image: ${ECR_URI}"
echo ""
echo "  Features:"
echo "    ✅ A2A (Agent-to-Agent communication)"
echo "    ✅ MCP (CRM Database via PostgreSQL)"
echo "    ✅ 3 Agents: น้องแอ๊ด, น้องขายไว, น้องวิ"
echo "    ✅ 14 CRM Tools (leads, accounts, tasks, etc.)"
echo ""
echo "  Next steps:"
echo "    1. Wait for status READY (~2-3 min)"
echo "    2. Test: aws bedrock-agentcore invoke-agent-runtime \\"
echo "         --agent-runtime-arn <ARN> \\"
echo "         --runtime-session-id test-session-$(date +%s)0000000000 \\"
echo "         --payload '{\"message\":\"สวัสดี\",\"agentType\":\"sales-assistant\",\"tenantId\":\"default\"}'"
echo "    3. Update frontend to point to AgentCore endpoint"
echo "═══════════════════════════════════════════════════"
