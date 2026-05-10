/**
 * AgentCore Runtime Entry Point
 *
 * This file exposes the required HTTP endpoints for AgentCore Runtime:
 * - GET /ping — Health check
 * - POST /invocations — Agent invocation
 *
 * AgentCore Runtime sends binary payload to /invocations and expects JSON response.
 */
import express from 'express';
import { createSalesAssistantAgent } from './agents/sales-assistant.agent';
import { createAdminAIAgent } from './agents/admin-ai.agent';

const PORT = process.env.PORT || 8080;
const app = express();

// ── Health check (REQUIRED by AgentCore) ──
app.get('/ping', (_, res) => {
  res.json({
    status: 'Healthy',
    time_of_last_update: Math.floor(Date.now() / 1000),
    agents: ['sales-assistant', 'admin-ai'],
  });
});

// ── Agent invocation (REQUIRED by AgentCore) ──
app.post('/invocations', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Decode binary payload from AgentCore SDK
    const rawPayload = new TextDecoder().decode(req.body);
    let payload: any;

    try {
      payload = JSON.parse(rawPayload);
    } catch {
      // If not JSON, treat as plain text message
      payload = { message: rawPayload, agentType: 'sales-assistant' };
    }

    const {
      message,
      agentType = 'sales-assistant',
      userId = 'unknown',
      userName = 'ผู้ใช้',
      userRole = 'Sales Rep',
      tenantId = 'default',
      conversationHistory = [],
    } = payload;

    // Select agent based on type
    let agent;
    if (agentType === 'admin-ai') {
      agent = createAdminAIAgent({
        modelId: process.env.BEDROCK_MODEL_ID,
        region: process.env.BEDROCK_REGION || 'ap-southeast-1',
        knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
      });
    } else {
      agent = createSalesAssistantAgent({
        modelId: process.env.BEDROCK_MODEL_ID,
        region: process.env.BEDROCK_REGION || 'ap-southeast-1',
        userRole,
        userName,
        userId,
        tenantId,
      });
    }

    // Build prompt with conversation history
    let fullPrompt = message;
    if (conversationHistory.length > 0) {
      const historyStr = conversationHistory
        .map((h: any) => `${h.role}: ${h.content}`)
        .join('\n');
      fullPrompt = `Previous conversation:\n${historyStr}\n\nUser: ${message}`;
    }

    // Invoke agent
    const response = await agent.invoke(fullPrompt);

    // Extract text from response
    let replyText = '';
    if (typeof response === 'string') {
      replyText = response;
    } else if (response?.message) {
      replyText = response.message;
    } else if (response?.lastMessage?.content) {
      replyText = response.lastMessage.content
        .filter((c: any) => c.type === 'textBlock' || c.text)
        .map((c: any) => c.text || c.content || '')
        .join('\n');
    } else {
      replyText = JSON.stringify(response);
    }

    return res.json({
      reply: replyText,
      agentType,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('AgentCore invocation error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message || 'Unknown error',
    });
  }
});

// ── Start server ──
app.listen(PORT, () => {
  console.log(`🚀 SalesFAST 7 AgentCore Runtime listening on port ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   GET  http://0.0.0.0:${PORT}/ping`);
  console.log(`   POST http://0.0.0.0:${PORT}/invocations`);
  console.log(`🤖 Model: ${process.env.BEDROCK_MODEL_ID || 'amazon.nova-2-lite-v1:0'}`);
  console.log(`🌏 Region: ${process.env.BEDROCK_REGION || 'ap-southeast-1'}`);
});
