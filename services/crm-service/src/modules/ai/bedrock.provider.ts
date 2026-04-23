import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export const BEDROCK_PROVIDER = 'BEDROCK_PROVIDER';

@Injectable()
export class BedrockProvider {
  private readonly logger = new Logger(BedrockProvider.name);
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
    });
    this.modelId =
      process.env.BEDROCK_MODEL_ID ||
      'anthropic.claude-3-haiku-20240307';
  }

  /**
   * Call AWS Bedrock with a user prompt and optional system prompt.
   * Returns the raw text response from the model.
   */
  async callBedrock(prompt: string, systemPrompt?: string): Promise<string> {
    const messages = [{ role: 'user', content: prompt }];

    const body: Record<string, unknown> = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    });

    try {
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content?.[0]?.text ?? '';
    } catch (error) {
      this.logger.error('Bedrock invocation failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Call Bedrock with full conversation history for multi-turn chat.
   */
  async callBedrockWithHistory(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    });

    try {
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content?.[0]?.text ?? '';
    } catch (error) {
      this.logger.error(
        'Bedrock chat invocation failed',
        (error as Error).message,
      );
      throw error;
    }
  }
}
