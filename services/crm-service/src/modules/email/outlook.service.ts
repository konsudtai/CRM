import { Injectable, Logger } from '@nestjs/common';

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface OutlookMessage {
  messageId: string;
  conversationId: string;
  from: string;
  toRecipients: string[];
  subject: string;
  bodyPreview: string;
  receivedDateTime: Date;
}

/**
 * Wraps the Microsoft Graph API for OAuth2 auth, Outlook email listing, and sending.
 */
@Injectable()
export class OutlookService {
  private readonly logger = new Logger(OutlookService.name);
  private readonly MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  private readonly GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

  private get clientId(): string {
    return process.env.MICROSOFT_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return process.env.MICROSOFT_CLIENT_SECRET || '';
  }

  /** Build the OAuth2 authorization URL for Outlook */
  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
      response_mode: 'query',
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /** Exchange authorization code for tokens */
  async exchangeCode(code: string, redirectUri: string): Promise<OutlookTokens> {
    const response = await fetch(this.MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Outlook token exchange failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** Refresh an expired access token */
  async refreshAccessToken(refreshToken: string): Promise<OutlookTokens> {
    const response = await fetch(this.MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Outlook token refresh failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** List messages since a given date */
  async listMessages(accessToken: string, sinceDate?: Date): Promise<OutlookMessage[]> {
    let url = `${this.GRAPH_API_URL}/me/messages?$top=50&$orderby=receivedDateTime desc&$select=id,conversationId,from,toRecipients,subject,bodyPreview,receivedDateTime`;

    if (sinceDate) {
      const isoDate = sinceDate.toISOString();
      url += `&$filter=receivedDateTime ge ${isoDate}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Outlook list messages failed: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return (data.value || []).map((msg: any) => ({
      messageId: msg.id,
      conversationId: msg.conversationId,
      from: msg.from?.emailAddress?.address || '',
      toRecipients: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address || ''),
      subject: msg.subject || '',
      bodyPreview: msg.bodyPreview || '',
      receivedDateTime: new Date(msg.receivedDateTime),
    }));
  }

  /** Send an email via Microsoft Graph API */
  async sendMessage(
    accessToken: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const response = await fetch(`${this.GRAPH_API_URL}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Outlook send failed: ${response.status} ${errBody}`);
    }
  }
}
