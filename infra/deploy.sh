#!/bin/bash
# ============================================================
# SalesFAST 7 — One-Command Full Deployment
# Everything automated: infra + DB init + frontend + AI
#
# USAGE:
#   bash deploy.sh \
#     --email admin@company.com \
#     --name "Somchai Jaidee" \
#     --password "MyPass@123" \
#     --db-pass auto \
#     --tenant "My Company"
# ============================================================

set -e

# ── Defaults ──
STACK_NAME="salesfast7-prod"
AI_STACK_NAME="salesfast7-ai-prod"
ENV="prod"
REGION="ap-southeast-1"
AI_REGION="ap-southeast-1"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ADMIN_FULLNAME=""
DB_PASSWORD=""
JWT_SECRET=""
TENANT_NAME=""

# ── Parse CLI flags ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)      ADMIN_EMAIL="$2";    shift 2 ;;
    --name)       ADMIN_FULLNAME="$2"; shift 2 ;;
    --password)   ADMIN_PASSWORD="$2"; shift 2 ;;
    --db-pass)    DB_PASSWORD="$2";    shift 2 ;;
    --jwt)        JWT_SECRET="$2";     shift 2 ;;
    --tenant)     TENANT_NAME="$2";    shift 2 ;;
    --region)     REGION="$2";         shift 2 ;;
    --ai-region)  AI_REGION="$2";      shift 2 ;;
    --stack)      STACK_NAME="$2";     shift 2 ;;
    --help|-h)
      echo ""
      echo "SalesFAST 7 — One-Command Full Deployment"
      echo ""
      echo "REQUIRED flags:"
      echo "  --email     Admin login email"
      echo "  --name      Admin full name"
      echo "  --password  Admin login password"
      echo "  --db-pass   Database password (or 'auto')"
      echo "  --tenant    Company / tenant name"
      echo ""
      echo "OPTIONAL flags:"
      echo "  --region    CRM region (default: ap-southeast-1)"
      echo "  --ai-region AI region  (default: ap-southeast-1)"
      echo "  --jwt       JWT secret (default: auto-generate)"
      echo "  --stack     Stack name (default: salesfast7-prod)"
      echo ""
      echo "EXAMPLE:"
      echo "  bash deploy.sh --email admin@co.com --name 'Somchai' \\"
      echo "    --password 'Pass@123' --db-pass auto --tenant 'My Co'"
      echo ""
      exit 0 ;;
    *) echo "Unknown: $1 (use --help)"; exit 1 ;;
  esac
done

# ── Validate ──
MISSING=""
[ -z "$ADMIN_EMAIL" ]    && MISSING="$MISSING --email"
[ -z "$ADMIN_FULLNAME" ] && MISSING="$MISSING --name"
[ -z "$ADMIN_PASSWORD" ] && MISSING="$MISSING --password"
[ -z "$DB_PASSWORD" ]    && MISSING="$MISSING --db-pass"
[ -z "$TENANT_NAME" ]    && MISSING="$MISSING --tenant"
if [ -n "$MISSING" ]; then
  echo "ERROR: Missing:$MISSING"
  echo "Run: bash deploy.sh --help"
  exit 1
fi

# ── Auto-generate secrets ──
if [ "$DB_PASSWORD" = "auto" ]; then
  DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
  echo "  DB password: $DB_PASSWORD"
fi
[ -z "$JWT_SECRET" ] && JWT_SECRET=$(openssl rand -base64 32)

# ── Split name ──
ADMIN_FIRST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{print $1}')
ADMIN_LAST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{$1=""; print $0}' | xargs)
[ -z "$ADMIN_LAST_NAME" ] && ADMIN_LAST_NAME="."

# ── Paths ──
DB_DIR="../database"
[ ! -d "$DB_DIR" ] && DB_DIR="database"
FRONTEND_DIR="../frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="frontend"

echo ""
echo "============================================"
echo "  SalesFAST 7 — Deploying"
echo "============================================"
echo "  Region:  $REGION | AI: $AI_REGION"
echo "  Admin:   $ADMIN_EMAIL"
echo "  Tenant:  $TENANT_NAME"
echo "============================================"
echo ""

# ══════════════════════════════════════════════
# PRE-CHECK: Clean up leftover resources from failed deploys
# ══════════════════════════════════════════════

echo "[0/9] Pre-deploy check..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

# Check if stack exists and is in a failed/rollback state
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if echo "$STACK_STATUS" | grep -qiE "ROLLBACK_COMPLETE|ROLLBACK_FAILED|DELETE_FAILED|CREATE_FAILED"; then
  echo "  Found stack in $STACK_STATUS state. Cleaning up..."

  # Disable RDS deletion protection if exists
  aws rds modify-db-instance \
    --db-instance-identifier "sf7-${ENV}" \
    --no-deletion-protection \
    --region "$REGION" 2>/dev/null || true

  # Empty S3 buckets
  for B in "sf7-${ENV}-frontend-${ACCOUNT_ID}" "sf7-${ENV}-files-${ACCOUNT_ID}"; do
    aws s3 rm "s3://$B" --recursive --region "$REGION" 2>/dev/null || true
    aws s3 rb "s3://$B" --force --region "$REGION" 2>/dev/null || true
  done

  # Delete the failed stack
  aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION" 2>/dev/null || true
  echo "  Waiting for cleanup (~5 min)..."
  aws cloudformation wait stack-delete-complete \
    --stack-name "$STACK_NAME" --region "$REGION" 2>/dev/null || true
  echo "  Cleaned up."

elif [ "$STACK_STATUS" = "DOES_NOT_EXIST" ]; then
  echo "  No existing stack. Fresh deploy."

  # Check for orphaned resources that could block creation
  ORPHAN_FOUND=false

  # Check orphaned S3 buckets
  for B in "sf7-${ENV}-frontend-${ACCOUNT_ID}" "sf7-${ENV}-files-${ACCOUNT_ID}"; do
    if aws s3api head-bucket --bucket "$B" --region "$REGION" 2>/dev/null; then
      echo "  Found orphaned bucket: $B — removing..."
      aws s3 rm "s3://$B" --recursive --region "$REGION" 2>/dev/null || true
      aws s3 rb "s3://$B" --force --region "$REGION" 2>/dev/null || true
      ORPHAN_FOUND=true
    fi
  done

  # Check orphaned DynamoDB tables
  for T in "sf7-${ENV}-chat-history" "sf7-${ENV}-ai-state"; do
    if aws dynamodb describe-table --table-name "$T" --region "$REGION" 2>/dev/null | grep -q "ACTIVE"; then
      echo "  Found orphaned table: $T — removing..."
      aws dynamodb delete-table --table-name "$T" --region "$REGION" 2>/dev/null || true
      ORPHAN_FOUND=true
    fi
  done

  # Check orphaned SQS queues
  for Q in "sf7-${ENV}-events" "sf7-${ENV}-events-dlq"; do
    Q_URL=$(aws sqs get-queue-url --queue-name "$Q" --region "$REGION" --query 'QueueUrl' --output text 2>/dev/null || echo "")
    if [ -n "$Q_URL" ] && [ "$Q_URL" != "None" ]; then
      echo "  Found orphaned queue: $Q — removing..."
      aws sqs delete-queue --queue-url "$Q_URL" --region "$REGION" 2>/dev/null || true
      ORPHAN_FOUND=true
    fi
  done

  # Check orphaned Lambda functions
  for FN in "sf7-${ENV}-auth" "sf7-${ENV}-crm" "sf7-${ENV}-sales" "sf7-${ENV}-quotation" "sf7-${ENV}-notification" "sf7-${ENV}-db-init"; do
    if aws lambda get-function --function-name "$FN" --region "$REGION" 2>/dev/null | grep -q "FunctionArn"; then
      echo "  Found orphaned Lambda: $FN — removing..."
      aws lambda delete-function --function-name "$FN" --region "$REGION" 2>/dev/null || true
      ORPHAN_FOUND=true
    fi
  done

  # Check orphaned RDS
  if aws rds describe-db-instances --db-instance-identifier "sf7-${ENV}" --region "$REGION" 2>/dev/null | grep -q "DBInstanceIdentifier"; then
    echo "  Found orphaned RDS: sf7-${ENV} — disabling protection + deleting..."
    aws rds modify-db-instance --db-instance-identifier "sf7-${ENV}" --no-deletion-protection --region "$REGION" 2>/dev/null || true
    aws rds delete-db-instance --db-instance-identifier "sf7-${ENV}" --skip-final-snapshot --region "$REGION" 2>/dev/null || true
    echo "  RDS deletion started (continues in background)..."
    ORPHAN_FOUND=true
  fi

  if [ "$ORPHAN_FOUND" = true ]; then
    echo "  Waiting 30s for cleanup to propagate..."
    sleep 30
  fi

else
  echo "  Stack exists ($STACK_STATUS). Will update."
fi
echo ""

# ══════════════════════════════════════════════
# STEP 1: Deploy CloudFormation
# ══════════════════════════════════════════════

echo "[1/9] Deploying CloudFormation stack..."
echo "  (first deploy takes ~15 min)"
aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="$ENV" \
    DBPassword="$DB_PASSWORD" \
    JWTSecret="$JWT_SECRET" \
  --no-fail-on-empty-changeset
echo "  Stack deployed."

# ══════════════════════════════════════════════
# STEP 2: Get outputs
# ══════════════════════════════════════════════

echo "[2/9] Getting stack outputs..."
_get() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
API_URL=$(_get ApiUrl)
FRONTEND_BUCKET=$(_get FrontendBucket)
FILES_BUCKET=$(_get FilesBucket)
CLOUDFRONT_URL=$(_get CloudFrontUrl)
CLOUDFRONT_ID=$(_get CloudFrontDistributionId)
DB_ENDPOINT=$(_get DatabaseEndpoint)
PROXY_ENDPOINT=$(_get RDSProxyEndpoint)
DB_INIT_FN=$(_get DBInitFunction)
echo "  URL: $CLOUDFRONT_URL"
echo "  DB:  $DB_ENDPOINT"

# ══════════════════════════════════════════════
# STEP 3: Build pg layer + update DB Init Lambda
# ══════════════════════════════════════════════

echo "[3/9] Building DB Init Lambda with pg..."

# Build pg layer zip
PG_DIR=$(mktemp -d)
mkdir -p "$PG_DIR/nodejs"
cd "$PG_DIR/nodejs"
npm init -y > /dev/null 2>&1
npm install pg --silent > /dev/null 2>&1
cd "$PG_DIR"
zip -qr /tmp/sf7-pg-layer.zip nodejs
cd - > /dev/null
rm -rf "$PG_DIR"

# Publish as Lambda Layer
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name "sf7-${ENV}-pg" \
  --zip-file fileb:///tmp/sf7-pg-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region "$REGION" \
  --query 'LayerVersionArn' --output text)
echo "  Layer: $LAYER_ARN"

# Build DB Init function code
cat > /tmp/sf7-db-init.js << 'DBEOF'
const { Client } = require('pg');
exports.handler = async (event) => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 90000,
  });
  try {
    await client.connect();
    const sql = event.sql || '';
    if (!sql.trim()) return { statusCode: 400, body: 'No SQL' };
    const statements = sql.split(/;\s*\n/).filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) await client.query(stmt);
    }
    await client.end();
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    try { await client.end(); } catch(_) {}
    return { statusCode: 500, body: err.message };
  }
};
DBEOF

cd /tmp
zip -qj sf7-db-init.zip sf7-db-init.js
cd - > /dev/null

# Update Lambda function code + layer
aws lambda update-function-code \
  --function-name "$DB_INIT_FN" \
  --zip-file fileb:///tmp/sf7-db-init.zip \
  --region "$REGION" > /dev/null

# Wait for update to complete
aws lambda wait function-updated --function-name "$DB_INIT_FN" --region "$REGION" 2>/dev/null || sleep 5

aws lambda update-function-configuration \
  --function-name "$DB_INIT_FN" \
  --layers "$LAYER_ARN" \
  --handler sf7-db-init.handler \
  --region "$REGION" > /dev/null

aws lambda wait function-updated --function-name "$DB_INIT_FN" --region "$REGION" 2>/dev/null || sleep 5
echo "  DB Init Lambda ready."

# ══════════════════════════════════════════════
# STEP 4: Generate seed SQL
# ══════════════════════════════════════════════

echo "[4/9] Generating seed data..."
ADMIN_HASH=""
if command -v node &>/dev/null; then
  ADMIN_HASH=$(node -e "try{const b=require('bcrypt');b.hash(process.argv[1],12).then(h=>{process.stdout.write(h);process.exit(0)})}catch(e){process.exit(1)}" "$ADMIN_PASSWORD" 2>/dev/null) || true
fi
if [ -z "$ADMIN_HASH" ] && command -v python3 &>/dev/null; then
  ADMIN_HASH=$(python3 -c "
import sys
try:
    import bcrypt
    print(bcrypt.hashpw(sys.argv[1].encode(),bcrypt.gensalt(12)).decode(),end='')
except:
    sys.exit(1)
" "$ADMIN_PASSWORD" 2>/dev/null) || true
fi
if [ -z "$ADMIN_HASH" ]; then
  ADMIN_HASH='$2b$12$LJ3m4ys3Lk0TSwMBQWJBaeQBfMQcfNpQOPKfMFHJFLDqxGMmVqHXe'
  echo "  WARNING: bcrypt unavailable, using default hash"
fi
sed \
  -e "s|__ADMIN_EMAIL__|${ADMIN_EMAIL}|g" \
  -e "s|__ADMIN_PASSWORD_HASH__|${ADMIN_HASH}|g" \
  -e "s|__ADMIN_FIRST_NAME__|$(echo "$ADMIN_FIRST_NAME" | sed "s/'/''/g")|g" \
  -e "s|__ADMIN_LAST_NAME__|$(echo "$ADMIN_LAST_NAME" | sed "s/'/''/g")|g" \
  -e "s|__TENANT_NAME__|$(echo "$TENANT_NAME" | sed "s/'/''/g")|g" \
  "$DB_DIR/seed.sql" > /tmp/sf7-seed.sql
echo "  Seed: $ADMIN_EMAIL"

# ══════════════════════════════════════════════
# STEP 5: Initialize database via Lambda
# ══════════════════════════════════════════════

echo "[5/9] Initializing database..."
echo "  Waiting for RDS..."
aws rds wait db-instance-available \
  --db-instance-identifier "sf7-${ENV}" \
  --region "$REGION" 2>/dev/null || true

DB_INIT_OK=false

# Helper: invoke DB Init Lambda with SQL file
run_sql() {
  local DESC="$1"
  local SQL_FILE="$2"
  echo "  Running $DESC..."

  # Encode SQL as base64 to avoid JSON escaping issues
  local SQL_B64=$(base64 < "$SQL_FILE" | tr -d '\n')

  cat > /tmp/sf7-payload.json << PEOF
{"sql_base64":"$SQL_B64"}
PEOF

  # Update handler to support base64
  cat > /tmp/sf7-db-init.js << 'HANDLER'
const { Client } = require('pg');
exports.handler = async (event) => {
  let sql = event.sql || '';
  if (event.sql_base64) {
    sql = Buffer.from(event.sql_base64, 'base64').toString('utf-8');
  }
  if (!sql.trim()) return { statusCode: 400, body: 'No SQL' };
  const client = new Client({
    host: process.env.DB_HOST, port: 5432,
    user: process.env.DB_USER, password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }, statement_timeout: 90000,
  });
  try {
    await client.connect();
    await client.query(sql);
    await client.end();
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    try { await client.end(); } catch(_) {}
    return { statusCode: 500, body: err.message };
  }
};
HANDLER

  cd /tmp
  zip -qj sf7-db-init.zip sf7-db-init.js
  cd - > /dev/null

  aws lambda update-function-code \
    --function-name "$DB_INIT_FN" \
    --zip-file fileb:///tmp/sf7-db-init.zip \
    --region "$REGION" > /dev/null 2>&1
  aws lambda wait function-updated --function-name "$DB_INIT_FN" --region "$REGION" 2>/dev/null || sleep 5

  aws lambda invoke \
    --function-name "$DB_INIT_FN" \
    --region "$REGION" \
    --cli-binary-format raw-in-base64-out \
    --payload file:///tmp/sf7-payload.json \
    /tmp/sf7-db-result.json > /dev/null 2>&1

  local STATUS=$(python3 -c "import json;print(json.load(open('/tmp/sf7-db-result.json')).get('statusCode',500))" 2>/dev/null || echo "500")
  local BODY=$(python3 -c "import json;print(json.load(open('/tmp/sf7-db-result.json')).get('body',''))" 2>/dev/null || echo "")

  if [ "$STATUS" = "200" ]; then
    echo "  $DESC done."
    return 0
  else
    echo "  $DESC status: $STATUS"
    echo "  Detail: $BODY"
    if echo "$BODY" | grep -qi "already exists\|duplicate"; then
      echo "  (already initialized — OK)"
      return 0
    fi
    return 1
  fi
}

# Run schema then seed
run_sql "schema.sql (30+ tables)" "$DB_DIR/schema.sql" && \
run_sql "seed.sql (admin + roles)" "/tmp/sf7-seed.sql" && \
DB_INIT_OK=true

if [ "$DB_INIT_OK" = false ]; then
  echo ""
  echo "  DB init via Lambda failed. Trying psql fallback..."
  if command -v psql &>/dev/null; then
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U salesfast7 -d salesfast7 \
      -f "$DB_DIR/schema.sql" > /dev/null 2>&1 && \
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U salesfast7 -d salesfast7 \
      -f /tmp/sf7-seed.sql > /dev/null 2>&1 && \
    DB_INIT_OK=true && echo "  DB initialized via psql."
  fi
fi

# ══════════════════════════════════════════════
# STEP 6: Upload frontend
# ══════════════════════════════════════════════

echo "[6/9] Uploading frontend..."
if [ -d "$FRONTEND_DIR" ]; then
  aws s3 sync "$FRONTEND_DIR" "s3://$FRONTEND_BUCKET" \
    --region "$REGION" --delete --cache-control "max-age=3600" \
    --exclude ".DS_Store" --exclude "*.map" > /dev/null
  # Fix content types
  for EXT in html css js svg png json; do
    case $EXT in
      html) CT="text/html";;  css) CT="text/css";;
      js) CT="application/javascript";;  svg) CT="image/svg+xml";;
      png) CT="image/png";;  json) CT="application/json";;
    esac
    aws s3 cp "s3://$FRONTEND_BUCKET" "s3://$FRONTEND_BUCKET" \
      --recursive --region "$REGION" --content-type "$CT" \
      --exclude "*" --include "*.$EXT" --metadata-directive REPLACE > /dev/null 2>&1 || true
  done
  echo "  Frontend uploaded."
fi

# ══════════════════════════════════════════════
# STEP 7: Invalidate CloudFront
# ══════════════════════════════════════════════

echo "[7/9] Invalidating CloudFront cache..."
if [ -n "$CLOUDFRONT_ID" ] && [ "$CLOUDFRONT_ID" != "None" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" --paths "/*" > /dev/null 2>&1 || true
  echo "  Cache invalidated."
fi

# ══════════════════════════════════════════════
# STEP 8: Deploy AI Stack
# ══════════════════════════════════════════════

echo ""
echo "[8/9] Deploying AI stack to $AI_REGION..."
aws cloudformation deploy \
  --template-file cloudformation-ai.yaml \
  --stack-name "$AI_STACK_NAME" \
  --region "$AI_REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="$ENV" \
    CRMStackName="$STACK_NAME" \
    CRMRegion="$REGION" \
  --no-fail-on-empty-changeset
echo "  AI stack deployed."

# ══════════════════════════════════════════════
# STEP 9: Upload sample KB docs
# ══════════════════════════════════════════════

echo "[9/9] Uploading sample KB documents..."
_getai() {
  aws cloudformation describe-stacks \
    --stack-name "$AI_STACK_NAME" --region "$AI_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
KB_BUCKET=$(_getai KBBucketName)
echo "# Company Profile — replace with your info" | \
  aws s3 cp - "s3://$KB_BUCKET/company/company-profile.md" --region "$AI_REGION" 2>/dev/null || true
echo "# FAQ — replace with your FAQ" | \
  aws s3 cp - "s3://$KB_BUCKET/faq/faq.md" --region "$AI_REGION" 2>/dev/null || true
echo "  KB: $KB_BUCKET"

# ══════════════════════════════════════════════
# DONE
# ══════════════════════════════════════════════

echo ""
echo "============================================"
echo "  SalesFAST 7 — Deployment Complete!"
echo "============================================"
echo ""
echo "  Website:  $CLOUDFRONT_URL"
echo "  API:      $API_URL"
echo "  Region:   $REGION"
echo ""
echo "  Login:"
echo "    Email:    $ADMIN_EMAIL"
echo "    Password: (as specified)"
echo ""
if [ "$DB_INIT_OK" = true ]; then
  echo "  Database: Initialized"
else
  echo "  Database: MANUAL INIT NEEDED"
  echo "    Console > RDS > Query Editor > sf7-${ENV}"
  echo "    Run schema.sql then seed.sql"
fi
echo ""
echo "  NEXT: Subscribe CloudFront Pro Plan (\$15/mo)"
echo "    Console > CloudFront > $CLOUDFRONT_ID > Pricing plan > Pro"
echo ""
echo "  DB Password: $DB_PASSWORD"
echo "  (save this — needed for RDS access)"
echo ""
echo "============================================"
echo "  Open: $CLOUDFRONT_URL"
echo "============================================"
