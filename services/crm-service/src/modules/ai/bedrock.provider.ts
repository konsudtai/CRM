import { Injectable, Logger } from '@nestjs/common';

export const BEDROCK_PROVIDER = 'BEDROCK_PROVIDER';

@Injectable()
export class BedrockProvider {
  private readonly logger = new Logger(BedrockProvider.name);
  private readonly enabled: boolean;
  private readonly modelId: string;
  private client: any;

  constructor() {
    this.enabled = process.env.BEDROCK_ENABLED === 'true' && !!process.env.BEDROCK_API_KEY;
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307';

    if (this.enabled) {
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      this.client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || 'ap-southeast-7',
      });
      this.logger.log(`Bedrock enabled: model=${this.modelId}`);
    } else {
      this.logger.warn('Bedrock disabled — AI features unavailable. Set BEDROCK_ENABLED=true and BEDROCK_API_KEY to enable.');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async callBedrock(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.enabled) return '';

    const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
    const messages = [{ role: 'user', content: prompt }];
    const body: Record<string, unknown> = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages,
    };
    if (systemPrompt) body.system = systemPrompt;

    try {
      const response = await this.client.send(new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      }));
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content?.[0]?.text ?? '';
    } catch (error) {
      this.logger.error('Bedrock invocation failed', (error as Error).message);
      return '';
    }
  }

  async callBedrockWithHistory(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
  ): Promise<string> {
    if (!this.enabled) return '';

    const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
    const body: Record<string, unknown> = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages,
    };
    if (systemPrompt) body.system = systemPrompt;

    try {
      const response = await this.client.send(new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      }));
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content?.[0]?.text ?? '';
    } catch (error) {
      this.logger.error('Bedrock chat failed', (error as Error).message);
      return '';
    }
  }
}
