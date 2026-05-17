from PIL import Image, ImageDraw, ImageFont

W, H = 2500, 843
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)

# Background
for y in range(H):
    r = int(10 + (y/H)*8)
    g = int(18 + (y/H)*12)
    b = int(45 + (y/H)*25)
    draw.line([(0,y),(W,y)], fill=(r,g,b))

# Fonts
font_th = ImageFont.truetype('/tmp/NotoSansThai.ttf', 90)
font_sub = ImageFont.truetype('/tmp/NotoSansThai.ttf', 44)

section_w = W // 3
margin = 45
card_r = 24

colors = [
    ((37,99,235),(29,78,216),(147,197,253)),
    ((124,58,237),(91,33,182),(196,181,253)),
    ((5,150,105),(4,120,87),(110,231,183)),
]
titles = ['สนใจสินค้า', 'ดูสินค้า', 'เช็คสถานะ']
subs = ['ลงทะเบียนความสนใจ', 'Product Catalog', 'ติดตามงานของคุณ']

for i in range(3):
    bx = section_w * i
    x0 = bx + margin
    y0 = margin
    x1 = bx + section_w - margin
    y1 = H - margin
    ct, cb, accent = colors[i]

    # Shadow
    draw.rounded_rectangle([x0+5, y0+5, x1+5, y1+5], radius=card_r, fill=(0,0,0))

    # Card gradient
    for y in range(y0, y1):
        ratio = (y - y0) / (y1 - y0)
        c = tuple(int(ct[j]*(1-ratio) + cb[j]*ratio) for j in range(3))
        draw.line([(x0, y), (x1, y)], fill=c)

    # Round corners by overdrawing
    draw.rounded_rectangle([x0, y0, x1, y1], radius=card_r, outline=None)

    cx = bx + section_w // 2

    # Icon area
    icon_y = y0 + 160
    ir = 55
    draw.ellipse([cx-ir, icon_y-ir, cx+ir, icon_y+ir], outline=(255,255,255), width=4)
    if i == 0:
        draw.line([(cx-22,icon_y),(cx+22,icon_y)], fill=(255,255,255), width=5)
        draw.line([(cx,icon_y-22),(cx,icon_y+22)], fill=(255,255,255), width=5)
    elif i == 1:
        s = 18
        for row in range(2):
            for col in range(2):
                rx = cx - 18 + col*22
                ry = icon_y - 18 + row*22
                draw.rounded_rectangle([rx, ry, rx+s, ry+s], radius=4, fill=(255,255,255))
    else:
        draw.line([(cx-20,icon_y),(cx-6,icon_y+14),(cx+22,icon_y-12)], fill=(255,255,255), width=5)

    # Title
    title_y = icon_y + 100
    bbox = draw.textbbox((0,0), titles[i], font=font_th)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw//2, title_y), titles[i], font=font_th, fill=(255,255,255))

    # Subtitle
    sub_y = title_y + 120
    bbox2 = draw.textbbox((0,0), subs[i], font=font_sub)
    sw = bbox2[2] - bbox2[0]
    draw.text((cx - sw//2, sub_y), subs[i], font=font_sub, fill=accent)

    # Bottom bar
    bar_y = y1 - 50
    draw.rounded_rectangle([cx-60, bar_y, cx+60, bar_y+5], radius=3, fill=accent)

img.save('/Users/fentf1yy/Desktop/DevProject/CRM/infra/rich-menu.png', 'PNG')
print('Done: rich-menu.png')
