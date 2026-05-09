#!/bin/bash
# ════════════════════════════════════════════════════════════════
# SalesFAST 7 — Deploy AI Agents
#
# Deploys the agent-service Lambda + wires API Gateway route.
# Also supports deploying to AgentCore (Python or Docker).
#
# USAGE:
#   bash deploy-agents.sh              # Deploy Lambda (default)
#   bash deploy-agents.sh --lambda     # Deploy Lambda agent-service
#   bash deploy-agents.sh --agentcore  # Deploy AgentCore Python
#   bash deploy-agents.sh --docker     # Deploy AgentCore Docker
#   bash deploy-agents.sh --all        # Deploy all options
#
# Prerequisites:
#   - Main stack deployed (bash deploy.sh)
#   - AI stack deployed (bash deploy-ai.sh)
#   - Bedrock model access enabled (Claude Sonnet)
# ════════════════════════════════════════════════════════════════
set -e

REGION="${AWS_REGION:-ap-southeast-1}"
STACK_NAME="salesfast7-prod"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:---lambda}"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  SalesFAST 7 — AI Agent Deployment"
echo "═══════════════════════════════════════════════════"
echo "  Mode:   ${MODE}"
echo "  Region: ${REGION}"
echo "  Stack:  ${STACK_NAME}"
echo "═══════════════════════════════════════════════════"
echo ""

deploy_lambda() {
  echo "┌─────────────────────────────────────────────┐"
  echo "│  Deploying Agent Service (Lambda)           │"
  echo "└─────────────────────────────────────────────┘"
  echo ""
  cd "$ROOT_DIR/services/agent-service"
  bash deploy.sh
}

deploy_agentcore_py() {
  echo "┌─────────────────────────────────────────────┐"
  echo "│  Deploying AgentCore (Python)               │"
  echo "└─────────────────────────────────────────────┘"
  echo ""
  cd "$ROOT_DIR/services/agentcore-py"
  python3 deploy.py --region "$REGION"

  # After deploy, update CRM Lambda with AgentCore ARN
  echo ""
  echo "  Updating CRM Lambda with AgentCore ARN..."
  RUNTIME_ARN=$(python3 -c "
import boto3
client = boto3.client('bedrock-agentcore-control', region_name='$REGION')
try:
    resp = client.list_agent_runtimes()
    for rt in resp.get('agentRuntimes', []):
        if rt.get('agentRuntimeName') == 'sf7_agents':
            print(rt.get('agentRuntimeArn', ''))
            break
except: pass
" 2>/dev/null || echo "")

  if [ -n "$RUNTIME_ARN" ] && [ "$RUNTIME_ARN" != "None" ]; then
    echo "  ARN: $RUNTIME_ARN"
    CRM_FN="sf7-prod-crm"
    CURRENT_ENV=$(aws lambda get-function-configuration --function-name "$CRM_FN" --region "$REGION" --query "Environment.Variables" --output json 2>/dev/null || echo "{}")
    NEW_ENV=$(echo "$CURRENT_ENV" | python3 -c "import json,sys; d=json.load(sys.stdin); d['AGENTCORE_RUNTIME_ARN']='$RUNTIME_ARN'; d['USE_AGENTCORE']='true'; print(json.dumps(d))" 2>/dev/null || echo "")
    if [ -n "$NEW_ENV" ] && [ "$NEW_ENV" != "" ]; then
      aws lambda update-function-configuration \
        --function-name "$CRM_FN" \
        --environment "{\"Variables\":$NEW_ENV}" \
        --region "$REGION" > /dev/null 2>&1 || true
      echo "  ✅ CRM Lambda updated with AgentCore ARN"
    fi
  else
    echo "  ⚠️  Could not get AgentCore ARN — set AGENTCORE_RUNTIME_ARN manually"
  fi
}

deploy_agentcore_docker() {
  echo "┌─────────────────────────────────────────────┐"
  echo "│  Deploying AgentCore (Docker)               │"
  echo "└─────────────────────────────────────────────┘"
  echo ""
  cd "$ROOT_DIR/services/agentcore"
  bash deploy.sh "$REGION"
}

case "$MODE" in
  --lambda|-l)
    deploy_lambda
    ;;
  --agentcore|--python|-p)
    deploy_agentcore_py
    ;;
  --docker|-d)
    deploy_agentcore_docker
    ;;
  --all|-a)
    deploy_lambda
    echo ""
    deploy_agentcore_py
    ;;
  --help|-h)
    echo "Usage: bash deploy-agents.sh [OPTION]"
    echo ""
    echo "Options:"
    echo "  --lambda, -l      Deploy agent-service as Lambda (default)"
    echo "  --agentcore, -p   Deploy AgentCore Python (S3 code upload)"
    echo "  --docker, -d      Deploy AgentCore Docker (ECR + ARM64)"
    echo "  --all, -a         Deploy Lambda + AgentCore Python"
    echo "  --help, -h        Show this help"
    echo ""
    echo "Deployment comparison:"
    echo "  Lambda:     NestJS, API Gateway, event-driven, ~\$5-10/mo"
    echo "  AgentCore:  Python Strands, serverless AI, ~\$2-5/mo"
    echo "  Docker:     TypeScript Strands, container, ~\$3-8/mo"
    echo ""
    exit 0
    ;;
  *)
    echo "Unknown option: $MODE (use --help)"
    exit 1
    ;;
esac

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Agent Deployment Complete"
echo "═══════════════════════════════════════════════════"
