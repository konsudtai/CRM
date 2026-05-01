#!/bin/bash
# ============================================================
# SalesFAST 7 — CloudShell Quick Deploy
#
# วิธีใช้:
#   1. เปิด AWS CloudShell (console.aws.amazon.com > CloudShell)
#   2. Copy-paste script นี้ทั้งหมด แล้วกด Enter
#   3. ตอบคำถาม 5 ข้อ
#   4. รอ ~20 นาที
#
# หรือ:
#   curl -sL https://raw.githubusercontent.com/konsudtai/CRM/main/infra/cloudshell-deploy.sh | bash
# ============================================================

set -e

echo ""
echo "============================================"
echo "  SalesFAST 7 — CloudShell Deploy"
echo "  Agentic AI CRM for Thai SMB"
echo "============================================"
echo ""

# ── Check prerequisites ──
if ! command -v aws &>/dev/null; then
  echo "ERROR: AWS CLI not found. Run this in AWS CloudShell."
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$ACCOUNT_ID" ]; then
  echo "ERROR: Not authenticated. Run 'aws configure' first."
  exit 1
fi
echo "  AWS Account: $ACCOUNT_ID"
echo "  Region: $(aws configure get region || echo 'not set')"
echo ""

# ── Collect inputs ──
read -p "  Admin Email: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then echo "ERROR: Email required."; exit 1; fi

read -p "  Admin Full Name (e.g. Somchai Jaidee): " ADMIN_NAME
if [ -z "$ADMIN_NAME" ]; then echo "ERROR: Name required."; exit 1; fi

read -s -p "  Admin Password (min 8 chars): " ADMIN_PASSWORD
echo ""
if [ ${#ADMIN_PASSWORD} -lt 8 ]; then echo "ERROR: Password must be at least 8 characters."; exit 1; fi

echo ""
echo "  Database Password:"
read -s -p "    DB Password (min 8 chars): " DB_PASSWORD
echo ""
if [ ${#DB_PASSWORD} -lt 8 ]; then echo "ERROR: DB password must be at least 8 characters."; exit 1; fi
read -s -p "    Confirm DB Password: " DB_PASSWORD_CONFIRM
echo ""
if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then echo "ERROR: Passwords do not match."; exit 1; fi

read -p "  Company/Tenant Name: " TENANT_NAME
if [ -z "$TENANT_NAME" ]; then echo "ERROR: Tenant name required."; exit 1; fi

REGION="ap-southeast-1"
read -p "  Region [$REGION]: " INPUT_REGION
if [ -n "$INPUT_REGION" ]; then REGION="$INPUT_REGION"; fi

echo ""
echo "============================================"
echo "  Deploying SalesFAST 7"
echo "  Email:  $ADMIN_EMAIL"
echo "  Name:   $ADMIN_NAME"
echo "  Tenant: $TENANT_NAME"
echo "  Region: $REGION"
echo "============================================"
echo ""
read -p "  Confirm? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then echo "Cancelled."; exit 0; fi

# ── Clone repo ──
echo ""
echo "[1/4] Cloning repository..."
if [ -d "CRM" ]; then
  echo "  Directory 'CRM' exists. Pulling latest..."
  cd CRM
  git pull origin main
else
  git clone https://github.com/konsudtai/CRM.git
  cd CRM
fi

# ── Install Node.js if needed ──
echo "[2/4] Checking Node.js..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "  Installing Node.js 20..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - 2>/dev/null || true
  sudo yum install -y nodejs 2>/dev/null || true
  # Fallback: use nvm
  if ! command -v node &>/dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
  fi
fi
echo "  Node.js: $(node -v)"

# ── Install bcrypt for password hashing ──
echo "[3/4] Preparing password hash..."
npm install bcrypt --no-save --silent 2>/dev/null || true

# ── Deploy ──
echo "[4/4] Starting deployment..."
cd infra
bash deploy.sh \
  --email    "$ADMIN_EMAIL" \
  --name     "$ADMIN_NAME" \
  --password "$ADMIN_PASSWORD" \
  --db-pass  "$DB_PASSWORD" \
  --tenant   "$TENANT_NAME" \
  --region   "$REGION"

echo ""
echo "============================================"
echo "  Deployment complete!"
echo ""
echo "  Next steps:"
echo "  1. Open the CloudFront URL shown above"
echo "  2. Login with: $ADMIN_EMAIL"
echo "  3. Change password on first login"
echo "  4. (Optional) Setup LINE OA in Settings > Add-ons"
echo "  5. (Optional) Setup Knowledge Base in Bedrock Console"
echo "============================================"
