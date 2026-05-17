#!/usr/bin/env python3
"""
Deploy AgentCore Runtimes for Strands agents (sales + analytics).

Creates 2 runtimes:
- sf7-sales-strands → uses sales image, sales memory
- sf7-analytics-strands → uses analytics image, analytics memory

Then patches A2A: each runtime gets sibling's ARN as env var.

Run after build.sh build has completed and pushed images.
"""
import boto3
import time
import json
import sys

REGION = "ap-southeast-1"
ACCOUNT_ID = "364478544994"
IMAGE_TAG = "v0.1.0"

client = boto3.client("bedrock-agentcore-control", region_name=REGION)
cfn = boto3.client("cloudformation", region_name=REGION)

STACK_NAME = "sf7-prod-agents-strands"

# Existing resources
GATEWAY_URL = "https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp"
TOOL_PREFIX = "sf7-crm-tools___"

# Memory IDs (from Phase 3.1)
SALES_MEMORY_ID = "sf7_sales_memory-XP3MKp9Eeu"
ANALYTICS_MEMORY_ID = "sf7_analytics_memory-iHRfaQ2qfc"

MODEL_ID = "global.anthropic.claude-sonnet-4-6"


def get_stack_output(key):
    resp = cfn.describe_stacks(StackName=STACK_NAME)
    outputs = resp["Stacks"][0].get("Outputs", [])
    for o in outputs:
        if o["OutputKey"] == key:
            return o["OutputValue"]
    return None


def list_runtimes():
    paginator = client.get_paginator("list_agent_runtimes")
    rts = []
    for page in paginator.paginate():
        rts.extend(page.get("agentRuntimes", []))
    return rts


def find_runtime(name):
    for rt in list_runtimes():
        if rt.get("agentRuntimeName") == name:
            return rt
    return None


def wait_runtime_ready(runtime_id, timeout=300):
    print(f"  Waiting for runtime {runtime_id} to be READY...")
    elapsed = 0
    while elapsed < timeout:
        r = client.get_agent_runtime(agentRuntimeId=runtime_id)
        status = r.get("status")
        print(f"    Status: {status}")
        if status == "READY":
            return r
        if status in ("FAILED", "DELETING"):
            print(f"    Failed: {r.get('failureReason', 'unknown')}")
            sys.exit(1)
        time.sleep(10)
        elapsed += 10
    raise TimeoutError(f"Runtime {runtime_id} not ready after {timeout}s")


def create_or_update_runtime(name, image_uri, memory_id, gateway_url, role_arn, sibling_arn=None):
    """Create runtime or update existing one with new image."""
    existing = find_runtime(name)

    env_vars = {
        "MODEL_ID": MODEL_ID,
        "MEMORY_ID": memory_id,
        "GATEWAY_URL": gateway_url,
        "TOOL_PREFIX": TOOL_PREFIX,
    }
    if sibling_arn:
        if "sales" in name:
            env_vars["ANALYTICS_RUNTIME_ARN"] = sibling_arn
        else:
            env_vars["SALES_RUNTIME_ARN"] = sibling_arn

    if existing:
        rid = existing.get("agentRuntimeId")
        print(f"[UPDATE] {name} (id: {rid})")
        try:
            client.update_agent_runtime(
                agentRuntimeId=rid,
                agentRuntimeArtifact={
                    "containerConfiguration": {"containerUri": image_uri}
                },
                roleArn=role_arn,
                networkConfiguration={"networkMode": "PUBLIC"},
                environmentVariables=env_vars,
            )
        except Exception as e:
            print(f"  Update failed (will retry without env): {e}")
            client.update_agent_runtime(
                agentRuntimeId=rid,
                agentRuntimeArtifact={
                    "containerConfiguration": {"containerUri": image_uri}
                },
            )
        result = wait_runtime_ready(rid)
        return result.get("agentRuntimeArn")
    else:
        print(f"[CREATE] {name}")
        resp = client.create_agent_runtime(
            agentRuntimeName=name,
            agentRuntimeArtifact={
                "containerConfiguration": {"containerUri": image_uri}
            },
            roleArn=role_arn,
            networkConfiguration={"networkMode": "PUBLIC"},
            environmentVariables=env_vars,
        )
        rid = resp.get("agentRuntimeId")
        print(f"  Created: {rid}")
        result = wait_runtime_ready(rid)
        return result.get("agentRuntimeArn")


def main():
    print("=" * 60)
    print("Phase 3.3 — Deploy Strands Agents to AgentCore Runtime")
    print("=" * 60)

    # Get role ARN
    role_arn = get_stack_output("AgentRuntimeRoleArn")
    if not role_arn:
        print("ERROR: Could not find AgentRuntimeRoleArn in stack outputs")
        sys.exit(1)
    print(f"Runtime role: {role_arn}")

    # Image URIs
    sales_image = f"{ACCOUNT_ID}.dkr.ecr.{REGION}.amazonaws.com/sf7-prod-sales-strands:{IMAGE_TAG}"
    analytics_image = f"{ACCOUNT_ID}.dkr.ecr.{REGION}.amazonaws.com/sf7-prod-analytics-strands:{IMAGE_TAG}"

    print(f"Sales image: {sales_image}")
    print(f"Analytics image: {analytics_image}")
    print()

    # ── Step 1: Create both runtimes WITHOUT A2A (chicken-and-egg) ──
    print("Step 1: Creating runtimes (without A2A)...")
    sales_arn = create_or_update_runtime(
        "sf7_sales_strands",
        sales_image,
        SALES_MEMORY_ID,
        GATEWAY_URL,
        role_arn,
        sibling_arn=None,
    )
    print(f"  Sales runtime ARN: {sales_arn}\n")

    analytics_arn = create_or_update_runtime(
        "sf7_analytics_strands",
        analytics_image,
        ANALYTICS_MEMORY_ID,
        GATEWAY_URL,
        role_arn,
        sibling_arn=None,
    )
    print(f"  Analytics runtime ARN: {analytics_arn}\n")

    # ── Step 2: Update both with A2A sibling ARNs ──
    print("Step 2: Patching A2A configuration...")
    create_or_update_runtime(
        "sf7_sales_strands",
        sales_image,
        SALES_MEMORY_ID,
        GATEWAY_URL,
        role_arn,
        sibling_arn=analytics_arn,
    )
    print(f"  Sales: ANALYTICS_RUNTIME_ARN={analytics_arn}\n")

    create_or_update_runtime(
        "sf7_analytics_strands",
        analytics_image,
        ANALYTICS_MEMORY_ID,
        GATEWAY_URL,
        role_arn,
        sibling_arn=sales_arn,
    )
    print(f"  Analytics: SALES_RUNTIME_ARN={sales_arn}\n")

    # ── Save runtime ARNs for crm-core proxy config ──
    config = {
        "sales_runtime_arn": sales_arn,
        "analytics_runtime_arn": analytics_arn,
        "sales_memory_id": SALES_MEMORY_ID,
        "analytics_memory_id": ANALYTICS_MEMORY_ID,
        "gateway_url": GATEWAY_URL,
    }
    with open("agent-config.json", "w") as f:
        json.dump(config, f, indent=2)

    print("=" * 60)
    print("Deployment complete!")
    print("=" * 60)
    print(f"Sales:     {sales_arn}")
    print(f"Analytics: {analytics_arn}")
    print(f"\nSaved config to: agent-config.json")
    print("\nNext: Update crm-core /agents/chat to invoke these runtimes")


if __name__ == "__main__":
    main()
