# SalesFAST 7 — Analytics Agent (น้องวิ)
FROM --platform=linux/arm64 python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py agent.py ./

ENV PORT=8080
EXPOSE 8080

CMD ["python3", "handler.py"]
