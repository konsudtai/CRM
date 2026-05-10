#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SalesFAST 7 — Deploy Agent to AgentCore Runtime
# ══════════════════════════════════════════════════════════════
set -e

REGION="${AWS_REGION:-ap-southeast-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="sf7-agent-service"
RUNTIME_NAME="sf7-sales-assistant"
ROLE_NAME="BedrockAgentCoreRuntimeRole"

echo ""
echo "════════════════════════════════════════════"
echo "  SalesFAST 7 — AgentCore Deployment"
echo "════════════════════════════════════════════"
echo "  Region:  $REGION"
echo "  Account: $ACCOUNT_ID"
echo "  Repo:    $ECR_REPO"
echo "  Runtime: $RUNTIME_NAME"
echo "════════════════════════════════════════════"
echo ""

# ── Step 1: Create IAM Role (if not exists) ──
echo "[1/5] Creating IAM Role..."
if aws iam get-role --role-name $ROLE_NAME 2>/dev/null; then
  echo "  Role exists."
else
  TRUST_POLICY='{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "bedrock-agentcore.amazonaws.com"},
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {"aws:SourceAccount": "'$ACCOUNT_ID'"},
        "ArnLike": {"aws:SourceArn": "arn:aws:bedrock-agentcore:'$REGION':'$ACCOUNT_ID':*"}
      }
    }]
  }'
  aws iam create-role --role-name $ROLE_NAME \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "AgentCore Runtime role for SalesFAST 7"

  POLICY='{
    "Version": "2012-10-17",
    "Statement": [
      {"Effect":"Allow","Action":["ecr:BatchGetImage","ecr:GetDownloadUrlForLayer"],"Resource":"arn:aws:ecr:'$REGION':'$ACCOUNT_ID':repository/*"},
      {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
      {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents","logs:DescribeLogStreams","logs:DescribeLogGroups"],"Resource":"arn:aws:logs:'$REGION':'$ACCOUNT_ID':*"},
      {"Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream","bedrock:Retrieve","bedrock:RetrieveAndGenerate"],"Resource":"*"},
      {"Effect":"Allow","Action":["cloudwatch:PutMetricData"],"Resource":"*"},
      {"Effect":"Allow","Action":["xray:PutTraceSegments","xray:PutTelemetryRecords"],"Resource":"*"}
    ]
  }'
  aws iam put-role-policy --role-name $ROLE_NAME \
    --policy-name AgentCorePolicy --policy-document "$POLICY"
  echo "  Role created. Waiting 10s for propagation..."
  sleep 10
fi
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
echo "  ARN: $ROLE_ARN"

# ── Step 2: Create ECR Repository ──
echo ""
echo "[2/5] Creating ECR Repository..."
aws ecr create-repository --repository-name $ECR_REPO --region $REGION 2>/dev/null || echo "  Repo exists."

# ── Step 3: Build & Push Docker Image ──
echo ""
echo "[3/5] Building & pushing Docker image..."
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

docker build --platform linux/arm64 -t $ECR_REPO .
docker tag ${ECR_REPO}:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest
echo "  Image pushed."

# ── Step 4: Create or Update AgentCore Runtime ──
echo ""
echo "[4/5] Deploying to AgentCore Runtime..."
CONTAINER_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"

# Check if runtime exists
EXISTING=$(aws bedrock-agentcore-control list-agent-runtimes --region $REGION \
  --query "agentRuntimeSummaries[?agentRuntimeName=='${RUNTIME_NAME}'].agentRuntimeId" \
  --output text 2>/dev/null || echo "")

if [ -n "$EXISTING" ] && [ "$EXISTING" != "None" ]; then
  echo "  Updating existing runtime: $EXISTING"
  aws bedrock-agentcore-control update-agent-runtime \
    --agent-runtime-id "$EXISTING" \
    --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"${CONTAINER_URI}\"}}" \
    --role-arn "$ROLE_ARN" \
    --network-configuration "{\"networkMode\":\"PUBLIC\"}" \
    --protocol-configuration serverProtocol=HTTP \
    --region $REGION
else
  echo "  Creating new runtime..."
  aws bedrock-agentcore-control create-agent-runtime \
    --agent-runtime-name $RUNTIME_NAME \
    --agent-runtime-artifact "containerConfiguration={containerUri=${CONTAINER_URI}}" \
    --role-arn "$ROLE_ARN" \
    --network-configuration networkMode=PUBLIC \
    --protocol-configuration serverProtocol=HTTP \
    --region $REGION
fi

# ── Step 5: Wait for READY ──
echo ""
echo "[5/5] Waiting for runtime to be READY..."
RUNTIME_ID=$(aws bedrock-agentcore-control list-agent-runtimes --region $REGION \
  --query "agentRuntimeSummaries[?agentRuntimeName=='${RUNTIME_NAME}'].agentRuntimeId" \
  --output text)

for i in $(seq 1 30); do
  STATUS=$(aws bedrock-agentcore-control get-agent-runtime \
    --agent-runtime-id "$RUNTIME_ID" --region $REGION \
    --query 'status' --output text 2>/dev/null || echo "UNKNOWN")
  echo "  Status: $STATUS ($i/30)"
  if [ "$STATUS" = "READY" ]; then break; fi
  sleep 10
done

RUNTIME_ARN=$(aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id "$RUNTIME_ID" --region $REGION \
  --query 'agentRuntimeArn' --output text 2>/dev/null || echo "")

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ AgentCore Deployment Complete!"
echo "════════════════════════════════════════════"
echo ""
echo "  Runtime ID:  $RUNTIME_ID"
echo "  Runtime ARN: $RUNTIME_ARN"
echo "  Status:      $STATUS"
echo ""
echo "  To invoke:"
echo "    aws bedrock-agentcore invoke-agent-runtime \\"
echo "      --agent-runtime-arn $RUNTIME_ARN \\"
echo "      --runtime-session-id test-\$(date +%s) \\"
echo "      --payload '{\"message\":\"สวัสดี\",\"agentType\":\"sales-assistant\"}' \\"
echo "      --region $REGION"
echo ""
echo "  Update CRM Lambda env var:"
echo "    AGENTCORE_RUNTIME_ARN=$RUNTIME_ARN"
echo ""
