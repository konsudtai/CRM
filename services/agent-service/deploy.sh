#!/bin/bash
# ============================================================
# Deploy Agent Service to AWS Lambda
# ============================================================
set -e

REGION="${AWS_REGION:-ap-southeast-1}"
FUNCTION_NAME="sf7-prod-agent"
STACK_NAME="salesfast7-prod"

echo "=== Building Agent Service ==="
cd "$(dirname "$0")"
npm install
npm run build

echo "=== Packaging for Lambda ==="
rm -rf /tmp/agent-deploy
mkdir -p /tmp/agent-deploy
cp -r dist/* /tmp/agent-deploy/
cp package.json /tmp/agent-deploy/
cd /tmp/agent-deploy
npm install --production --ignore-scripts
cd /tmp/agent-deploy && zip -qr /tmp/agent-lambda.zip .

echo "=== Getting stack outputs ==="
VPC_SUBNETS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnetAId'].OutputValue" --output text)
VPC_SUBNET_B=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnetBId'].OutputValue" --output text)
LAMBDA_SG=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='LambdaSGId'].OutputValue" --output text)
DB_HOST=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)
LAMBDA_ROLE=$(aws iam get-role --role-name "sf7-prod-lambda-role-${STACK_NAME}" --query "Role.Arn" --output text 2>/dev/null || echo "")

echo "=== Creating/Updating Lambda ==="
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb:///tmp/agent-lambda.zip \
    --region "$REGION" > /dev/null
else
  echo "Creating new function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --handler dist/lambda.handler \
    --role "$LAMBDA_ROLE" \
    --zip-file fileb:///tmp/agent-lambda.zip \
    --timeout 60 \
    --memory-size 1024 \
    --region "$REGION" \
    --vpc-config "SubnetIds=${VPC_SUBNETS},${VPC_SUBNET_B},SecurityGroupIds=${LAMBDA_SG}" \
    --environment "Variables={
      BEDROCK_REGION=${REGION},
      BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6-20250514-v1:0,
      DB_HOST=${DB_HOST},
      DB_PORT=5432,
      DB_USER=salesfast7,
      DB_NAME=salesfast7,
      DB_SSL=true,
      CORS_ORIGIN=*,
      NODE_ENV=production,
      SQS_AGENT_QUEUE_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='AgentEventsQueueUrl'].OutputValue" --output text)
    }" > /dev/null
fi

aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || true
echo "=== Done! Agent Service deployed as $FUNCTION_NAME ==="
echo ""
echo "Next steps:"
echo "  1. Enable Bedrock model access in AWS Console"
echo "  2. Set KNOWLEDGE_BASE_ID env var after creating KB"
echo "  3. Add API Gateway route: ANY /agents/* → $FUNCTION_NAME"
