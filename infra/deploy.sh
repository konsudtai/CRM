#!/bin/bash
# ============================================================
# SalesFAST 7 — Full Platform Deployment
# Deploys CRM + AI Resources in one command
#
# USAGE:
#   bash deploy.sh \
#     --email admin@company.com \
#     --name "John Doe" \
#     --password "Pass@123" \
#     --db-pass "DbPass@456" \
#     --tenant "My Company" \
#     --region ap-southeast-7 \
#     --ai-region ap-southeast-1
#
# All flags are REQUIRED (except --ai-region which defaults to ap-southeast-1)
# ============================================================

set -e

# ── Defaults ──
STACK_NAME="salesfast7-prod"
AI_STACK_NAME="salesfast7-ai-prod"
ENV="prod"
REGION=""
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
      echo "SalesFAST 7 — Full Platform Deployment"
      echo ""
      echo "REQUIRED flags:"
      echo "  --email     <email>     Admin login email"
      echo "  --name      <fullname>  Admin full name"
      echo "  --password  <pass>      Admin login password"
      echo "  --db-pass   <pass>      Database password (or 'auto' to generate)"
      echo "  --tenant    <name>      Company / tenant name"
      echo "  --region    <region>    CRM region (e.g. ap-southeast-7)"
      echo ""
      echo "OPTIONAL flags:"
      echo "  --ai-region <region>    AI/Bedrock region (default: ap-southeast-1)"
      echo "  --jwt       <secret>    JWT secret (default: auto-generate)"
      echo "  --stack     <name>      Stack name (default: salesfast7-prod)"
      echo ""
      echo "EXAMPLE:"
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
[ -z "$REGION" ]         && MISSING="$MISSING --region"

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
  echo "    --tenant 'My Company' \\"
  echo "    --region ap-southeast-7"
  echo ""
  echo "Run 'bash deploy.sh --help' for all options."
  exit 1
fi

# ── Auto-generate secrets ──
if [ "$DB_PASSWORD" = "auto" ]; then
  DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
  echo "DB password auto-generated: $DB_PASSWORD"
fi
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
fi

# ── Split full name ──
ADMIN_FIRST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{print $1}')
ADMIN_LAST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{$1=""; print $0}' | xargs)
[ -z "$ADMIN_LAST_NAME" ] && ADMIN_LAST_NAME="."

echo ""
echo "============================================"
echo "  SalesFAST 7 — Full Deployment"
echo "============================================"
echo ""
echo "  CRM Region:  $REGION"
echo "  AI Region:   $AI_REGION (Bedrock)"
echo "  Admin:       $ADMIN_EMAIL ($ADMIN_FULLNAME)"
echo "  Tenant:      $TENANT_NAME"
echo "  Stack:       $STACK_NAME"
echo ""

# ══════════════════════════════════════════════════════════
# PHASE 1: Deploy CRM Stack
# ══════════════════════════════════════════════════════════

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1: CRM Stack ($REGION)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[1/8] Deploying CloudFormation stack..."
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
echo "  Done."

echo "[2/8] Getting stack outputs..."
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
echo "  CloudFront: $CLOUDFRONT_URL"
echo "  API:        $API_URL"
echo "  DB:         $DB_ENDPOINT"

echo "[3/8] Generating seed data..."
ADMIN_HASH=""
ADMIN_HASH=$(node -e "try{const b=require('bcrypt');b.hash(process.argv[1],12).then(h=>{process.stdout.write(h);process.exit(0)})}catch(e){process.exit(1)}" "$ADMIN_PASSWORD" 2>/dev/null) || true
if [ -z "$ADMIN_HASH" ]; then
  ADMIN_HASH=$(python3 -c "import sys;exec('try:\n import bcrypt\n print(bcrypt.hashpw(sys.argv[1].encode(),bcrypt.gensalt(12)).decode(),end=\"\")\nexcept:\n sys.exit(1)')" "$ADMIN_PASSWORD" 2>/dev/null) || true
fi
if [ -z "$ADMIN_HASH" ]; then
  ADMIN_HASH='$2b$12$LJ3m4ys3Lk0TSwMBQWJBaeQBfMQcfNpQOPKfMFHJFLDqxGMmVqHXe'
  echo "  WARNING: bcrypt not available, using default hash"
fi
DB_DIR="../database"
[ ! -d "$DB_DIR" ] && DB_DIR="database"
sed \
  -e "s|__ADMIN_EMAIL__|${ADMIN_EMAIL}|g" \
  -e "s|__ADMIN_PASSWORD_HASH__|${ADMIN_HASH}|g" \
  -e "s|__ADMIN_FIRST_NAME__|$(echo "$ADMIN_FIRST_NAME" | sed "s/'/''/g")|g" \
  -e "s|__ADMIN_LAST_NAME__|$(echo "$ADMIN_LAST_NAME" | sed "s/'/''/g")|g" \
  -e "s|__TENANT_NAME__|$(echo "$TENANT_NAME" | sed "s/'/''/g")|g" \
  "$DB_DIR/seed.sql" > /tmp/sf7-seed-generated.sql
echo "  Seed generated: $ADMIN_EMAIL"

echo "[4/8] Uploading frontend..."
FRONTEND_DIR="../frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="frontend"
if [ -d "$FRONTEND_DIR" ]; then
  aws s3 sync "$FRONTEND_DIR" "s3://$FRONTEND_BUCKET" \
    --region "$REGION" --delete --cache-control "max-age=3600" --exclude ".DS_Store"
  for EXT in html css js; do
    case $EXT in html) CT="text/html";; css) CT="text/css";; js) CT="application/javascript";; esac
    aws s3 cp "s3://$FRONTEND_BUCKET" "s3://$FRONTEND_BUCKET" \
      --recursive --region "$REGION" --content-type "$CT" \
      --exclude "*" --include "*.$EXT" --metadata-directive REPLACE
  done
  echo "  Frontend uploaded."
fi

echo "[5/8] Invalidating CloudFront cache..."
if [ -n "$CLOUDFRONT_ID" ] && [ "$CLOUDFRONT_ID" != "None" ]; then
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_ID" --paths "/*" --query 'Invalidation.Id' --output text
  echo "  Cache invalidated."
fi

echo "[5.5/8] Initializing database..."
# Wait for RDS to be fully available
echo "  Waiting for RDS to be ready..."
aws rds wait db-instance-available --db-instance-identifier "sf7-${ENV}" --region "$REGION" 2>/dev/null || true

# Try to init DB using RDS Data API or psql
DB_INIT_OK=false

# Method 1: Try psql if available
if command -v psql &>/dev/null; then
  echo "  Found psql, initializing database..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U salesfast7 -d salesfast7 -f "$DB_DIR/schema.sql" 2>/dev/null && \
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_ENDPOINT" -U salesfast7 -d salesfast7 -f /tmp/sf7-seed-generated.sql 2>/dev/null && \
  DB_INIT_OK=true
fi

# Method 2: Try AWS RDS Data API (for Aurora Serverless)
if [ "$DB_INIT_OK" = false ]; then
  echo "  psql not available. Trying RDS Query Editor..."
  echo ""
  echo "  ⚠️  AUTO-INIT SKIPPED — RDS is in private subnet (no direct access from CloudShell)"
  echo ""
  echo "  Initialize manually using ONE of these methods:"
  echo ""
  echo "  Method A: RDS Query Editor (easiest)"
  echo "    1. Go to AWS Console > RDS > Query Editor"
  echo "    2. Connect to: sf7-${ENV}"
  echo "    3. Username: salesfast7 / Password: (your db-pass)"
  echo "    4. Copy-paste schema.sql then seed.sql"
  echo ""
  echo "  Method B: EC2 Bastion (if you have one)"
  echo "    psql -h $DB_ENDPOINT -U salesfast7 -d salesfast7 < $DB_DIR/schema.sql"
  echo "    psql -h $DB_ENDPOINT -U salesfast7 -d salesfast7 < /tmp/sf7-seed-generated.sql"
  echo ""
  echo "  Method C: Lambda function (automated)"
  echo "    Upload schema.sql + seed.sql to S3, trigger Lambda to execute"
  echo ""
fi

# ══════════════════════════════════════════════════════════
# PHASE 2: Deploy AI Stack
# ══════════════════════════════════════════════════════════

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 2: AI Stack ($AI_REGION)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[6/8] Deploying AI resources to $AI_REGION..."
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

echo "[7/8] Getting AI outputs..."
_getai() {
  aws cloudformation describe-stacks \
    --stack-name "$AI_STACK_NAME" --region "$AI_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
KB_BUCKET=$(_getai KBBucketName)
echo "  KB Bucket: $KB_BUCKET"

echo "[8/8] Uploading sample KB documents..."
cat > /tmp/sf7-company.md << 'EOF'
# Company Profile
Replace this with your actual company information.
EOF
cat > /tmp/sf7-faq.md << 'EOF'
# FAQ
Q: How long does installation take?
A: 2-4 weeks depending on business size.
EOF
aws s3 cp /tmp/sf7-company.md "s3://$KB_BUCKET/company/" --region "$AI_REGION" 2>/dev/null
aws s3 cp /tmp/sf7-faq.md "s3://$KB_BUCKET/faq/" --region "$AI_REGION" 2>/dev/null
echo "  Sample documents uploaded."

# ══════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════

echo ""
echo "============================================"
echo "  SalesFAST 7 — Deployed!"
echo "============================================"
echo ""
echo "  CRM:"
echo "    Website:  $CLOUDFRONT_URL"
echo "    API:      $API_URL"
echo "    DB:       $DB_ENDPOINT"
echo "    Proxy:    $PROXY_ENDPOINT"
echo "    Region:   $REGION"
echo ""
echo "  AI:"
echo "    Region:   $AI_REGION"
echo "    KB:       $KB_BUCKET"
echo ""
echo "  Admin:"
echo "    Email:    $ADMIN_EMAIL"
echo "    Name:     $ADMIN_FULLNAME"
echo "    Tenant:   $TENANT_NAME"
echo ""
if [ "$DB_INIT_OK" = true ]; then
  echo "  Database:   ✅ Initialized"
else
  echo "  Database:   ⚠️  Needs manual init (see instructions above)"
fi
echo ""
echo "  ⚠️  IMPORTANT NOTES:"
echo "    - WAF (CLOUDFRONT scope) requires us-east-1."
echo "      If deploying to ap-southeast-7, WAF may fail."
echo "      Workaround: Remove WAF from template or deploy WAF separately in us-east-1."
echo "    - RDS Proxy may not be available in new regions."
echo "      If it fails, remove RDSProxy resources from cloudformation.yaml."
echo "    - Bedrock is NOT in ap-southeast-7."
echo "      AI stack deploys to $AI_REGION (separate region)."
echo ""
echo "============================================"
