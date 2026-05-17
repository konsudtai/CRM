# SalesFAST 7 — Sales Agent (น้องขายไว)
# AgentCore Runtime requires ARM64, port 8080, /ping + /invocations
FROM --platform=linux/arm64 python:3.11-slim

WORKDIR /app

# Install deps (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY handler.py agent.py ./

ENV PORT=8080
EXPOSE 8080

CMD ["python3", "handler.py"]
