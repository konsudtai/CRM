/**
 * AWS Lambda handler — wraps Hono app for API Gateway v2.
 */
import { handle } from 'hono/aws-lambda';
import app from './app.js';

export const handler = handle(app);
