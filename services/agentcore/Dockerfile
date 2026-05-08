# SalesFAST 7 — AgentCore Runtime Container
# Platform: linux/arm64 (required by AgentCore)
FROM --platform=linux/arm64 node:22-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy built app
COPY dist/ ./dist/

# AgentCore requires port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:8080/ping || exit 1

# Run
CMD ["node", "dist/app.js"]
