#!/bin/bash
# ════════════════════════════════════════════════════════════════
# SalesFAST 7 — Deploy AgentCore via AWS CloudShell
#
# HOW TO USE:
#   1. Open AWS Console → CloudShell (ap-southeast-1)
#   2. Upload this entire 'services/agentcore' folder
#      OR git clone your repo
#   3. Run: bash deploy-cloudshell.sh
#
# Prerequisites (all available in CloudShell):
#   ✅ Docker (built-in)
#   ✅ AWS CLI (built-in)
#   ✅ Node.js (install via nvm)
# ════════════════════════════════════════════════════════════════
set -e

REGION="ap-southeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="sf7-agentcore"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"
AGENT_NAME="sf7-agents"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/sf7-agentcore-role"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SalesFAST 7 — AgentCore Deploy (CloudShell)"
echo "═══════════════════════════════════════════════════════"
echo "  Account: ${ACCOUNT_ID}"
echo "  Region:  ${REGION}"
echo "  Image:   ${ECR_URI}"
echo "═══════════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

# ── Step 1: Install Node.js if needed ──
if ! command -v node &>/dev/null; then
  echo "[1/6] Installing Node.js..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 22
else
  echo "[1/6] Node.js: $(node -v)"
fi

# ── Step 2: Install deps & build ──
echo "[2/6] Building application..."
rm -f package-lock.json
npm install --no-audit --no-fund --legacy-peer-deps --loglevel=error
npm run build
echo "  Built: dist/app.js ($(du -h dist/app.js | cut -f1))"

# ── Step 3: Build Docker image (ARM64) ──
echo "[3/6] Building Docker image (ARM64)..."
docker buildx create --name sf7builder --use 2>/dev/null || docker buildx use sf7builder 2>/dev/null || true
docker buildx build --platform linux/arm64 -t "${ECR_URI}" --load . 2>&1 | tail -5
echo "  Image built."

# ── Step 4: Push to ECR ──
echo "[4/6] Pushing to ECR..."
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
docker push "${ECR_URI}"
echo "  Pushed: ${ECR_URI}"

# ── Step 5: Get DB credentials from existing Lambda ──
echo "[5/6] Getting configuration..."
DB_HOST=$(aws lambda get-function-configuration --function-name sf7-prod-crm --region "${REGION}" --query "Environment.Variables.DB_HOST" --output text 2>/dev/null || echo "")
DB_PASS=$(aws lambda get-function-configuration --function-name sf7-prod-crm --region "${REGION}" --query "Environment.Variables.DB_PASS" --output text 2>/dev/null || echo "")
BEDROCK_MODEL=$(aws lambda get-function-configuration --function-name sf7-prod-crm --region "${REGION}" --query "Environment.Variables.BEDROCK_MODEL_ID" --output text 2>/dev/null || echo "apac.anthropic.claude-3-5-sonnet-20241022-v2:0")

if [ -z "$DB_HOST" ] || [ "$DB_HOST" = "None" ]; then
  echo "  ERROR: Could not get DB_HOST from Lambda config"
  echo "  Set manually: export DB_HOST=your-rds-endpoint"
  exit 1
fi
echo "  DB_HOST: ${DB_HOST}"
echo "  Model:   ${BEDROCK_MODEL}"

# ── Step 6: Deploy to AgentCore ──
echo "[6/6] Deploying to AgentCore Runtime..."

python3 << PYTHON
import boto3, json, sys

client = boto3.client('bedrock-agentcore-control', region_name='${REGION}')

env_vars = {
    'DB_HOST': '${DB_HOST}',
    'DB_PORT': '5432',
    'DB_USER': 'salesfast7',
    'DB_PASS': '${DB_PASS}',
    'DB_NAME': 'salesfast7',
    'DB_SSL': 'true',
    'BEDROCK_MODEL_ID': '${BEDROCK_MODEL}',
    'BEDROCK_REGION': '${REGION}',
}

artifact = {
    'containerConfiguration': {
        'containerUri': '${ECR_URI}'
    }
}

try:
    # Try update first
    response = client.update_agent_runtime(
        agentRuntimeName='${AGENT_NAME}',
        agentRuntimeArtifact=artifact,
        environmentVariables=env_vars,
    )
    print(f"  Updated: {response.get('agentRuntimeArn', 'OK')}")
    print(f"  Status:  {response.get('status', 'UPDATING')}")
except client.exceptions.ResourceNotFoundException:
    # Create new
    response = client.create_agent_runtime(
        agentRuntimeName='${AGENT_NAME}',
        description='SalesFAST 7 Multi-Agent AI (A2A + MCP)',
        agentRuntimeArtifact=artifact,
        networkConfiguration={'networkMode': 'PUBLIC'},
        roleArn='${ROLE_ARN}',
        environmentVariables=env_vars,
        lifecycleConfiguration={
            'idleRuntimeSessionTimeout': 600,
            'maxLifetime': 3600,
        },
    )
    print(f"  Created: {response.get('agentRuntimeArn', 'OK')}")
    print(f"  Status:  {response.get('status', 'CREATING')}")
except Exception as e:
    print(f"  ERROR: {e}")
    sys.exit(1)
PYTHON

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Wait 2-3 minutes for status READY, then test:"
echo ""
echo "  aws bedrock-agentcore invoke-agent-runtime \\"
echo "    --agent-runtime-arn <ARN from above> \\"
echo "    --runtime-session-id test-\$(date +%s)00000000000000000 \\"
echo "    --payload '{\"message\":\"สรุป Lead\",\"agentType\":\"sales-assistant\",\"tenantId\":\"00000000-0000-0000-0000-000000000001\"}' \\"
echo "    --region ${REGION} \\"
echo "    /tmp/response.json"
echo ""
echo "  cat /tmp/response.json"
echo ""
echo "═══════════════════════════════════════════════════════"
