#!/usr/bin/env python3
"""
Deploy SalesFAST 7 AgentCore (Python) via S3 code upload.

What it does:
  1. Create/reuse AgentCore Memory resource (for session context)
  2. Create/reuse IAM role
  3. Package code → zip
  4. Upload zip to S3
  5. Create/Update AgentCore Runtime pointing to S3 zip
  6. Print ARN for invocation

Prerequisites:
  - AWS credentials configured
  - boto3 installed: pip install boto3

Usage:
  python3 deploy.py
  python3 deploy.py --region ap-southeast-1 --update-only
"""
import argparse
import json
import os
import sys
import time
import zipfile
from pathlib import Path
from typing import Optional

import boto3

# ── Configuration (module-level) ──
_DEFAULT_REGION = os.environ.get('AWS_REGION', 'ap-southeast-1')
REGION = _DEFAULT_REGION
AGENT_NAME = 'sf7_agents'
ROLE_NAME = 'sf7-agentcore-role'
MEMORY_NAME = 'sf7_agents_memory'
S3_BUCKET_PREFIX = 'sf7-agentcore-code'
S3_KEY = 'sf7-agentcore-py.zip'
RUNTIME = 'PYTHON_3_11'
ENTRY_POINT = ['agent.py']

HERE = Path(__file__).parent


def get_account_id() -> str:
    sts = boto3.client('sts')
    return sts.get_caller_identity()['Account']


# ══════════════════════════════════════════════════════════════
# 1. IAM Role
# ══════════════════════════════════════════════════════════════

def ensure_iam_role(account_id: str) -> str:
    """Create or reuse IAM role for AgentCore Runtime."""
    iam = boto3.client('iam')
    role_arn = f'arn:aws:iam::{account_id}:role/{ROLE_NAME}'

    trust = {
        'Version': '2012-10-17',
        'Statement': [{
            'Effect': 'Allow',
            'Principal': {'Service': 'bedrock-agentcore.amazonaws.com'},
            'Action': 'sts:AssumeRole',
        }],
    }

    try:
        iam.get_role(RoleName=ROLE_NAME)
        print(f'  IAM role exists: {role_arn}')
    except iam.exceptions.NoSuchEntityException:
        print(f'  Creating IAM role: {ROLE_NAME}')
        iam.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(trust),
            Description='SalesFAST 7 AgentCore Runtime role',
        )
        time.sleep(5)  # propagation

    # Attach Bedrock access
    try:
        iam.attach_role_policy(
            RoleName=ROLE_NAME,
            PolicyArn='arn:aws:iam::aws:policy/AmazonBedrockFullAccess',
        )
    except Exception:
        pass

    # Inline policy: logs + memory + S3 code read
    inline = {
        'Version': '2012-10-17',
        'Statement': [
            {
                'Effect': 'Allow',
                'Action': [
                    'logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents',
                    'xray:PutTraceSegments', 'xray:PutTelemetryRecords',
                ],
                'Resource': '*',
            },
            {
                'Effect': 'Allow',
                'Action': [
                    'bedrock-agentcore:CreateEvent',
                    'bedrock-agentcore:ListEvents',
                    'bedrock-agentcore:GetEvent',
                    'bedrock-agentcore:RetrieveMemoryRecords',
                ],
                'Resource': '*',
            },
            {
                'Effect': 'Allow',
                'Action': ['s3:GetObject'],
                'Resource': f'arn:aws:s3:::{S3_BUCKET_PREFIX}-{account_id}/*',
            },
        ],
    }
    iam.put_role_policy(
        RoleName=ROLE_NAME,
        PolicyName='sf7-agentcore-inline',
        PolicyDocument=json.dumps(inline),
    )
    print('  IAM inline policy updated')
    return role_arn


# ══════════════════════════════════════════════════════════════
# 2. AgentCore Memory
# ══════════════════════════════════════════════════════════════

def ensure_memory(account_id: str) -> str:
    """Create or reuse AgentCore Memory resource."""
    client = boto3.client('bedrock-agentcore-control', region_name=REGION)

    # List existing
    try:
        resp = client.list_memories()
        for m in resp.get('memories', []):
            if m.get('name') == MEMORY_NAME or MEMORY_NAME in (m.get('id') or m.get('memoryId') or ''):
                mid = m.get('id') or m.get('memoryId')
                if mid:
                    print(f'  Memory exists: {mid}')
                    return mid
    except Exception as e:
        print(f'  list_memories error: {e}')

    # Create new
    print(f'  Creating Memory: {MEMORY_NAME}')
    try:
        resp = client.create_memory(
            name=MEMORY_NAME,
            description='SalesFAST 7 agent session memory',
            eventExpiryDuration=90,
        )
        mem = resp.get('memory', {})
        mid = mem.get('id') or mem.get('memoryId', '')
        if mid:
            print(f'  Memory created: {mid}')
        else:
            print(f'  Memory created but no ID returned: {mem}')
        return mid
    except Exception as e:
        print(f'  create_memory failed (non-critical): {e}')
        return ''


# ══════════════════════════════════════════════════════════════
# 3. S3 bucket + code upload
# ══════════════════════════════════════════════════════════════

def ensure_s3_bucket(account_id: str) -> str:
    """Create S3 bucket for code artifacts."""
    bucket = f'{S3_BUCKET_PREFIX}-{account_id}'
    s3 = boto3.client('s3', region_name=REGION)

    try:
        s3.head_bucket(Bucket=bucket)
        print(f'  S3 bucket exists: {bucket}')
    except Exception:
        print(f'  Creating S3 bucket: {bucket}')
        if REGION == 'us-east-1':
            s3.create_bucket(Bucket=bucket)
        else:
            s3.create_bucket(
                Bucket=bucket,
                CreateBucketConfiguration={'LocationConstraint': REGION},
            )
    return bucket


def package_code() -> Path:
    """Create zip with code + Linux ARM64 dependencies."""
    zip_path = HERE / 'agentcore-py.zip'
    deps_dir = HERE / 'deployment_package'

    if zip_path.exists():
        zip_path.unlink()

    # Install deps for Linux ARM64 into deployment_package/
    print('  Installing ARM64 dependencies (this takes ~2 min)...')
    import shutil
    if deps_dir.exists():
        shutil.rmtree(deps_dir)
    deps_dir.mkdir()

    import subprocess
    req_file = HERE / 'requirements.txt'
    result = subprocess.run(
        [
            'pip3', 'install',
            '--platform', 'manylinux2014_aarch64',
            '--python-version', '3.11',
            '--only-binary=:all:',
            '--target', str(deps_dir),
            '-r', str(req_file),
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f'  pip install failed: {result.stderr[-1500:]}')
        raise RuntimeError('dependency install failed')
    print('  Dependencies installed.')

    # Files to include (our code)
    include_files = ['agent.py']
    include_dirs = ['agents', 'tools']

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # Add dependencies
        for root, _, files in os.walk(deps_dir):
            for filename in files:
                if filename.endswith(('.pyc', '.pyo')):
                    continue
                if '__pycache__' in root:
                    continue
                abs_path = Path(root) / filename
                rel_path = abs_path.relative_to(deps_dir)
                zf.write(abs_path, str(rel_path))

        # Add our code (at root)
        for f in include_files:
            src = HERE / f
            if src.exists():
                zf.write(src, f)

        for d in include_dirs:
            src_dir = HERE / d
            if src_dir.exists():
                for root, _, files in os.walk(src_dir):
                    for filename in files:
                        if filename.endswith('.py') and '__pycache__' not in root:
                            abs_path = Path(root) / filename
                            rel_path = abs_path.relative_to(HERE)
                            zf.write(abs_path, str(rel_path))

    size_mb = zip_path.stat().st_size / 1024 / 1024
    print(f'  Packaged: {zip_path.name} ({size_mb:.1f} MB)')

    # Clean up deps_dir to save space
    shutil.rmtree(deps_dir)
    return zip_path


def upload_to_s3(zip_path: Path, bucket: str) -> str:
    """Upload zip to S3, return version ID."""
    s3 = boto3.client('s3', region_name=REGION)
    with open(zip_path, 'rb') as f:
        resp = s3.put_object(Bucket=bucket, Key=S3_KEY, Body=f.read())
    version_id = resp.get('VersionId', 'null')
    print(f'  Uploaded: s3://{bucket}/{S3_KEY}')
    return version_id


# ══════════════════════════════════════════════════════════════
# 4. AgentCore Runtime
# ══════════════════════════════════════════════════════════════

def get_env_vars(account_id: str, memory_id: str) -> dict:
    """Build environment variables for the runtime, pulling DB creds from existing Lambda."""
    lam = boto3.client('lambda', region_name=REGION)
    try:
        cfg = lam.get_function_configuration(FunctionName='sf7-prod-crm')
        env = cfg.get('Environment', {}).get('Variables', {})
    except Exception:
        env = {}

    return {
        'DB_HOST': env.get('DB_HOST', ''),
        'DB_PORT': env.get('DB_PORT', '5432'),
        'DB_USER': env.get('DB_USER', 'salesfast7'),
        'DB_PASS': env.get('DB_PASS', ''),
        'DB_NAME': env.get('DB_NAME', 'salesfast7'),
        'DB_SSL': env.get('DB_SSL', 'true'),
        'BEDROCK_MODEL_ID': env.get('BEDROCK_MODEL_ID', 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0'),
        'BEDROCK_REGION': REGION,
        'AGENTCORE_MEMORY_ID': memory_id,
    }


def find_existing_runtime(client) -> Optional[dict]:
    """Find existing runtime by name."""
    try:
        resp = client.list_agent_runtimes()
        for rt in resp.get('agentRuntimes', []):
            if rt.get('agentRuntimeName') == AGENT_NAME:
                return rt
    except Exception:
        pass
    return None


def deploy_runtime(account_id: str, role_arn: str, bucket: str, memory_id: str) -> str:
    """Create or update AgentCore Runtime."""
    client = boto3.client('bedrock-agentcore-control', region_name=REGION)

    artifact = {
        'codeConfiguration': {
            'code': {
                's3': {
                    'bucket': bucket,
                    'prefix': S3_KEY,
                },
            },
            'runtime': RUNTIME,
            'entryPoint': ENTRY_POINT,
        },
    }

    env_vars = get_env_vars(account_id, memory_id)
    missing = [k for k in ['DB_HOST', 'DB_PASS'] if not env_vars.get(k)]
    if missing:
        print(f'  WARNING: missing env vars: {missing}')

    # Use VPC networking if SG + subnets provided (so agent can reach RDS + Bedrock VPC endpoints)
    vpc_sg = os.environ.get('AGENTCORE_VPC_SG', 'sg-0ce065f147925abc6')
    vpc_subnets = os.environ.get('AGENTCORE_VPC_SUBNETS', 'subnet-0215da3b8bbdf8ce5,subnet-0c55afb1b6c1c3ee2')

    if vpc_sg and vpc_subnets:
        network = {
            'networkMode': 'VPC',
            'networkModeConfig': {
                'securityGroups': [vpc_sg],
                'subnets': vpc_subnets.split(','),
            },
        }
        print(f'  Network: VPC (sg={vpc_sg}, subnets={vpc_subnets.split(",")})')
    else:
        network = {'networkMode': 'PUBLIC'}
        print('  Network: PUBLIC')

    # Check if runtime already exists
    existing = find_existing_runtime(client)

    if existing:
        runtime_id = existing['agentRuntimeId']
        print(f'  Updating existing runtime: {runtime_id}')
        resp = client.update_agent_runtime(
            agentRuntimeId=runtime_id,
            agentRuntimeArtifact=artifact,
            networkConfiguration=network,
            roleArn=role_arn,
            environmentVariables=env_vars,
        )
        arn = resp.get('agentRuntimeArn', existing['agentRuntimeArn'])
        print(f'  Updated: {arn}')
        print(f'  Status:  {resp.get("status", "UPDATING")}')
        return arn

    # Create new
    print(f'  Creating new runtime: {AGENT_NAME}')
    resp = client.create_agent_runtime(
        agentRuntimeName=AGENT_NAME,
        description='SalesFAST 7 Multi-Agent AI (A2A + MCP + Memory)',
        agentRuntimeArtifact=artifact,
        networkConfiguration=network,
        roleArn=role_arn,
        environmentVariables=env_vars,
        lifecycleConfiguration={
            'idleRuntimeSessionTimeout': 600,
            'maxLifetime': 3600,
        },
    )
    arn = resp.get('agentRuntimeArn', '')
    print(f'  Created: {arn}')
    print(f'  Status:  {resp.get("status", "CREATING")}')
    return arn


# ══════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════

def main() -> None:
    global REGION

    parser = argparse.ArgumentParser()
    parser.add_argument('--region', default=_DEFAULT_REGION)
    parser.add_argument('--skip-memory', action='store_true')
    args = parser.parse_args()

    REGION = args.region

    account_id = get_account_id()

    print('═══════════════════════════════════════════════════')
    print('  SalesFAST 7 — AgentCore Python Deploy')
    print('═══════════════════════════════════════════════════')
    print(f'  Account: {account_id}')
    print(f'  Region:  {REGION}')
    print(f'  Agent:   {AGENT_NAME}')
    print('═══════════════════════════════════════════════════')
    print()

    print('[1/5] IAM Role...')
    role_arn = ensure_iam_role(account_id)
    print()

    print('[2/5] AgentCore Memory...')
    memory_id = '' if args.skip_memory else ensure_memory(account_id)
    print()

    print('[3/5] S3 Bucket...')
    bucket = ensure_s3_bucket(account_id)
    print()

    print('[4/5] Package & Upload Code...')
    zip_path = package_code()
    upload_to_s3(zip_path, bucket)
    print()

    print('[5/5] Deploy AgentCore Runtime...')
    arn = deploy_runtime(account_id, role_arn, bucket, memory_id)
    print()

    print('═══════════════════════════════════════════════════')
    print('  ✅ Deployment Complete')
    print('═══════════════════════════════════════════════════')
    print(f'  Runtime ARN: {arn}')
    print(f'  Memory ID:   {memory_id or "(none)"}')
    print()
    print('  Wait 2-3 minutes for status READY, then test:')
    print()
    print('  aws bedrock-agentcore invoke-agent-runtime \\')
    print(f'    --agent-runtime-arn "{arn}" \\')
    print('    --runtime-session-id "test-session-$(date +%s)00000000000000" \\')
    print('    --payload \'{"message":"สรุป Lead","agentType":"sales-assistant","tenantId":"default"}\' \\')
    print(f'    --region {REGION} \\')
    print('    /tmp/response.json')
    print()
    print('  cat /tmp/response.json')
    print('═══════════════════════════════════════════════════')


if __name__ == '__main__':
    main()
