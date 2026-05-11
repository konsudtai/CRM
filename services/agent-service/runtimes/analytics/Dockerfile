FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent_handler.py .
ENV PORT=8080
ENV BEDROCK_REGION=ap-southeast-1
ENV BEDROCK_MODEL_ID=apac.anthropic.claude-sonnet-4-20250514-v1:0
ENV GATEWAY_URL=https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp
EXPOSE 8080
CMD ["python", "agent_handler.py"]
