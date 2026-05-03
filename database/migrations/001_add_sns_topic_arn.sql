-- Migration 001: Add sns_topic_arn column to users table
-- Run this on existing deployments that already have the users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS sns_topic_arn VARCHAR(512);

-- Index for quick lookup by topic ARN
CREATE INDEX IF NOT EXISTS idx_users_sns_topic ON users(sns_topic_arn) WHERE sns_topic_arn IS NOT NULL;
