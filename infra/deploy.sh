#!/bin/bash
# ============================================================
# SalesFAST 7 — One-Command Full Deployment
# Everything automated: infra + frontend + database + AI
#
# USAGE (Singapore — default):
#   bash deploy.sh \
#     --email admin@company.com \
#     --name "Somchai Jaidee" \
#     --password "MyPass@123" \
#     --db-pass auto \
#     --tenant "My Company"
#
# USAGE (Thailand):
#   bash deploy.sh \
#     --email admin@company.com \
#     --name "Somchai Jaidee" \
#     --password "MyPass@123" \
#     --db-pass auto \
#     --tenant "My Company" \
#     --region ap-southeast-7
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
      echo "  --email     <email>     Admin login email"
      echo "  --name      <fullname>  Admin full name"
      echo "  --password  <pass>      Admin login password"
      echo "  --db-pass   <pass>      Database password (or 'auto' to generate)"
      echo "  --tenant    <name>      Company / tenant name"
      echo ""
      echo "OPTIONAL flags:"
      echo "  --region    <region>    CRM region (default: ap-southeast-1 Singapore)"
      echo "  --ai-region <region>    AI/Bedrock region (default: ap-southeast-1)"
      echo "  --jwt       <secret>    JWT secret (default: auto-generate)"
      echo "  --stack     <name>      Stack name (default: salesfast7-prod)"
      echo ""
      echo "EXAMPLE (Singapore — default, recommended):"
      echo "  bash deploy.sh \\"
      echo "    --email admin@mycompany.com \\"
      echo "    --name 'Somchai Jaidee' \\"
      echo "    --password 'MyPass@123' \\"
      echo "    --db-pass auto \\"
      echo "    --tenant 'My Company Ltd'"
      echo ""
      echo "EXAMPLE (Thailand region):"
      echo "  bash deploy.sh \\"
      echo "    --email admin@mycompany.com \\"
      echo "    --name 'Somchai Jaidee' \\"
      echo "    --password 'MyPass@123' \\"
      echo "    --db-pass auto \\"
      echo "    --tenant 'My Company Ltd' \\"
      echo "    --region ap-southeast-7"
      echo ""
      exit 0
      ;;
    *) echo "Unknown option: $1 (use --help)"; exit 1 ;;
  esac
done

# ── Validate REQUIRED fields ──
MISSING=""
[ -z "$ADMIN_EMAIL" ]    && MISSING="$MISSING --email"
[ -z "$ADMIN_FULLNAME" ] && MISSING="$MISSING --name"
[ -z "$ADMIN_PASSWORD" ] && MISSING="$MISSING --password"
[ -z "$DB_PASSWORD" ]    && MISSING="$MISSING --db-pass"
[ -z "$TENANT_NAME" ]    && MISSING="$MISSING --tenant"

if [ -n "$MISSING" ]; then
  echo ""
  echo "ERROR: Missing required flags:$MISSING"
  echo ""
  echo "Usage:"
  echo "  bash deploy.sh \\"
  echo "    --email admin@company.com \\"
  echo "    --name 'John Doe' \\"
  echo "    --password 'Pass@123' \\"
  echo "    --db-pass auto \\"
  echo "    --tenant 'My Company'"
  echo ""
  echo "Default region: ap-southeast-1 (Singapore)"
  echo "Override with: --region ap-southeast-7 (Thailand)"
  echo ""
  exit 1
fi

# ── Auto-generate secrets ──
if [ "$DB_PASSWORD" = "auto" ]; then
  DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
  echo "  DB password auto-generated: $DB_PASSWORD"
fi
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
fi

# ── Split full name ──
ADMIN_FIRST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{print $1}')
ADMIN_LAST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{$1=""; print $0}' | xargs)
[ -z "$ADMIN_LAST_NAME" ] && ADMIN_LAST_NAME="."

# ── Resolve paths ──
DB_DIR="../database"
[ ! -d "$DB_DIR" ] && DB_DIR="database"
FRONTEND_DIR="../frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="frontend"

echo ""
echo "============================================"
echo "  SalesFAST 7 — One-Command Deployment"
echo "============================================"
echo ""
echo "  CRM Region:  $REGION"
echo "  AI Region:   $AI_REGION"
echo "  Admin:       $ADMIN_EMAIL ($ADMIN_FULLNAME)"
echo "  Tenant:      $TENANT_NAME"
echo "  Stack:       $STACK_NAME"
echo ""

# ══════════════════════════════════════════════════════════
# STEP 1: Build pg Lambda Layer (for DB Init)
# ══════════════════════════════════════════════════════════

echo "[1/10] Building pg Lambda Layer..."
PG_LAYER_DIR=$(mktemp -d)
mkdir -p "$PG_LAYER_DIR/nodejs"
pushd "$PG_LAYER_DIR/nodejs" > /dev/null
npm init -y --silent > /dev/null 2>&1
npm install pg --silent > /dev/null 2>&1
popd > /dev/null
pushd "$PG_LAYER_DIR" > /dev/null
zip -qr /tmp/pg-layer.zip nodejs
popd > /dev/null
rm -rf "$PG_LAYER_DIR"
echo "  pg layer built: /tmp/pg-layer.zip"

# ══════════════════════════════════════════════════════════
# STEP 2: Pre-create S3 bucket + upload layer
# We need the bucket to exist before CloudFormation runs
# because PgLayer references S3Key in the bucket
# ══════════════════════════════════════════════════════════

echo "[2/10] Preparing S3 bucket for Lambda layer..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
LAYER_BUCKET="sf7-${ENV}-files-${ACCOUNT_ID}"

# Create bucket if not exists
aws s3api head-bucket --bucket "$LAYER_BUCKET" --region "$REGION" 2>/dev/null || \
  aws s3api create-bucket --bucket "$LAYER_BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" > /dev/null 2>&1 || true

aws s3 cp /tmp/pg-layer.zip "s3://$LAYER_BUCKET/layers/pg-layer.zip" --region "$REGION" > /dev/null
echo "  Layer uploaded to s3://$LAYER_BUCKET/layers/pg-layer.zip"

# ══════════════════════════════════════════════════════════
# STEP 3: Deploy CRM CloudFormation Stack
# ══════════════════════════════════════════════════════════

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1: CRM Stack ($REGION)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[3/10] Deploying CloudFormation stack..."
echo "  (this takes 10-15 minutes on first deploy)"
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

# ══════════════════════════════════════════════════════════
# STEP 4: Get Stack Outputs
# ══════════════════════════════════════════════════════════

echo "[4/10] Getting stack outputs..."
_get() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
API_URL=$(_get ApiUrl)
FRONTEND_BUCKET=$(_get FrontendBucket)
CLOUDFRONT_URL=$(_get CloudFrontUrl)
CLOUDFRONT_ID=$(_get CloudFrontDistributionId)
DB_ENDPOINT=$(_get DatabaseEndpoint)
PROXY_ENDPOINT=$(_get RDSProxyEndpoint)
DB_INIT_FN=$(_get DBInitFunction)
echo "  CloudFront: $CLOUDFRONT_URL"
echo "  API:        $API_URL"
echo "  DB:         $DB_ENDPOINT"
echo "  DB Init:    $DB_INIT_FN"

# ══════════════════════════════════════════════════════════
# STEP 5: Generate Seed SQL
# ══════════════════════════════════════════════════════════

echo "[5/10] Generating seed data..."
ADMIN_HASH=""
ADMIN_HASH=$(node -e "try{const b=require('bcrypt');b.hash(process.argv[1],12).then(h=>{process.stdout.write(h);process.exit(0)})}catch(e){process.exit(1)}" "$ADMIN_PASSWORD" 2>/dev/null) || true
if [ -z "$ADMIN_HASH" ]; then
  ADMIN_HASH=$(python3 -c "import sys;exec('try:\n import bcrypt\n print(bcrypt.hashpw(sys.argv[1].encode(),bcrypt.gensalt(12)).decode(),end=\"\")\nexcept:\n sys.exit(1)')" "$ADMIN_PASSWORD" 2>/dev/null) || true
fi
if [ -z "$ADMIN_HASH" ]; then
  ADMIN_HASH='$2b$12$LJ3m4ys3Lk0TSwMBQWJBaeQBfMQcfNpQOPKfMFHJFLDqxGMmVqHXe'
  echo "  WARNING: bcrypt not available, using default hash (change password after login)"
fi
sed \
  -e "s|__ADMIN_EMAIL__|${ADMIN_EMAIL}|g" \
  -e "s|__ADMIN_PASSWORD_HASH__|${ADMIN_HASH}|g" \
  -e "s|__ADMIN_FIRST_NAME__|$(echo "$ADMIN_FIRST_NAME" | sed "s/'/''/g")|g" \
  -e "s|__ADMIN_LAST_NAME__|$(echo "$ADMIN_LAST_NAME" | sed "s/'/''/g")|g" \
  -e "s|__TENANT_NAME__|$(echo "$TENANT_NAME" | sed "s/'/''/g")|g" \
  "$DB_DIR/seed.sql" > /tmp/sf7-seed-generated.sql
echo "  Seed generated for: $ADMIN_EMAIL"

# ══════════════════════════════════════════════════════════
# STEP 6: Initialize Database via Lambda
# ══════════════════════════════════════════════════════════

echo "[6/10] Initializing database..."
echo "  Waiting for RDS to be ready..."
aws rds wait db-instance-available --db-instance-identifier "sf7-${ENV}" --region "$REGION" 2>/dev/null || true

DB_INIT_OK=false

# Read SQL files
SCHEMA_SQL=$(cat "$DB_DIR/schema.sql")
SEED_SQL=$(cat /tmp/sf7-seed-generated.sql)

# Execute schema via Lambda
echo "  Running schema.sql (30+ tables)..."
SCHEMA_RESULT=$(aws lambda invoke \
  --function-name "$DB_INIT_FN" \
  --region "$REGION" \
  --cli-binary-format raw-in-base64-out \
  --payload "$(printf '{"sql":"%s"}' "$(echo "$SCHEMA_SQL" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')")" \
  /tmp/sf7-schema-result.json 2>&1) || true

SCHEMA_STATUS=$(cat /tmp/sf7-schema-result.json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('statusCode',500))" 2>/dev/null || echo "500")

if [ "$SCHEMA_STATUS" = "200" ]; then
  echo "  Schema created."

  # Execute seed via Lambda
  echo "  Running seed.sql (admin + roles + permissions)..."
  SEED_RESULT=$(aws lambda invoke \
    --function-name "$DB_INIT_FN" \
    --region "$REGION" \
    --cli-binary-format raw-in-base64-out \
    --payload "$(printf '{"sql":"%s"}' "$(echo "$SEED_SQL" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')")" \
    /tmp/sf7-seed-result.json 2>&1) || true

  SEED_STATUS=$(cat /tmp/sf7-seed-result.json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('statusCode',500))" 2>/dev/null || echo "500")

  if [ "$SEED_STATUS" = "200" ]; then
    echo "  Seed data loaded."
    DB_INIT_OK=true
  else
    echo "  WARNING: Seed failed (may already exist). Status: $SEED_STATUS"
    SEED_BODY=$(cat /tmp/sf7-seed-result.json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('body',''))" 2>/dev/null || echo "")
    echo "  Detail: $SEED_BODY"
    # If it's a duplicate key error, that's OK — DB was already seeded
    if echo "$SEED_BODY" | grep -qi "duplicate\|already exists\|unique"; then
      echo "  (Database was already initialized — this is OK)"
      DB_INIT_OK=true
    fi
  fi
else
  echo "  WARNING: Schema failed via Lambda. Status: $SCHEMA_STATUS"
  SCHEMA_BODY=$(cat /tmp/sf7-schema-result.json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('body',''))" 2>/dev/null || echo "")
  echo "  Detail: $SCHEMA_BODY"
  # If tables already exist, that's OK
  if echo "$SCHEMA_BODY" | grep -qi "already exists"; then
    echo "  (Tables already exist — this is OK)"
    DB_INIT_OK=true
  fi
fi

# Fallback: try psql directly (works if CloudShell has network access)
if [ "$DB_INIT_OK" = false ]; then
  if command -v psql &>/dev/null; then
    echo "  Trying psql fallback..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U salesfast7 -d salesfast7 -f "$DB_DIR/schema.sql" 2>/dev/null && \
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U salesfast7 -d salesfast7 -f /tmp/sf7-seed-generated.sql 2>/dev/null && \
    DB_INIT_OK=true
  fi
fi

if [ "$DB_INIT_OK" = true ]; then
  echo "  Database initialized."
else
  echo ""
  echo "  *** DB INIT FAILED — Manual init required ***"
  echo "  Use RDS Query Editor: Console > RDS > Query Editor"
  echo "  Connect to sf7-${ENV}, run schema.sql then seed.sql"
fi

# ══════════════════════════════════════════════════════════
# STEP 7: Upload Frontend
# ══════════════════════════════════════════════════════════

echo "[7/10] Uploading frontend..."
if [ -d "$FRONTEND_DIR" ]; then
  aws s3 sync "$FRONTEND_DIR" "s3://$FRONTEND_BUCKET" \
    --region "$REGION" --delete --cache-control "max-age=3600" --exclude ".DS_Store"
  for EXT in html css js svg png json; do
    case $EXT in
      html) CT="text/html";;
      css)  CT="text/css";;
      js)   CT="application/javascript";;
      svg)  CT="image/svg+xml";;
      png)  CT="image/png";;
      json) CT="application/json";;
    esac
    aws s3 cp "s3://$FRONTEND_BUCKET" "s3://$FRONTEND_BUCKET" \
      --recursive --region "$REGION" --content-type "$CT" \
      --exclude "*" --include "*.$EXT" --metadata-directive REPLACE 2>/dev/null || true
  done
  echo "  Frontend uploaded."
fi

# ══════════════════════════════════════════════════════════
# STEP 8: Invalidate CloudFront Cache
# ══════════════════════════════════════════════════════════

echo "[8/10] Invalidating CloudFront cache..."
if [ -n "$CLOUDFRONT_ID" ] && [ "$CLOUDFRONT_ID" != "None" ]; then
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_ID" --paths "/*" --query 'Invalidation.Id' --output text 2>/dev/null || true
  echo "  Cache invalidated."
fi

# ══════════════════════════════════════════════════════════
# PHASE 2: Deploy AI Stack
# ══════════════════════════════════════════════════════════

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 2: AI Stack ($AI_REGION)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[9/10] Deploying AI resources to $AI_REGION..."
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

_getai() {
  aws cloudformation describe-stacks \
    --stack-name "$AI_STACK_NAME" --region "$AI_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
KB_BUCKET=$(_getai KBBucketName)
echo "  KB Bucket: $KB_BUCKET"

echo "[10/10] Uploading sample KB documents..."
cat > /tmp/sf7-company.md << 'KBEOF'
# Company Profile
Replace this with your actual company information.
KBEOF
cat > /tmp/sf7-faq.md << 'KBEOF'
# FAQ
Q: How long does installation take?
A: 2-4 weeks depending on business size.
KBEOF
aws s3 cp /tmp/sf7-company.md "s3://$KB_BUCKET/company/" --region "$AI_REGION" 2>/dev/null || true
aws s3 cp /tmp/sf7-faq.md "s3://$KB_BUCKET/faq/" --region "$AI_REGION" 2>/dev/null || true
echo "  Sample documents uploaded."

# ══════════════════════════════════════════════════════════
# DONE — Summary
# ══════════════════════════════════════════════════════════

echo ""
echo "============================================"
echo "  SalesFAST 7 — Deployment Complete!"
echo "============================================"
echo ""
echo "  Website:    $CLOUDFRONT_URL"
echo "  API:        $API_URL"
echo "  Region:     $REGION"
echo ""
echo "  Admin Login:"
echo "    Email:    $ADMIN_EMAIL"
echo "    Password: (as specified)"
echo "    Tenant:   $TENANT_NAME"
echo ""
if [ "$DB_INIT_OK" = true ]; then
  echo "  Database:   Initialized"
else
  echo "  Database:   NEEDS MANUAL INIT"
  echo "              Console > RDS > Query Editor > sf7-${ENV}"
  echo "              Run schema.sql then seed.sql"
fi
echo ""
echo "  AI:"
echo "    Region:   $AI_REGION"
echo "    KB:       $KB_BUCKET"
echo ""
echo "  NEXT STEP — Subscribe CloudFront Pro Plan (\$15/mo):"
echo "    Console > CloudFront > $CLOUDFRONT_ID > Pricing plan > Pro"
echo ""
echo "  DB Password: $DB_PASSWORD"
echo "  (save this — you will need it for RDS access)"
echo ""
echo "============================================"
echo ""
echo "  Open your CRM: $CLOUDFRONT_URL"
echo ""
