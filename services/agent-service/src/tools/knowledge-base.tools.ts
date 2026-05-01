/**
 * Knowledge Base Tools — Admin AI Agent uses these to answer customer questions
 * by searching the Bedrock Knowledge Base (product catalog, FAQ, company info).
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

const kbClient = new BedrockAgentRuntimeClient({
  region: process.env.KB_REGION || process.env.AWS_REGION || 'ap-southeast-1',
});

export const searchKnowledgeBase = tool({
  name: 'search_knowledge_base',
  description: 'ค้นหาข้อมูลจาก Knowledge Base (สินค้า, ราคา, FAQ, ข้อมูลบริษัท) เพื่อตอบคำถามลูกค้า',
  inputSchema: z.object({
    query: z.string().describe('คำถามหรือ keyword ที่ต้องการค้นหา'),
    knowledgeBaseId: z.string().describe('Bedrock Knowledge Base ID'),
    maxResults: z.number().optional().default(5),
  }),
  callback: async (input) => {
    try {
      const command = new RetrieveCommand({
        knowledgeBaseId: input.knowledgeBaseId,
        retrievalQuery: { text: input.query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: input.maxResults },
        },
      });
      const response = await kbClient.send(command);
      const results = (response.retrievalResults || []).map((r, i) => ({
        rank: i + 1,
        content: r.content?.text || '',
        score: r.score,
        source: r.location?.s3Location?.uri || 'unknown',
      }));
      return JSON.stringify(results);
    } catch (err: any) {
      return `Knowledge Base search error: ${err.message}`;
    }
  },
});
