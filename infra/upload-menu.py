import json, subprocess, urllib.request, urllib.error

REGION = 'ap-southeast-1'
TABLE = 'sf7-prod-ai-state'
TENANT = '00000000-0000-0000-0000-000000000001'

result = subprocess.run(['aws', 'dynamodb', 'get-item', '--table-name', TABLE,
    '--key', json.dumps({'PK': {'S': f'TENANT#{TENANT}'}, 'SK': {'S': 'CONFIG#line'}}),
    '--region', REGION, '--query', 'Item.data.S', '--output', 'text'],
    capture_output=True, text=True)
data = json.loads(result.stdout.strip())
token = data['channelAccessToken']
print(f'Token OK')

# Unlink + delete old
OLD_ID = 'richmenu-8b7a9c819ee291634b716073818e79c1'
try:
    req = urllib.request.Request('https://api.line.me/v2/bot/user/all/richmenu', method='DELETE')
    req.add_header('Authorization', f'Bearer {token}')
    urllib.request.urlopen(req)
    print('Unlinked old')
except: pass
try:
    req = urllib.request.Request(f'https://api.line.me/v2/bot/richmenu/{OLD_ID}', method='DELETE')
    req.add_header('Authorization', f'Bearer {token}')
    urllib.request.urlopen(req)
    print('Deleted old')
except: pass

# Create new
menu = {
    'size': {'width': 2500, 'height': 843},
    'selected': True,
    'name': 'SalesFast7 Menu v3',
    'chatBarText': 'เมนู SalesFast7',
    'areas': [
        {'bounds': {'x': 0, 'y': 0, 'width': 833, 'height': 843}, 'action': {'type': 'message', 'text': 'สนใจสินค้า'}},
        {'bounds': {'x': 833, 'y': 0, 'width': 834, 'height': 843}, 'action': {'type': 'message', 'text': 'ดูสินค้า'}},
        {'bounds': {'x': 1667, 'y': 0, 'width': 833, 'height': 843}, 'action': {'type': 'message', 'text': 'เช็คสถานะ'}},
    ]
}
req = urllib.request.Request('https://api.line.me/v2/bot/richmenu',
    data=json.dumps(menu).encode(), method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Type', 'application/json')
with urllib.request.urlopen(req) as resp:
    new_id = json.loads(resp.read().decode())['richMenuId']
print(f'Created: {new_id}')

# Upload image
with open('/Users/fentf1yy/Desktop/DevProject/CRM/infra/rich-menu.png', 'rb') as f:
    img_data = f.read()
req = urllib.request.Request(f'https://api-data.line.me/v2/bot/richmenu/{new_id}/content',
    data=img_data, method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Type', 'image/png')
urllib.request.urlopen(req)
print('Image uploaded')

# Set default
req = urllib.request.Request(f'https://api.line.me/v2/bot/user/all/richmenu/{new_id}',
    data=b'', method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Length', '0')
urllib.request.urlopen(req)
print(f'Default set: {new_id}')
