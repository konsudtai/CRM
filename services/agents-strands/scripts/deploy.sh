#!/bin/bash
# ════════════════════════════════════════════════════════════
# SalesFAST 7 — Phase 3 Deploy Strands Agents to AgentCore Runtime
# ════════════════════════════════════════════════════════════
#
# Usage:
#   ./deploy.sh stack    # Step 1: Deploy ECR + CodeBuild + IAM (CFN)
#   ./deploy.sh build    # Step 2: Upload source + build via CodeBuild
#   ./deploy.sh runtime  # Step 3: Create/update AgentCore Runtime
#   ./deploy.sh all
# ════════════════════════════════════════════════════════════

set -e

REGION="ap-southeast-1"
ENV="prod"
ACCOUNT_ID="364478544994"
IMAGE_TAG="${IMAGE_TAG:-v0.1.0}"

STACK_NAME="sf7-${ENV}-agents-strands"

CFG_DIR="$(cd "$(dirname "$0")/../../../infra" && pwd)"
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

deploy_stack() {
  echo "==> Deploying $STACK_NAME"
  aws cloudformation deploy \
    --template-file "$CFG_DIR/agents-strands-stack.yaml" \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides Environment="$ENV"
  echo "==> Done"
}

build_images() {
  echo "==> Building Strands agent images via CodeBuild"

  SRC_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`AgentSourceBucketName`].OutputValue' --output text)

  PROJECT_SALES=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BuildSalesProject`].OutputValue' --output text)

  PROJECT_ANALYTICS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BuildAnalyticsProject`].OutputValue' --output text)

  echo "==> Source bucket: $SRC_BUCKET"
  echo "==> Build projects: $PROJECT_SALES, $PROJECT_ANALYTICS"

  # Zip source
  TMP_ZIP="/tmp/sf7-agents-strands.zip"
  rm -f "$TMP_ZIP"
  cd "$ROOT_DIR"
  zip -rq "$TMP_ZIP" services/agents-strands \
    -x "services/agents-strands/scripts/*" \
    -x "services/agents-strands/**/__pycache__/*" \
    -x "services/agents-strands/memory-ids.json"

  echo "==> Uploading source ($(du -h $TMP_ZIP | cut -f1))"
  aws s3 cp "$TMP_ZIP" "s3://$SRC_BUCKET/source.zip" --region "$REGION"

  # Trigger both builds in parallel
  echo "==> Starting builds (parallel)..."
  BUILD_SALES=$(aws codebuild start-build \
    --project-name "$PROJECT_SALES" --region "$REGION" \
    --environment-variables-override "name=IMAGE_TAG,value=$IMAGE_TAG,type=PLAINTEXT" \
    --query 'build.id' --output text)
  echo "    Sales build: $BUILD_SALES"

  BUILD_ANALYTICS=$(aws codebuild start-build \
    --project-name "$PROJECT_ANALYTICS" --region "$REGION" \
    --environment-variables-override "name=IMAGE_TAG,value=$IMAGE_TAG,type=PLAINTEXT" \
    --query 'build.id' --output text)
  echo "    Analytics build: $BUILD_ANALYTICS"

  # Wait for both
  for BID in "$BUILD_SALES" "$BUILD_ANALYTICS"; do
    NAME=$( [ "$BID" == "$BUILD_SALES" ] && echo "sales" || echo "analytics" )
    echo "==> Waiting for $NAME build..."
    while true; do
      STATUS=$(aws codebuild batch-get-builds --ids "$BID" --region "$REGION" \
        --query 'builds[0].buildStatus' --output text)
      if [ "$STATUS" == "SUCCEEDED" ]; then
        echo "    $NAME: SUCCEEDED"
        break
      elif [ "$STATUS" == "FAILED" ] || [ "$STATUS" == "FAULT" ] || [ "$STATUS" == "TIMED_OUT" ]; then
        echo "    $NAME: $STATUS"
        exit 1
      fi
      sleep 15
    done
  done

  echo "==> Both builds complete"
}

deploy_runtime() {
  echo "==> Creating/updating AgentCore Runtimes..."
  python3 "$(dirname "$0")/deploy-runtime.py"
}

show_status() {
  echo "==> Stack outputs:"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs' \
    --output table
}

case "${1:-help}" in
  stack)   deploy_stack ;;
  build)   build_images ;;
  runtime) deploy_runtime ;;
  status)  show_status ;;
  all)
    deploy_stack
    build_images
    deploy_runtime
    show_status
    ;;
  *)
    echo "Usage: $0 {stack|build|runtime|all|status}"
    exit 1
    ;;
esac
