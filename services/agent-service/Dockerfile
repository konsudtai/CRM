# ══════════════════════════════════════════════════════════════
# SalesFAST 7 — Agent Service (AgentCore Runtime)
# Deploy to Amazon Bedrock AgentCore Runtime
# ══════════════════════════════════════════════════════════════
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npx tsc --outDir dist

# Expose AgentCore required port
EXPOSE 8080

# Environment defaults
ENV PORT=8080
ENV BEDROCK_REGION=ap-southeast-1
ENV BEDROCK_MODEL_ID=amazon.nova-2-lite-v1:0
ENV NODE_ENV=production

# Start AgentCore entry point
CMD ["node", "dist/agentcore-entry.js"]
