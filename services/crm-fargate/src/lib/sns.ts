/**
 * SNS helper — create/delete per-user topics.
 *
 * Each user gets their own SNS topic:
 *   sf7-{tenantId-short}-user-{userId-short}
 *
 * The topic is used to send notifications to the user:
 *   - Welcome email (email subscription)
 *   - Password reset
 *   - Task reminders
 *   - QT approval notifications
 *   - Daily digest
 *
 * Subscriptions are added when user sets their email/phone/LINE.
 */
import {
  SNSClient,
  CreateTopicCommand,
  DeleteTopicCommand,
  SubscribeCommand,
  UnsubscribeCommand,
  PublishCommand,
  ListSubscriptionsByTopicCommand,
} from '@aws-sdk/client-sns';

const sns = new SNSClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

/**
 * Create an SNS topic for a user.
 * Returns the topic ARN.
 */
export async function createUserTopic(tenantId: string, userId: string): Promise<string> {
  // Shorten IDs for topic name (SNS topic names max 256 chars, alphanumeric + hyphens)
  const tenantShort = tenantId.replace(/-/g, '').slice(0, 8);
  const userShort = userId.replace(/-/g, '').slice(0, 8);
  const topicName = `sf7-${tenantShort}-user-${userShort}`;

  const result = await sns.send(new CreateTopicCommand({
    Name: topicName,
    Tags: [
      { Key: 'Service', Value: 'SalesFAST7' },
      { Key: 'TenantId', Value: tenantId },
      { Key: 'UserId', Value: userId },
    ],
  }));

  if (!result.TopicArn) throw new Error('Failed to create SNS topic');
  return result.TopicArn;
}

/**
 * Delete an SNS topic for a user.
 */
export async function deleteUserTopic(topicArn: string): Promise<void> {
  await sns.send(new DeleteTopicCommand({ TopicArn: topicArn }));
}

/**
 * Subscribe an email address to a user's topic.
 * Returns the subscription ARN (pending confirmation until user clicks email link).
 */
export async function subscribeEmail(topicArn: string, email: string): Promise<string> {
  const result = await sns.send(new SubscribeCommand({
    TopicArn: topicArn,
    Protocol: 'email',
    Endpoint: email,
    ReturnSubscriptionArn: true,
  }));
  return result.SubscriptionArn || '';
}

/**
 * Subscribe an SMS (phone number) to a user's topic.
 * Phone must be in E.164 format: +66812345678
 */
export async function subscribeSMS(topicArn: string, phone: string): Promise<string> {
  // Normalize Thai phone: 081-234-5678 → +66812345678
  const normalized = normalizeThaiPhone(phone);
  if (!normalized) throw new Error('Invalid phone number format');

  const result = await sns.send(new SubscribeCommand({
    TopicArn: topicArn,
    Protocol: 'sms',
    Endpoint: normalized,
    ReturnSubscriptionArn: true,
  }));
  return result.SubscriptionArn || '';
}

/**
 * Unsubscribe from a topic.
 */
export async function unsubscribe(subscriptionArn: string): Promise<void> {
  if (subscriptionArn && subscriptionArn !== 'PendingConfirmation') {
    await sns.send(new UnsubscribeCommand({ SubscriptionArn: subscriptionArn }));
  }
}

/**
 * Publish a message to a user's topic (sends to all subscriptions: email, SMS).
 */
export async function publishToUser(
  topicArn: string,
  subject: string,
  message: string,
  emailMessage?: string,
): Promise<void> {
  if (emailMessage) {
    // Different message per protocol
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      MessageStructure: 'json',
      Message: JSON.stringify({
        default: message,
        email: emailMessage,
        sms: message.slice(0, 160), // SMS max 160 chars
      }),
    }));
  } else {
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message,
    }));
  }
}

/**
 * Get all subscriptions for a topic.
 */
export async function getSubscriptions(topicArn: string) {
  const result = await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }));
  return result.Subscriptions || [];
}

/**
 * Normalize Thai phone number to E.164 format.
 * 081-234-5678 → +66812345678
 * 0812345678   → +66812345678
 * +66812345678 → +66812345678 (already normalized)
 */
function normalizeThaiPhone(phone: string): string | null {
  const cleaned = phone.replace(/[-\s()]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('66')) return '+' + cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return '+66' + cleaned.slice(1);
  return null;
}
