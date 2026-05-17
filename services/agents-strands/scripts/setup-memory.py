#!/usr/bin/env python3
"""
Setup AgentCore Memory resources for sales + analytics agents.

Creates 2 memories with built-in strategies:
- Short-term: raw conversation events (TTL based)
- Semantic memory: extracts facts about user preferences, customer info
- Summary memory: rolling summary of long conversations

Run: python3 scripts/setup-memory.py
"""
import boto3
import json
import time
import sys

REGION = "ap-southeast-1"
client = boto3.client("bedrock-agentcore-control", region_name=REGION)

MEMORIES = [
    {
        "name": "sf7_sales_memory",
        "description": "SalesFAST 7 — Sales Agent (น้องขายไว) conversation memory",
        # Event expiry in DAYS (must be 7-365)
        "eventExpiryDuration": 90,
        "memoryStrategies": [
            {
                "userPreferenceMemoryStrategy": {
                    "name": "userPreferences",
                    "description": "Track user's working style, preferred sales reps, common queries",
                    "namespaces": ["/preferences/{actorId}"],
                }
            },
            {
                "semanticMemoryStrategy": {
                    "name": "salesContext",
                    "description": "Remember customer details, deal context, action history",
                    "namespaces": ["/sales/{actorId}/context"],
                }
            },
            {
                "summaryMemoryStrategy": {
                    "name": "conversationSummary",
                    "description": "Rolling summary of long conversations",
                    "namespaces": ["/summary/{actorId}/{sessionId}"],
                }
            },
        ],
    },
    {
        "name": "sf7_analytics_memory",
        "description": "SalesFAST 7 — Analytics Agent (น้องวิ) conversation memory",
        "eventExpiryDuration": 90,
        "memoryStrategies": [
            {
                "userPreferenceMemoryStrategy": {
                    "name": "userPreferences",
                    "description": "Track preferred metrics, time periods, comparison styles",
                    "namespaces": ["/preferences/{actorId}"],
                }
            },
            {
                "semanticMemoryStrategy": {
                    "name": "analyticsContext",
                    "description": "Remember KPI baselines, forecast assumptions, trends discussed",
                    "namespaces": ["/analytics/{actorId}/context"],
                }
            },
            {
                "summaryMemoryStrategy": {
                    "name": "conversationSummary",
                    "description": "Rolling summary of analytics discussions",
                    "namespaces": ["/summary/{actorId}/{sessionId}"],
                }
            },
        ],
    },
]


def memory_exists(name):
    """Check if memory already exists by name."""
    paginator = client.get_paginator("list_memories")
    for page in paginator.paginate():
        for m in page.get("memories", []):
            if m.get("name") == name:
                return m.get("id")
    return None


def create_memory(spec):
    """Create memory if not exists, return memory ID."""
    name = spec["name"]
    existing = memory_exists(name)
    if existing:
        print(f"[SKIP] {name} already exists: {existing}")
        return existing

    print(f"[CREATE] {name}...")
    resp = client.create_memory(
        name=name,
        description=spec["description"],
        eventExpiryDuration=spec["eventExpiryDuration"],
        memoryStrategies=spec["memoryStrategies"],
    )
    memory = resp.get("memory", {})
    mid = memory.get("id")
    status = memory.get("status")
    print(f"        ID: {mid} | initial status: {status}")

    # Wait for ACTIVE
    print(f"        Waiting for ACTIVE...")
    for _ in range(60):  # up to 5 min
        time.sleep(5)
        r = client.get_memory(memoryId=mid)
        st = r.get("memory", {}).get("status")
        if st == "ACTIVE":
            print(f"        Status: ACTIVE")
            return mid
        elif st == "FAILED":
            print(f"        Status: FAILED — {r.get('memory', {}).get('failureReason', '')}")
            sys.exit(1)
        print(f"        Status: {st}...")
    print(f"        Timed out waiting; check console.")
    return mid


def main():
    print("=" * 60)
    print("SalesFAST 7 — AgentCore Memory Setup")
    print("=" * 60)

    results = {}
    for spec in MEMORIES:
        mid = create_memory(spec)
        results[spec["name"]] = mid

    print("\n" + "=" * 60)
    print("Done. Memory IDs:")
    print("=" * 60)
    for name, mid in results.items():
        print(f"  {name}: {mid}")

    # Save to file for later use
    with open("memory-ids.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved to: memory-ids.json")


if __name__ == "__main__":
    main()
