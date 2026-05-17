#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SalesFAST 7 — Phase 2 Fargate Deployment (using AWS CodeBuild)
# ══════════════════════════════════════════════════════════════
# No local Docker needed! Uses CodeBuild to build ARM64 images.
#
# Usage:
#   ./deploy-fargate.sh ecr            # Step 1: Deploy ECR stack
#   ./deploy-fargate.sh codebuild      # Step 2: Deploy CodeBuild stack
#   ./deploy-fargate.sh build          # Step 3: Upload source + trigger build
#   ./deploy-fargate.sh stack          # Step 4: Deploy main Fargate stack
#   ./deploy-fargate.sh all            # Run all steps in order
#   ./deploy-fargate.sh status         # Show stack outputs
#   ./deploy-fargate.sh logs <service> # Tail logs (core | quotation | line)
# ══════════════════════════════════════════════════════════════

set -e

REGION="ap-southeast-1"
ENV="prod"
ACCOUNT_ID="364478544994"
IMAGE_TAG="${IMAGE_TAG:-v0.1.0}"

ECR_STACK="sf7-${ENV}-fargate-ecr"
CODEBUILD_STACK="sf7-${ENV}-fargate-codebuild"
MAIN_STACK="sf7-${ENV}-fargate"

CFG_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$CFG_DIR/.." && pwd)"

# ──────────────────────────────────────────────────────────────
# Steps
# ──────────────────────────────────────────────────────────────

deploy_ecr() {
  echo "==> Deploying ECR stack: $ECR_STACK"
  aws cloudformation deploy \
    --template-file "$CFG_DIR/ecr-stack.yaml" \
    --stack-name "$ECR_STACK" \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides Environment="$ENV"
  echo "==> ECR stack deployed"
}

deploy_codebuild() {
  echo "==> Deploying CodeBuild stack: $CODEBUILD_STACK"
  aws cloudformation deploy \
    --template-file "$CFG_DIR/codebuild-stack.yaml" \
    --stack-name "$CODEBUILD_STACK" \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides Environment="$ENV"
  echo "==> CodeBuild stack deployed"
}

build_via_codebuild() {
  echo "==> Building via CodeBuild (ARM64) — IMAGE_TAG=$IMAGE_TAG"

  SRC_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$CODEBUILD_STACK" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`SourceBucketName`].OutputValue' \
    --output text)

  PROJECT=$(aws cloudformation describe-stacks \
    --stack-name "$CODEBUILD_STACK" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BuildProjectName`].OutputValue' \
    --output text)

  echo "==> Source bucket: $SRC_BUCKET"
  echo "==> Build project: $PROJECT"

  # Zip source (only services/crm-fargate folder + its files)
  cd "$ROOT_DIR"
  TMP_ZIP="/tmp/sf7-source.zip"
  rm -f "$TMP_ZIP"
  zip -rq "$TMP_ZIP" services/crm-fargate \
    -x "services/crm-fargate/node_modules/*" \
    -x "services/crm-fargate/dist/*" \
    -x "services/crm-fargate/.env*"

  echo "==> Uploading source ($(du -h $TMP_ZIP | cut -f1))"
  aws s3 cp "$TMP_ZIP" "s3://$SRC_BUCKET/source.zip" --region "$REGION"

  echo "==> Starting CodeBuild..."
  BUILD_ID=$(aws codebuild start-build \
    --project-name "$PROJECT" \
    --region "$REGION" \
    --environment-variables-override "name=IMAGE_TAG,value=$IMAGE_TAG,type=PLAINTEXT" \
    --query 'build.id' \
    --output text)
  echo "==> Build ID: $BUILD_ID"

  # Stream logs
  echo "==> Waiting for build to complete (this may take 5-10 minutes)..."
  while true; do
    STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
      --query 'builds[0].buildStatus' --output text)
    if [ "$STATUS" == "SUCCEEDED" ]; then
      echo "==> Build SUCCEEDED"
      break
    elif [ "$STATUS" == "FAILED" ] || [ "$STATUS" == "FAULT" ] || [ "$STATUS" == "TIMED_OUT" ] || [ "$STATUS" == "STOPPED" ]; then
      echo "==> Build $STATUS"
      LOG_GROUP=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
        --query 'builds[0].logs.groupName' --output text)
      LOG_STREAM=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
        --query 'builds[0].logs.streamName' --output text)
      echo "==> View logs: aws logs tail $LOG_GROUP --region $REGION"
      exit 1
    fi
    echo "    Status: $STATUS"
    sleep 15
  done

  echo "==> Images pushed to ECR with tag: $IMAGE_TAG"
}

deploy_stack() {
  echo "==> Deploying main Fargate stack: $MAIN_STACK (ImageTag=$IMAGE_TAG)"
  aws cloudformation deploy \
    --template-file "$CFG_DIR/fargate-stack.yaml" \
    --stack-name "$MAIN_STACK" \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
      Environment="$ENV" \
      ImageTag="$IMAGE_TAG"
  echo "==> Fargate stack deployed"
}

show_status() {
  echo "==> Main Stack Outputs:"
  aws cloudformation describe-stacks \
    --stack-name "$MAIN_STACK" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs' \
    --output table
  echo ""
  echo "==> ECS Services:"
  aws ecs list-services --cluster "sf7-${ENV}-cluster" --region "$REGION" \
    --query 'serviceArns' --output table
}

tail_logs() {
  SVC="${1:-core}"
  LOG_GROUP="/ecs/sf7-$ENV-crm-$SVC"
  echo "==> Tailing logs from $LOG_GROUP"
  aws logs tail "$LOG_GROUP" --region "$REGION" --follow
}

case "${1:-help}" in
  ecr)        deploy_ecr ;;
  codebuild)  deploy_codebuild ;;
  build)      build_via_codebuild ;;
  stack)      deploy_stack ;;
  status)     show_status ;;
  logs)       tail_logs "$2" ;;
  all)
    deploy_ecr
    deploy_codebuild
    build_via_codebuild
    deploy_stack
    show_status
    ;;
  *)
    echo "Usage: $0 {ecr|codebuild|build|stack|all|status|logs <service>}"
    echo ""
    echo "Steps in order:"
    echo "  1. $0 ecr        — Create ECR repos"
    echo "  2. $0 codebuild  — Create CodeBuild project"
    echo "  3. $0 build      — Build images via CodeBuild (no local Docker)"
    echo "  4. $0 stack      — Deploy ECS Cluster + ALB + Services"
    echo ""
    echo "Or: $0 all          — Run all 4 steps"
    echo ""
    echo "Other:"
    echo "  $0 status        — Show stack outputs (ALB DNS, etc.)"
    echo "  $0 logs core     — Tail crm-core logs"
    exit 1
    ;;
esac
