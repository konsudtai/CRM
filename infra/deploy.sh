#!/bin/bash
# ============================================================
# SalesFAST 7 — Deploy via CloudShell
#
# USAGE — One-liner (all flags optional, defaults shown):
#
#   bash deploy.sh \
#     --email    admin@company.com \
#     --name     "John Doe" \
#     --password "MyAdminPass!" \
#     --db-pass  "MyDbPass123!" \
#     --tenant   "My Company" \
#     --region   ap-southeast-7
#
# Or just: bash deploy.sh   (interactive prompts for everything)
# ============================================================

set -e

# ── Defaults ──
STACK_NAME="salesfast7-prod"
REGION="${AWS_REGION:-ap-southeast-7}"
ENV="prod"

# ── Parse CLI flags ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)      ADMIN_EMAIL="$2";      shift 2 ;;
    --name)       ADMIN_FULLNAME="$2";   shift 2 ;;
    --password)   ADMIN_PASSWORD="$2";   shift 2 ;;
    --db-pass)    DB_PASSWORD="$2";      shift 2 ;;
    --jwt)        JWT_SECRET="$2";       shift 2 ;;
    --tenant)     TENANT_NAME="$2";      shift 2 ;;
    --region)     REGION="$2";           shift 2 ;;
    --stack)      STACK_NAME="$2";       shift 2 ;;
    --help|-h)
      echo ""
      echo "SalesFAST 7 — Deploy Script"
      echo ""
      echo "Usage:"
      echo "  bash deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --email     <email>     Admin login email     (default: admin@salesfast7.com)"
      echo "  --name      <fullname>  Admin full name       (default: System Admin)"
      echo "  --password  <pass>      Admin login password  (default: Admin@1234)"
      echo "  --db-pass   <pass>      Database password     (default: auto-generate)"
      echo "  --jwt       <secret>    JWT secret key        (default: auto-generate)"
      echo "  --tenant    <name>      Company/tenant name   (default: SalesFAST 7)"
      echo "  --region    <region>    AWS region            (default: ap-southeast-7)"
      echo "  --stack     <name>      CloudFormation stack  (default: salesfast7-prod)"
      echo ""
      echo "Examples:"
      echo "  # Interactive (prompts for all inputs)"
      echo "  bash deploy.sh"
      echo ""
      echo "  # One-liner with all options"
      echo "  bash deploy.sh --email admin@mycompany.com --name 'John Doe' --password 'Pass@123' --tenant 'My Company'"
      echo ""
      echo "  # Minimal (auto-generate DB password and JWT)"
      echo "  bash deploy.sh --email admin@mycompany.com --name 'John Doe' --password 'Pass@123'"
      echo ""
      exit 0
      ;;
    *)
      echo "Unknown option: $1  (use --help for usage)"
      exit 1
      ;;
  esac
done

# ── Split full name into first/last if --name was used ──
if [ -n "$ADMIN_FULLNAME" ]; then
  ADMIN_FIRST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{print $1}')
  ADMIN_LAST_NAME=$(echo "$ADMIN_FULLNAME" | awk '{$1=""; print $0}' | xargs)
  [ -z "$ADMIN_LAST_NAME" ] && ADMIN_LAST_NAME="."
fi

echo ""
echo "============================================"
echo "  SalesFAST 7 — Deployment"
echo "  Region: $REGION  |  Stack: $STACK_NAME"
echo "============================================"
echo ""

# ── Collect missing values interactively ──
echo "--- Infrastructure Credentials ---"

if [ -z "$DB_PASSWORD" ]; then
  echo "  Generate random DB password? (Y/n)"
  read -r GEN_DB
  if [ "$GEN_DB" = "n" ] || [ "$GEN_DB" = "N" ]; then
    read -sp "  Enter DB password (min 8 chars): " DB_PASSWORD; echo ""
  else
    DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
    echo "  DB password: $DB_PASSWORD  (saved to AWS Secrets Manager)"
  fi
fi

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  echo "  JWT secret:  auto-generated  (saved to AWS Secrets Manager)"
fi

echo ""
echo "--- Admin Account ---"

if [ -z "$ADMIN_EMAIL" ]; then
  read -p "  Admin email [admin@salesfast7.com]: " ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@salesfast7.com}"
fi

if [ -z "$ADMIN_PASSWORD" ]; then
  read -sp "  Admin password [Admin@1234]: " ADMIN_PASSWORD; echo ""
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@1234}"
fi

if [ -z "$ADMIN_FIRST_NAME" ]; then
  read -p "  First name [System]: " ADMIN_FIRST_NAME
  ADMIN_FIRST_NAME="${ADMIN_FIRST_NAME:-System}"
fi

if [ -z "$ADMIN_LAST_NAME" ]; then
  read -p "  Last name [Admin]: " ADMIN_LAST_NAME
  ADMIN_LAST_NAME="${ADMIN_LAST_NAME:-Admin}"
fi

if [ -z "$TENANT_NAME" ]; then
  read -p "  Company name [SalesFAST 7]: " TENANT_NAME
  TENANT_NAME="${TENANT_NAME:-SalesFAST 7}"
fi

echo ""
echo "  Email:    $ADMIN_EMAIL"
echo "  Name:     $ADMIN_FIRST_NAME $ADMIN_LAST_NAME"
echo "  Tenant:   $TENANT_NAME"
echo ""

# ── [1/7] Deploy CloudFormation ──
echo "[1/7] Deploying CloudFormation stack..."
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

# ── [2/7] Get outputs ──
echo "[2/7] Getting stack outputs..."
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

echo "  Website:  $CLOUDFRONT_URL"
echo "  API:      $API_URL"
echo "  DB:       $DB_ENDPOINT"
echo "  Proxy:    $PROXY_ENDPOINT"

# ── [3/7] Generate seed.sql ──
echo "[3/7] Generating seed data..."

# Hash password — try Node.js first, then Python
ADMIN_HASH=""
ADMIN_HASH=$(node -e "
try {
  const b = require('bcrypt');
  b.hash(process.argv[1], 12).then(h => { process.stdout.write(h); process.exit(0); });
} catch(e) { process.exit(1); }
" "$ADMIN_PASSWORD" 2>/dev/null) || true

if [ -z "$ADMIN_HASH" ]; then
  ADMIN_HASH=$(python3 -c "
import sys
try:
    import bcrypt
    h = bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(12)).decode()
    print(h, end='')
except ImportError:
    sys.exit(1)
" "$ADMIN_PASSWORD" 2>/dev/null) || true
fi

if [ -z "$ADMIN_HASH" ]; then
  echo "  WARNING: bcrypt not available — using default hash (Admin@1234)"
  ADMIN_HASH='$2b$12$LJ3m4ys3Lk0TSwMBQWJBaeQBfMQcfNpQOPKfMFHJFLDqxGMmVqHXe'
fi

DB_DIR="../database"
[ ! -d "$DB_DIR" ] && DB_DIR="database"

TENANT_SQL=$(echo "$TENANT_NAME"    | sed "s/'/''/g")
FIRST_SQL=$(echo "$ADMIN_FIRST_NAME" | sed "s/'/''/g")
LAST_SQL=$(echo "$ADMIN_LAST_NAME"   | sed "s/'/''/g")

sed \
  -e "s|__ADMIN_EMAIL__|${ADMIN_EMAIL}|g" \
  -e "s|__ADMIN_PASSWORD_HASH__|${ADMIN_HASH}|g" \
  -e "s|__ADMIN_FIRST_NAME__|${FIRST_SQL}|g" \
  -e "s|__ADMIN_LAST_NAME__|${LAST_SQL}|g" \
  -e "s|__TENANT_NAME__|${TENANT_SQL}|g" \
  "$DB_DIR/seed.sql" > /tmp/sf7-seed-generated.sql

echo "  Seed generated: /tmp/sf7-seed-generated.sql"

# ── [4/7] Upload frontend ──
echo "[4/7] Uploading frontend to S3..."
FRONTEND_DIR="../frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="frontend"

if [ -d "$FRONTEND_DIR" ]; then
  aws s3 sync "$FRONTEND_DIR" "s3://$FRONTEND_BUCKET" \
    --region "$REGION" --delete --cache-control "max-age=3600" --exclude ".DS_Store"

  for EXT in html css js; do
    case $EXT in
      html) CT="text/html" ;;
      css)  CT="text/css" ;;
      js)   CT="application/javascript" ;;
    esac
    aws s3 cp "s3://$FRONTEND_BUCKET" "s3://$FRONTEND_BUCKET" \
      --recursive --region "$REGION" --content-type "$CT" \
      --exclude "*" --include "*.$EXT" --metadata-directive REPLACE
  done
  echo "  Frontend uploaded."
else
  echo "  Frontend directory not found — skipping."
fi

# ── [5/7] Invalidate CloudFront ──
echo "[5/7] Invalidating CloudFront cache..."
if [ -n "$CLOUDFRONT_ID" ] && [ "$CLOUDFRONT_ID" != "None" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" --paths "/*" \
    --query 'Invalidation.Id' --output text
  echo "  Cache invalidated."
fi

# ── [6/7] Database init instructions ──
echo "[6/7] Database ready — initialize with:"
echo ""
echo "  psql -h $DB_ENDPOINT -U salesfast7 -d salesfast7 < $DB_DIR/schema.sql"
echo "  psql -h $DB_ENDPOINT -U salesfast7 -d salesfast7 < /tmp/sf7-seed-generated.sql"
echo ""

# ── [7/7] Done ──
echo "[7/7] Done!"
echo ""
echo "============================================"
echo "  SalesFAST 7 — Deployed!"
echo "============================================"
echo ""
echo "  Website:  $CLOUDFRONT_URL"
echo "  API:      $API_URL"
echo "  DB:       $DB_ENDPOINT"
echo "  Proxy:    $PROXY_ENDPOINT"
echo ""
echo "  Login:"
echo "    Email:    $ADMIN_EMAIL"
echo "    Password: (as configured)"
echo "    Tenant:   $TENANT_NAME"
echo ""
echo "  Next steps:"
echo "  1. Run database init commands above"
echo "  2. Deploy Lambda code (replace placeholder functions)"
echo "  3. (Optional) Add custom domain to CloudFront"
echo "  4. (Optional) Subscribe CloudFront Flat Rate PRO"
echo "     AWS Console > CloudFront > Savings Bundle"
echo "============================================"
