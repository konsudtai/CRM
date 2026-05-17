#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SalesFAST 7 — Deploy WebSocket API for AI Agents
# ══════════════════════════════════════════════════════════════
set -e
REGION="ap-southeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
WS_FUNCTION="sf7-prod-ws-agents"
WS_TABLE="sf7-prod-ws-connections"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/sf7-prod-lambda-role-salesfast7-prod"

echo "════════════════════════════════════════════"
echo "  SalesFAST 7 — WebSocket API Deployment"
echo "════════════════════════════════════════════"
echo "  Account: $ACCOUNT_ID"
echo "  Region:  $REGION"
echo "════════════════════════════════════════════"

# 1. Create DynamoDB table for connections
echo "[1/5] Creating DynamoDB connections table..."
aws dynamodb create-table \
  --table-name $WS_TABLE \
  --attribute-definitions AttributeName=connectionId,AttributeType=S \
  --key-schema AttributeName=connectionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION 2>/dev/null || echo "  Table exists."

# Enable TTL
aws dynamodb update-time-to-live \
  --table-name $WS_TABLE \
  --time-to-live-specification Enabled=true,AttributeName=ttl \
  --region $REGION 2>/dev/null || true

# 2. Create Lambda function
echo "[2/5] Creating WebSocket Lambda..."
if aws lambda get-function --function-name $WS_FUNCTION --region $REGION 2>/dev/null; then
  echo "  Updating existing function..."
  aws lambda update-function-code \
    --function-name $WS_FUNCTION \
    --zip-file fileb://services/api/dist/ws-handler.zip \
    --region $REGION --output json --query 'FunctionName'
else
  echo "  Creating new function..."
  aws lambda create-function \
    --function-name $WS_FUNCTION \
    --runtime nodejs20.x \
    --handler ws-handler.handler \
    --role $ROLE_ARN \
    --zip-file fileb://services/api/dist/ws-handler.zip \
    --timeout 120 \
    --memory-size 1024 \
    --environment "Variables={WS_CONNECTIONS_TABLE=$WS_TABLE,AGENTCORE_RUNTIME_ARN=$(aws lambda get-function-configuration --function-name sf7-prod-crm --region $REGION --query 'Environment.Variables.AGENTCORE_RUNTIME_ARN' --output text),AGENTCORE_REGION=$REGION,AWS_REGION_OVERRIDE=$REGION}" \
    --region $REGION --output json --query 'FunctionName'
fi

# 3. Create WebSocket API
echo "[3/5] Creating WebSocket API Gateway..."
WS_API_ID=$(aws apigatewayv2 get-apis --region $REGION \
  --query "Items[?Name=='sf7-prod-ws'].ApiId" --output text 2>/dev/null)

if [ -z "$WS_API_ID" ] || [ "$WS_API_ID" = "None" ]; then
  WS_API_ID=$(aws apigatewayv2 create-api \
    --name sf7-prod-ws \
    --protocol-type WEBSOCKET \
    --route-selection-expression '$request.body.action' \
    --region $REGION --query 'ApiId' --output text)
  echo "  Created API: $WS_API_ID"
else
  echo "  API exists: $WS_API_ID"
fi

# 4. Create integration + routes
echo "[4/5] Setting up routes..."
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${WS_FUNCTION}"

INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $WS_API_ID \
  --integration-type AWS_PROXY \
  --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region $REGION --query 'IntegrationId' --output text 2>/dev/null || \
  aws apigatewayv2 get-integrations --api-id $WS_API_ID --region $REGION \
  --query 'Items[0].IntegrationId' --output text)

# Create routes
for ROUTE in '$connect' '$disconnect' 'sendMessage'; do
  aws apigatewayv2 create-route \
    --api-id $WS_API_ID \
    --route-key "$ROUTE" \
    --target "integrations/$INTEGRATION_ID" \
    --region $REGION 2>/dev/null || true
done

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name $WS_FUNCTION \
  --statement-id ws-api-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${WS_API_ID}/*" \
  --region $REGION 2>/dev/null || true

# 5. Deploy
echo "[5/5] Deploying stage..."
aws apigatewayv2 create-stage \
  --api-id $WS_API_ID \
  --stage-name prod \
  --auto-deploy \
  --region $REGION 2>/dev/null || true

WS_URL="wss://${WS_API_ID}.execute-api.${REGION}.amazonaws.com/prod"

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ WebSocket API Deployed!"
echo "════════════════════════════════════════════"
echo "  URL: $WS_URL"
echo "  Lambda: $WS_FUNCTION"
echo "  Table: $WS_TABLE"
echo ""
echo "  Test:"
echo "    wscat -c $WS_URL"
echo "    > {\"action\":\"sendMessage\",\"message\":\"สวัสดี\"}"
echo ""
