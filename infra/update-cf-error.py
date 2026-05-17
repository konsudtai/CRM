import json
import subprocess

with open('/tmp/cf-config.json') as f:
    data = json.load(f)

etag = data['ETag']
config = data['DistributionConfig']

# Remove the 404 custom error response (keep 403 for SPA static file fallback)
# 404 is causing API errors to be intercepted as HTML
config['CustomErrorResponses'] = {
    'Quantity': 1,
    'Items': [
        {
            'ErrorCode': 403,
            'ResponsePagePath': '/index.html',
            'ResponseCode': '200',
            'ErrorCachingMinTTL': 10
        }
    ]
}

with open('/tmp/cf-new-config.json', 'w') as f:
    json.dump(config, f)

result = subprocess.run([
    'aws', 'cloudfront', 'update-distribution',
    '--id', 'E2BYRQOXYVKBDB',
    '--region', 'us-east-1',
    '--if-match', etag,
    '--distribution-config', 'file:///tmp/cf-new-config.json',
    '--query', 'Distribution.Status',
    '--output', 'text'
], capture_output=True, text=True)
print('STDOUT:', result.stdout)
print('STDERR:', result.stderr[:500])
print('Exit:', result.returncode)
