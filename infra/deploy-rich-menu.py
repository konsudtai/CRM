"""
Deploy LINE Rich Menu
1. Get token from DynamoDB
2. Create Rich Menu via LINE API
3. Upload image
4. Set as default for all users
"""
import json
import subprocess
import urllib.request
import urllib.error
import sys
import os

REGION = 'ap-southeast-1'
TABLE = 'sf7-prod-ai-state'
TENANT = '00000000-0000-0000-0000-000000000001'
IMAGE_PATH = os.path.join(os.path.dirname(__file__), 'rich-menu.png')

def get_token():
    result = subprocess.run([
        'aws', 'dynamodb', 'get-item',
        '--table-name', TABLE,
        '--key', json.dumps({'PK': {'S': f'TENANT#{TENANT}'}, 'SK': {'S': 'CONFIG#line'}}),
        '--region', REGION,
        '--query', 'Item.data.S',
        '--output', 'text'
    ], capture_output=True, text=True)
    data = json.loads(result.stdout.strip())
    return data.get('channelAccessToken', '')

def line_api(method, path, token, data=None, content_type='application/json', binary=False, host='api.line.me'):
    url = f'https://{host}{path}'
    if data and not binary:
        body = json.dumps(data).encode()
    elif binary:
        body = data
    else:
        body = None
    
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', content_type)
    
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode()) if resp.status == 200 else {}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f'  ERROR {e.code}: {error_body}')
        return None

def main():
    print('=== LINE Rich Menu Deploy ===\n')
    
    # Step 1: Get token
    print('Step 1: Getting Channel Access Token...')
    token = get_token()
    if not token:
        print('ERROR: Could not get token from DynamoDB')
        sys.exit(1)
    print(f'  Token: {token[:15]}...')
    
    # Step 1b: Delete existing default rich menu (if any)
    print('\nStep 1b: Checking existing Rich Menu...')
    try:
        req = urllib.request.Request('https://api.line.me/v2/bot/user/all/richmenu', method='GET')
        req.add_header('Authorization', f'Bearer {token}')
        with urllib.request.urlopen(req) as resp:
            existing = json.loads(resp.read().decode())
            existing_id = existing.get('richMenuId', '')
            if existing_id:
                print(f'  Found existing: {existing_id}')
                # Delete old default
                del_req = urllib.request.Request(f'https://api.line.me/v2/bot/user/all/richmenu', method='DELETE')
                del_req.add_header('Authorization', f'Bearer {token}')
                urllib.request.urlopen(del_req)
                print('  Unlinked old default')
    except urllib.error.HTTPError:
        print('  No existing default Rich Menu')
    
    # Step 2: Create Rich Menu
    print('\nStep 2: Creating Rich Menu...')
    rich_menu_data = {
        'size': {'width': 2500, 'height': 843},
        'selected': True,
        'name': 'SalesFast7 Main Menu',
        'chatBarText': 'เมนู SalesFast7',
        'areas': [
            {
                'bounds': {'x': 0, 'y': 0, 'width': 833, 'height': 843},
                'action': {'type': 'message', 'text': 'สนใจสินค้า'}
            },
            {
                'bounds': {'x': 833, 'y': 0, 'width': 834, 'height': 843},
                'action': {'type': 'message', 'text': 'ดูสินค้า'}
            },
            {
                'bounds': {'x': 1667, 'y': 0, 'width': 833, 'height': 843},
                'action': {'type': 'message', 'text': 'เช็คสถานะ'}
            }
        ]
    }
    
    result = line_api('POST', '/v2/bot/richmenu', token, rich_menu_data)
    if not result or 'richMenuId' not in result:
        print('ERROR: Failed to create Rich Menu')
        sys.exit(1)
    
    rich_menu_id = result['richMenuId']
    print(f'  Created: {rich_menu_id}')
    
    # Step 3: Upload image
    print('\nStep 3: Uploading image...')
    if not os.path.exists(IMAGE_PATH):
        print(f'ERROR: Image not found at {IMAGE_PATH}')
        sys.exit(1)
    
    with open(IMAGE_PATH, 'rb') as f:
        image_data = f.read()
    
    print(f'  Image size: {len(image_data) / 1024:.1f} KB')
    
    upload_url = f'https://api-data.line.me/v2/bot/richmenu/{rich_menu_id}/content'
    req = urllib.request.Request(upload_url, data=image_data, method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'image/png')
    
    try:
        with urllib.request.urlopen(req) as resp:
            print(f'  Upload OK (HTTP {resp.status})')
    except urllib.error.HTTPError as e:
        print(f'  Upload ERROR: HTTP {e.code} - {e.read().decode()}')
        sys.exit(1)
    
    # Step 4: Set as default
    print('\nStep 4: Setting as default Rich Menu...')
    set_url = f'https://api.line.me/v2/bot/user/all/richmenu/{rich_menu_id}'
    req = urllib.request.Request(set_url, data=b'', method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Length', '0')
    
    try:
        with urllib.request.urlopen(req) as resp:
            print(f'  Set default OK (HTTP {resp.status})')
    except urllib.error.HTTPError as e:
        print(f'  Set default ERROR: HTTP {e.code} - {e.read().decode()}')
        sys.exit(1)
    
    # Done
    print('\n=== Deploy Complete ===')
    print(f'Rich Menu ID: {rich_menu_id}')
    print(f'Buttons: สนใจสินค้า | ดูสินค้า | เช็คสถานะ')
    print(f'\nTo delete later:')
    print(f'  python3 -c "import urllib.request; r=urllib.request.Request(\'https://api.line.me/v2/bot/richmenu/{rich_menu_id}\', method=\'DELETE\'); r.add_header(\'Authorization\',\'Bearer TOKEN\'); urllib.request.urlopen(r)"')

if __name__ == '__main__':
    main()
