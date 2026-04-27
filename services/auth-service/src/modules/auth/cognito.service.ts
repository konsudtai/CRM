import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminResetUserPasswordCommand,
  ListUsersCommand,
  AuthFlowType,
  ChallengeNameType,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;

  constructor() {
    const region = process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-southeast-1';
    this.userPoolId = process.env.COGNITO_USER_POOL_ID || '';
    this.clientId = process.env.COGNITO_CLIENT_ID || '';
    this.client = new CognitoIdentityProviderClient({ region });
  }

  /**
   * Admin creates a user in Cognito User Pool.
   * User receives a temporary password and must change on first login.
   */
  async createUser(email: string, temporaryPassword: string, attributes?: Record<string, string>): Promise<string> {
    const userAttributes = [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
    ];
    if (attributes?.firstName) userAttributes.push({ Name: 'given_name', Value: attributes.firstName });
    if (attributes?.lastName) userAttributes.push({ Name: 'family_name', Value: attributes.lastName });
    if (attributes?.phone) userAttributes.push({ Name: 'phone_number', Value: attributes.phone });

    const result = await this.client.send(new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      TemporaryPassword: temporaryPassword,
      UserAttributes: userAttributes,
      MessageAction: MessageActionType.SUPPRESS, // Don't send welcome email, admin gives credentials
    }));

    const cognitoSub = result.User?.Attributes?.find((a: { Name?: string }) => a.Name === 'sub')?.Value;
    if (!cognitoSub) throw new BadRequestException('Failed to get Cognito sub');

    this.logger.log(`Cognito user created: ${email} (sub: ${cognitoSub})`);
    return cognitoSub;
  }

  /**
   * Set permanent password (skip force-change on first login).
   */
  async setPassword(email: string, password: string): Promise<void> {
    await this.client.send(new AdminSetUserPasswordCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    }));
  }

  /**
   * Authenticate user with email + password.
   * Returns Cognito tokens (IdToken, AccessToken, RefreshToken).
   */
  async authenticate(email: string, password: string): Promise<{
    idToken: string;
    accessToken: string;
    refreshToken: string;
    cognitoSub: string;
    challengeName?: string;
    session?: string;
  }> {
    const result = await this.client.send(new AdminInitiateAuthCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }));

    // Handle NEW_PASSWORD_REQUIRED challenge (first login with temp password)
    if (result.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
      return {
        idToken: '',
        accessToken: '',
        refreshToken: '',
        cognitoSub: '',
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: result.Session,
      };
    }

    if (!result.AuthenticationResult) {
      throw new UnauthorizedException('Authentication failed');
    }

    // Decode sub from IdToken
    const payload = JSON.parse(
      Buffer.from(result.AuthenticationResult.IdToken!.split('.')[1], 'base64').toString(),
    );

    return {
      idToken: result.AuthenticationResult.IdToken!,
      accessToken: result.AuthenticationResult.AccessToken!,
      refreshToken: result.AuthenticationResult.RefreshToken!,
      cognitoSub: payload.sub,
    };
  }

  /**
   * Respond to NEW_PASSWORD_REQUIRED challenge (first login).
   */
  async respondNewPasswordChallenge(email: string, newPassword: string, session: string): Promise<{
    idToken: string;
    accessToken: string;
    refreshToken: string;
    cognitoSub: string;
  }> {
    const result = await this.client.send(new AdminRespondToAuthChallengeCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
      ChallengeResponses: {
        USERNAME: email,
        NEW_PASSWORD: newPassword,
      },
      Session: session,
    }));

    if (!result.AuthenticationResult) {
      throw new UnauthorizedException('Challenge response failed');
    }

    const payload = JSON.parse(
      Buffer.from(result.AuthenticationResult.IdToken!.split('.')[1], 'base64').toString(),
    );

    return {
      idToken: result.AuthenticationResult.IdToken!,
      accessToken: result.AuthenticationResult.AccessToken!,
      refreshToken: result.AuthenticationResult.RefreshToken!,
      cognitoSub: payload.sub,
    };
  }

  /**
   * Disable user in Cognito (deactivate).
   */
  async disableUser(email: string): Promise<void> {
    await this.client.send(new AdminDisableUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    }));
    this.logger.log(`Cognito user disabled: ${email}`);
  }

  /**
   * Enable user in Cognito (reactivate).
   */
  async enableUser(email: string): Promise<void> {
    await this.client.send(new AdminEnableUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    }));
    this.logger.log(`Cognito user enabled: ${email}`);
  }

  /**
   * Admin reset password — sends reset to user or sets new password.
   */
  async resetPassword(email: string, newPassword: string): Promise<void> {
    await this.client.send(new AdminSetUserPasswordCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      Password: newPassword,
      Permanent: true,
    }));
    this.logger.log(`Cognito password reset: ${email}`);
  }

  /**
   * Delete user from Cognito (permanent).
   */
  async deleteUser(email: string): Promise<void> {
    await this.client.send(new AdminDeleteUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    }));
    this.logger.log(`Cognito user deleted: ${email}`);
  }
}
