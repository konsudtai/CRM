# Fix น้องวิ — Run in AWS CloudShell

```bash
# 1. Clone and apply fix
git clone https://github.com/konsudtai/CRM.git && cd CRM

# 2. Build & push container
REGION="ap-southeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

docker build --platform linux/arm64 -t sf7-sales-assistant services/agent-service/python_agent
docker tag sf7-sales-assistant:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-sales-assistant:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-sales-assistant:latest

# 3. Update runtime
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id "sf7_agents_v2-HGDCxK46cL" \
  --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/sf7-sales-assistant:latest\"}}" \
  --role-arn "arn:aws:iam::${ACCOUNT_ID}:role/sf7-agentcore-role" \
  --network-configuration '{"networkMode":"PUBLIC"}' \
  --region $REGION

# 4. Wait for READY
sleep 60 && aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id "sf7_agents_v2-HGDCxK46cL" --region $REGION --query 'status'
```
