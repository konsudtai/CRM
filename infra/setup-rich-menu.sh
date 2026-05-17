#!/bin/bash
# ══════════════════════════════════════════════════════════════
# LINE Rich Menu Setup Script
# Creates a 3-button Rich Menu: สนใจสินค้า | ดูสินค้า | เช็คสถานะ
# ══════════════════════════════════════════════════════════════

set -e

# ── Configuration ──
# Get Channel Access Token from DynamoDB or set manually
REGION="ap-southeast-1"
TABLE="sf7-prod-ai-state"
TENANT="00000000-0000-0000-0000-000000000001"

echo "=== LINE Rich Menu Setup ==="

# Try to get token from DynamoDB
TOKEN=$(aws dynamodb get-item \
  --table-name "$TABLE" \
  --key '{"PK":{"S":"TENANT#'"$TENANT"'"},"SK":{"S":"CONFIG#line"}}' \
  --region "$REGION" \
  --query 'Item.data.S' \
  --output text 2>/dev/null | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['channelAccessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "None" ]; then
  echo "Could not get token from DynamoDB."
  echo "Please set LINE_CHANNEL_TOKEN environment variable:"
  echo "  export LINE_CHANNEL_TOKEN=your_token_here"
  echo "  Then re-run this script."
  exit 1
fi

echo "Token retrieved from DynamoDB"

# ── Step 1: Create Rich Menu ──
echo ""
echo "Step 1: Creating Rich Menu..."

RICH_MENU_JSON='{
  "size": { "width": 2500, "height": 843 },
  "selected": true,
  "name": "SalesFast7 Main Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
      "action": { "type": "message", "text": "สนใจสินค้า" }
    },
    {
      "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
      "action": { "type": "message", "text": "ดูสินค้า" }
    },
    {
      "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
      "action": { "type": "message", "text": "เช็คสถานะ" }
    }
  ]
}'

RICH_MENU_ID=$(curl -s -X POST "https://api.line.me/v2/bot/richmenu" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RICH_MENU_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('richMenuId',''))")

if [ -z "$RICH_MENU_ID" ]; then
  echo "ERROR: Failed to create Rich Menu"
  exit 1
fi

echo "Created Rich Menu: $RICH_MENU_ID"

# ── Step 2: Generate & Upload Image ──
echo ""
echo "Step 2: Generating menu image..."

# Generate a simple menu image using Python (PIL/Pillow)
python3 -c "
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 2500, 843
img = Image.new('RGB', (W, H), '#1e40af')
draw = ImageDraw.Draw(img)

# Draw 3 sections with separators
section_w = W // 3

# Section backgrounds (slightly different shades)
draw.rectangle([0, 0, section_w, H], fill='#1e40af')
draw.rectangle([section_w, 0, section_w*2, H], fill='#1d4ed8')
draw.rectangle([section_w*2, 0, W, H], fill='#1e40af')

# Separator lines
draw.line([(section_w, 40), (section_w, H-40)], fill='#ffffff40', width=3)
draw.line([(section_w*2, 40), (section_w*2, H-40)], fill='#ffffff40', width=3)

# Try to use a good font, fallback to default
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 72)
    font_sub = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 42)
except:
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 72)
        font_sub = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 42)
    except:
        font = ImageFont.load_default()
        font_sub = font

# Draw icons (simple circles with symbols)
icon_y = 250
text_y = 480
sub_y = 580

labels = [
    ('สนใจสินค้า', 'ลงทะเบียนความสนใจ'),
    ('ดูสินค้า', 'Product Catalog'),
    ('เช็คสถานะ', 'ติดตามงานของคุณ'),
]

for i, (label, sub) in enumerate(labels):
    cx = section_w * i + section_w // 2
    
    # Icon circle
    r = 80
    draw.ellipse([cx-r, icon_y-r, cx+r, icon_y+r], outline='white', width=4)
    
    # Icon symbols
    symbols = ['$', '☰', '?']
    sym_font = font
    draw.text((cx, icon_y), symbols[i], font=sym_font, fill='white', anchor='mm')
    
    # Label
    draw.text((cx, text_y), label, font=font, fill='white', anchor='mm')
    
    # Sub label
    draw.text((cx, sub_y), sub, font=font_sub, fill='#ffffffcc', anchor='mm')

img.save('/tmp/rich-menu.png')
print('Image saved to /tmp/rich-menu.png')
" 2>/dev/null

if [ ! -f /tmp/rich-menu.png ]; then
  echo "WARNING: Could not generate image with Pillow."
  echo "Generating fallback with simple solid color..."
  # Fallback: create a simple PNG with ImageMagick or sips
  python3 -c "
from PIL import Image, ImageDraw
img = Image.new('RGB', (2500, 843), '#1e40af')
draw = ImageDraw.Draw(img)
draw.line([(833, 0), (833, 843)], fill='white', width=3)
draw.line([(1667, 0), (1667, 843)], fill='white', width=3)
img.save('/tmp/rich-menu.png')
print('Fallback image created')
"
fi

echo "Uploading menu image..."
UPLOAD_RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://api-data.line.me/v2/bot/richmenu/$RICH_MENU_ID/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @/tmp/rich-menu.png)

if [ "$UPLOAD_RESULT" != "200" ]; then
  echo "WARNING: Image upload returned HTTP $UPLOAD_RESULT"
  echo "You may need to upload the image manually via LINE OA Manager"
else
  echo "Image uploaded successfully"
fi

# ── Step 3: Set as Default ──
echo ""
echo "Step 3: Setting as default Rich Menu..."

DEFAULT_RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://api.line.me/v2/bot/user/all/richmenu/$RICH_MENU_ID" \
  -H "Authorization: Bearer $TOKEN")

if [ "$DEFAULT_RESULT" = "200" ]; then
  echo "Rich Menu set as default for all users"
else
  echo "WARNING: Set default returned HTTP $DEFAULT_RESULT"
fi

# ── Done ──
echo ""
echo "=== Setup Complete ==="
echo "Rich Menu ID: $RICH_MENU_ID"
echo ""
echo "Menu buttons:"
echo "  [สนใจสินค้า] → sends 'สนใจสินค้า' → Lead collection flow"
echo "  [ดูสินค้า]    → sends 'ดูสินค้า'    → Product catalog from DB"
echo "  [เช็คสถานะ]  → sends 'เช็คสถานะ'  → Lead status check"
echo ""
echo "To delete this menu later:"
echo "  curl -X DELETE https://api.line.me/v2/bot/richmenu/$RICH_MENU_ID -H 'Authorization: Bearer TOKEN'"
