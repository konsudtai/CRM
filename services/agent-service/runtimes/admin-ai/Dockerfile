FROM public.ecr.aws/docker/library/python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent_handler.py .
ENV PORT=8080
ENV BEDROCK_REGION=ap-southeast-1
ENV BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-6
ENV GATEWAY_URL=https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp
ENV SALES_RUNTIME_ARN=arn:aws:bedrock-agentcore:ap-southeast-1:364478544994:runtime/sf7_agents_v2-HGDCxK46cL
EXPOSE 8080
CMD ["python", "agent_handler.py"]
