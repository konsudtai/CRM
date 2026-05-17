"""
Generate LINE Rich Menu Image (2500x843px)
3 buttons: สนใจสินค้า | ดูสินค้า | เช็คสถานะ
Design: Clean modern cards with Thai font (Thonburi)
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 2500, 843
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)

# ── Background gradient (deep navy) ──
for y in range(H):
    ratio = y / H
    r = int(8 + ratio * 12)
    g = int(15 + ratio * 20)
    b = int(40 + ratio * 35)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# ── Fonts (Thai support) ──
font_title = ImageFont.truetype('/System/Library/Fonts/Supplemental/Thonburi.ttc', 80, index=1)  # Bold
font_sub = ImageFont.truetype('/System/Library/Fonts/Supplemental/Thonburi.ttc', 40, index=0)   # Regular
font_icon = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 72)

# ── Section dimensions ──
section_w = W // 3
card_margin_x = 40
card_margin_y = 40
card_w = section_w - (card_margin_x * 2)
card_h = H - (card_margin_y * 2)
card_radius = 28

# ── Card configs ──
cards = [
    {
        'title': 'สนใจสินค้า',
        'subtitle': 'ลงทะเบียนความสนใจ',
        'color_top': (37, 99, 235),     # blue-600
        'color_bot': (29, 78, 216),     # blue-700
        'accent': (96, 165, 250),       # blue-300
        'icon_color': (219, 234, 254),  # blue-100
    },
    {
        'title': 'ดูสินค้า',
        'subtitle': 'Product Catalog',
        'color_top': (124, 58, 237),    # violet-600
        'color_bot': (109, 40, 217),    # violet-700
        'accent': (196, 181, 253),      # violet-300
        'icon_color': (237, 233, 254),  # violet-100
    },
    {
        'title': 'เช็คสถานะ',
        'subtitle': 'ติดตามงานของคุณ',
        'color_top': (5, 150, 105),     # emerald-600
        'color_bot': (4, 120, 87),      # emerald-700
        'accent': (110, 231, 183),      # emerald-300
        'icon_color': (209, 250, 229),  # emerald-100
    },
]

# ── Icon SVG-like shapes drawn with PIL ──
def draw_icon_interest(draw, cx, cy, color):
    """Shopping bag / heart icon"""
    r = 44
    # Outer circle
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=color, width=5)
    # Plus sign
    draw.line([(cx-20, cy), (cx+20, cy)], fill=color, width=6)
    draw.line([(cx, cy-20), (cx, cy+20)], fill=color, width=6)

def draw_icon_catalog(draw, cx, cy, color):
    """Grid/catalog icon"""
    s = 36
    gap = 8
    # 4 squares in a grid
    for row in range(2):
        for col in range(2):
            x0 = cx - s + col * (s + gap)
            y0 = cy - s + row * (s + gap)
            draw.rounded_rectangle([x0, y0, x0 + s - gap, y0 + s - gap], radius=6, fill=color)

def draw_icon_status(draw, cx, cy, color):
    """Checkmark / status icon"""
    r = 44
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=color, width=5)
    # Checkmark
    points = [(cx-18, cy), (cx-4, cy+16), (cx+20, cy-14)]
    draw.line(points, fill=color, width=6, joint='curve')

icon_funcs = [draw_icon_interest, draw_icon_catalog, draw_icon_status]

def draw_rounded_rect(draw, xy, radius, fill):
    """Draw a filled rounded rectangle"""
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + 2*radius, y0 + 2*radius], fill=fill)
    draw.ellipse([x1 - 2*radius, y0, x1, y0 + 2*radius], fill=fill)
    draw.ellipse([x0, y1 - 2*radius, x0 + 2*radius, y1], fill=fill)
    draw.ellipse([x1 - 2*radius, y1 - 2*radius, x1, y1], fill=fill)

# ── Draw each card ──
for i, card in enumerate(cards):
    base_x = section_w * i
    cx = base_x + section_w // 2
    card_x0 = base_x + card_margin_x
    card_y0 = card_margin_y
    card_x1 = card_x0 + card_w
    card_y1 = card_y0 + card_h

    # Card shadow
    draw_rounded_rect(draw, (card_x0 + 6, card_y0 + 6, card_x1 + 6, card_y1 + 6), card_radius, (0, 0, 0))

    # Card gradient fill
    for y in range(card_y0, card_y1):
        ratio = (y - card_y0) / card_h
        r = int(card['color_top'][0] * (1-ratio) + card['color_bot'][0] * ratio)
        g = int(card['color_top'][1] * (1-ratio) + card['color_bot'][1] * ratio)
        b = int(card['color_top'][2] * (1-ratio) + card['color_bot'][2] * ratio)
        # Only draw within rounded rect bounds (approximate)
        margin = 0
        if y < card_y0 + card_radius:
            margin = int(card_radius - (card_radius**2 - (card_y0 + card_radius - y)**2)**0.5)
        elif y > card_y1 - card_radius:
            margin = int(card_radius - (card_radius**2 - (y - card_y1 + card_radius)**2)**0.5)
        draw.line([(card_x0 + margin, y), (card_x1 - margin, y)], fill=(r, g, b))

    # Subtle top highlight
    for y in range(card_y0, card_y0 + 80):
        alpha = int(30 * (1 - (y - card_y0) / 80))
        margin = 0
        if y < card_y0 + card_radius:
            margin = int(card_radius - (card_radius**2 - (card_y0 + card_radius - y)**2)**0.5)
        draw.line([(card_x0 + margin + 2, y), (card_x1 - margin - 2, y)], 
                  fill=(card['color_top'][0] + alpha, card['color_top'][1] + alpha, min(255, card['color_top'][2] + alpha)))

    # Icon
    icon_cy = card_y0 + 220
    icon_funcs[i](draw, cx, icon_cy, card['icon_color'])

    # Title (Thai)
    title_y = icon_cy + 100
    bbox = draw.textbbox((0, 0), card['title'], font=font_title)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw//2, title_y), card['title'], font=font_title, fill=(255, 255, 255))

    # Subtitle
    sub_y = title_y + 110
    bbox2 = draw.textbbox((0, 0), card['subtitle'], font=font_sub)
    sw = bbox2[2] - bbox2[0]
    draw.text((cx - sw//2, sub_y), card['subtitle'], font=font_sub, fill=card['accent'])

    # Bottom accent bar
    bar_y = card_y1 - 55
    bar_w = 80
    draw.rounded_rectangle([cx - bar_w, bar_y, cx + bar_w, bar_y + 6], radius=3, fill=card['accent'])

# ── Subtle separators ──
for i in range(1, 3):
    x = section_w * i
    for y in range(80, H - 80, 8):
        draw.point((x, y), fill=(255, 255, 255, 30))

# ── Save ──
output_path = '/Users/fentf1yy/Desktop/DevProject/CRM/infra/rich-menu.png'
img.save(output_path, 'PNG', quality=95)
print(f"Rich Menu image saved: {output_path}")

# Verify
from PIL import Image as Im2
verify = Im2.open(output_path)
print(f"Size: {verify.size}, Mode: {verify.mode}, File: {os.path.getsize(output_path)/1024:.1f} KB")
import os
