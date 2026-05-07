#!/bin/bash
# ============================================================
# Deploy SalesFAST 7 Agents to Amazon Bedrock AgentCore Runtime
# ============================================================
set -e

REGION="${BEDROCK_REGION:-ap-southeast-1}"
AGENT_NAME="sf7-agents"
RUNTIME="NODE_22"

echo "=== Building AgentCore Package ==="
cd "$(dirname "$0")"

# Install dependencies
npm install

# Build with esbuild
npx esbuild src/app.ts --bundle --platform=node --target=node22 --outfile=dist/app.js '--external:@aws-sdk/*'

# Package as zip
cd dist
zip -r ../agent.zip app.js
cd ..

echo "=== Package ready: agent.zip ($(du -h agent.zip | cut -f1)) ==="
echo ""

# Check if AgentCore CLI is available
if command -v agentcore &>/dev/null; then
  echo "=== Deploying via AgentCore CLI ==="
  agentcore deploy \
    --name "$AGENT_NAME" \
    --runtime "$RUNTIME" \
    --zip agent.zip \
    --entry "dist/app.js" \
    --region "$REGION" \
    --env "BEDROCK_MODEL_ID=${BEDROCK_MODEL_ID:-global.anthropic.claude-sonnet-4-6}" \
    --env "BEDROCK_REGION=${REGION}" \
    --env "AWS_BEARER_TOKEN_BEDROCK=${AWS_BEARER_TOKEN_BEDROCK:-}"
  echo "=== Deployed! ==="
else
  echo "=== AgentCore CLI not found ==="
  echo ""
  echo "To deploy manually:"
  echo "  1. Go to AWS Console → Amazon Bedrock → AgentCore → Create Agent Runtime"
  echo "  2. Name: $AGENT_NAME"
  echo "  3. Runtime: $RUNTIME"
  echo "  4. Upload: $(pwd)/agent.zip"
  echo "  5. Entry point: dist/app.js"
  echo "  6. Set environment variables:"
  echo "     - AWS_BEARER_TOKEN_BEDROCK = <your Bedrock API Key>"
  echo "     - BEDROCK_MODEL_ID = global.anthropic.claude-sonnet-4-6"
  echo "     - BEDROCK_REGION = $REGION"
  echo ""
  echo "Or install AgentCore CLI:"
  echo "  npm install -g @aws/agentcore-cli"
  echo "  Then re-run this script."
fi
