# Implementation Plan: Thai SMB CRM Platform

## Overview

This plan implements a multi-tenant SaaS CRM for Thai SMBs as a monorepo with NestJS microservices, Next.js App Router frontend, PostgreSQL with RLS, OpenSearch with Thai tokenizer, Redis caching, and AWS Bedrock AI. Tasks are ordered to build foundational infrastructure first, then core services, frontend, integrations, and AI — each step wiring into the previous.

## Tasks

- [x] 1. Initialize monorepo, shared packages, and project infrastructure
  - [x] 1.1 Set up Turborepo monorepo with `apps/` (web-crm, admin-portal) and `services/` (auth-service, crm-service, sales-service, quotation-service, notification-service) and `packages/` (ui-components, shared-types, utils) directories
    - Initialize `package.json` workspaces, `turbo.json` pipeline config, shared `tsconfig.base.json`
    - Add root dev dependencies: TypeScript, ESLint, Prettier, Jest, fast-check
    - _Requirements: 14.1, 14.7_

  - [x] 1.2 Create `packages/shared-types` with all TypeScript interfaces from the design
    - Define `DomainEvent`, `AuthTokenPayload`, `Permission`, `Role`, `Account`, `ThaiAddress`, `Contact`, `TimelineEntry`, `Lead`, `Opportunity`, `PipelineStage`, `SalesTarget`, `Product`, `Quotation`, `QuotationLineItem`, `Notification`, `WebhookConfig`, `WebhookDelivery`, `AISummaryRequest`, `AISummaryResponse`, `LeadScore`, `ScoreFactor`, `ChatMessage`, `ChatSession`, `ErrorResponse` interfaces
    - _Requirements: 3.1, 4.1, 5.1, 6.2, 8.1, 10.1, 11.8, 17.1_

  - [x] 1.3 Create `packages/utils` with Thai localization utilities
    - Implement Buddhist Era date conversion (`toThaiDate`, `fromThaiDate`) with `Intl.DateTimeFormat` wrapper
    - Implement Thai Baht currency formatter (`formatBaht`, `parseBaht`) with comma thousands and period decimals
    - Implement Thai address formatter (`formatThaiAddress`) with correct component ordering (street, ตำบล/แขวง, อำเภอ/เขต, จังหวัด, postal code)
    - _Requirements: 12.2, 12.3, 12.5, 4.7_

  - [ ]* 1.4 Write property tests for Thai localization utilities
    - **Property 17: Buddhist Era Date Conversion Round-Trip** — for any valid Gregorian date, `fromThaiDate(toThaiDate(date))` returns the original date; Thai year = Gregorian year + 543
    - **Validates: Requirements 12.2**

  - [ ]* 1.5 Write property test for Thai Baht formatting
    - **Property 18: Thai Baht Currency Formatting Round-Trip** — for any non-negative number, `parseBaht(formatBaht(n))` returns the original number within 0.01 tolerance; output matches `฿{digits_with_commas}.{two_decimals}`
    - **Validates: Requirements 12.3**

  - [ ]* 1.6 Write property test for Thai address formatting
    - **Property 4: Thai Address Formatting** — for any valid ThaiAddress, formatted output contains all non-empty components in correct Thai address order
    - **Validates: Requirements 4.7, 12.5**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Auth Service with RBAC and multi-tenant isolation
  - [x] 3.1 Scaffold `services/auth-service` NestJS application with PostgreSQL (TypeORM/Prisma), Redis connection, and JWT module
    - Create Tenant, User, Role, RolePermission, UserRole entities matching the data model
    - Set up PostgreSQL RLS policies: `CREATE POLICY tenant_isolation ON {table} USING (tenant_id = current_setting('app.current_tenant')::uuid)`
    - Implement `TenantGuard` middleware that extracts `tenant_id` from JWT and sets `app.current_tenant` on each DB connection
    - _Requirements: 3.1, 3.2, 1.1_

  - [x] 3.2 Implement authentication endpoints
    - `POST /auth/login` — validate email/password (bcrypt cost 12), issue JWT access + refresh tokens with `AuthTokenPayload`
    - `POST /auth/mfa/verify` — TOTP verification flow after initial login
    - `POST /auth/sso/{provider}` and `/auth/sso/{provider}/callback` — Google Workspace and Microsoft Entra ID SSO via Passport.js
    - `POST /auth/logout` — blacklist JWT in Redis
    - `POST /auth/refresh` — refresh access token
    - `GET /auth/me` — return current user profile with permissions
    - Implement account lockout: 5 failed attempts → 15-minute lock (Redis counter with TTL), email notification
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 3.3 Implement RBAC system
    - `POST /roles`, `PUT /roles/:id`, `GET /roles` — CRUD for custom roles with granular permissions (module + action)
    - Seed default roles: Admin, Sales Manager, Sales Rep, Viewer
    - `POST /users`, `PUT /users/:id/roles` — user management and role assignment
    - Implement `PermissionGuard` decorator that checks user's roles against required permission for each endpoint
    - Ensure permission changes propagate within 30 seconds (invalidate Redis permission cache)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.4 Write property test for RBAC enforcement
    - **Property 1: RBAC Enforcement** — for any API endpoint and user, access is granted iff the user's roles include the required permission; unauthorized attempts return HTTP 403
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 3.5 Write property test for tenant data isolation
    - **Property 2: Tenant Data Isolation** — for any query by an authenticated user, results contain only records where `tenant_id` matches the user's tenant; no cross-tenant data leakage
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 4. Implement CRM Service — Customer 360
  - [x] 4.1 Scaffold `services/crm-service` NestJS application with PostgreSQL (RLS), OpenSearch client, and S3 client
    - Create Account, Contact, Note, Attachment, Tag, AccountTag, Activity entities
    - Apply RLS policies on all tables
    - _Requirements: 3.1, 4.1_

  - [x] 4.2 Implement Account and Contact CRUD endpoints
    - `GET/POST /accounts`, `GET/PUT/DELETE /accounts/:id` — full account lifecycle with Thai address fields (street, sub_district, district, province, postal_code)
    - `GET /accounts/:id/contacts`, `POST /contacts`, `PUT /contacts/:id` — contact management with LINE ID field
    - Implement soft-delete (`deleted_at` timestamp) for accounts and contacts
    - _Requirements: 4.1, 4.2, 4.7, 12.5_

  - [x] 4.3 Implement activity timeline, notes, and tags
    - `POST /accounts/:id/notes` — create notes with optional file attachments (S3 upload, 10MB limit, tenant-prefixed keys)
    - `GET /accounts/:id/timeline` — paginated chronological timeline aggregating calls, emails, meetings, notes, deal changes, tasks
    - `POST /tags`, `PUT /accounts/:id/tags` — tag management and assignment for segmentation
    - _Requirements: 4.3, 4.4, 4.5, 3.4_

  - [ ]* 4.4 Write property test for activity timeline ordering
    - **Property 3: Activity Timeline Chronological Ordering** — for any account's timeline with N entries, `timeline[i].timestamp >= timeline[i+1].timestamp` for all consecutive pairs
    - **Validates: Requirements 4.3**

  - [x] 4.5 Implement OpenSearch integration for global search
    - Configure per-tenant index (`crm_{tenant_id}_global`) with Thai analyzer (ICU tokenizer + icu_folding)
    - Index accounts, contacts, leads, opportunities, tasks, notes on create/update/delete
    - `GET /search` — global search endpoint returning results grouped by entity type within 500ms
    - _Requirements: 4.6, 16.1, 16.2, 16.3, 16.4, 3.5_

  - [x] 4.6 Implement audit logging
    - Create AuditLog entity (immutable, append-only)
    - Add database triggers or NestJS interceptors to capture old/new values on INSERT, UPDATE, DELETE for all CRM entities
    - _Requirements: 15.4, 12.7_

  - [ ]* 4.7 Write property test for audit log immutability
    - **Property 19: Audit Log Immutability** — once created, audit log and consent records are never modified or deleted; record count is monotonically non-decreasing
    - **Validates: Requirements 12.7, 15.4**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Sales Service — Leads and Pipeline
  - [x] 6.1 Scaffold `services/sales-service` NestJS application with PostgreSQL (RLS) and Redis
    - Create Lead, Opportunity, PipelineStage, SalesTarget, OpportunityHistory, LeadScore entities
    - Apply RLS policies on all tables
    - _Requirements: 3.1, 5.1, 6.1_

  - [x] 6.2 Implement lead management endpoints
    - `POST /leads` — create lead with source attribution and timestamp
    - `POST /leads/import` — bulk import from CSV/Excel with per-row validation (require name + phone or email)
    - `GET /leads` — list leads with Kanban and list view support
    - `PUT /leads/:id`, `PUT /leads/:id/status` — update lead and move status with history recording
    - `POST /leads/:id/assign` — assign lead to rep
    - `POST /leads/bulk` — bulk assign, status update, delete
    - Implement configurable status pipeline per tenant (New, Contacted, Qualified, Proposal, Negotiation, Won, Lost)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [x] 6.3 Implement lead assignment rules and duplicate detection
    - Round-robin assignment: cycle through active sales reps in consistent order, each rep gets ⌊N/M⌋ or ⌈N/M⌉ leads
    - Territory-based and manual assignment options
    - `GET /leads/:id/duplicates` — duplicate detection by matching email, phone, company name (case-insensitive, whitespace-normalized)
    - _Requirements: 5.3, 5.6_

  - [ ]* 6.4 Write property test for lead import validation
    - **Property 5: Lead Import Validation** — a row is rejected iff it is missing both phone and email AND missing name; errors report specific missing fields per row
    - **Validates: Requirements 5.2**

  - [ ]* 6.5 Write property test for round-robin lead assignment
    - **Property 6: Round-Robin Lead Assignment** — for N leads assigned to M reps, each rep receives ⌊N/M⌋ or ⌈N/M⌉ leads in consistent cycling order
    - **Validates: Requirements 5.3**

  - [ ]* 6.6 Write property test for lead duplicate detection
    - **Property 7: Lead Duplicate Detection** — two leads in the same tenant are flagged as duplicates iff they share matching email, phone, or company name (case-insensitive, whitespace-normalized)
    - **Validates: Requirements 5.6**

  - [x] 6.7 Implement opportunity and pipeline management endpoints
    - `POST /opportunities` — create opportunity with deal name, account, estimated value (Thai Baht), expected close date, stage
    - `GET /opportunities` — list opportunities with Kanban view
    - `PUT /opportunities/:id`, `PUT /opportunities/:id/stage` — update opportunity and move stage with audit history
    - `PUT /opportunities/:id/close` — close as Won/Lost with required reason and optional notes
    - `GET /pipeline/summary` — total value, weighted value, deal count per stage
    - `GET/PUT /pipeline/stages` — configurable stages per tenant with probability percentages
    - `POST /targets`, `GET /targets` — sales targets (monthly/quarterly) per rep with progress tracking
    - Calculate `weightedValue = estimatedValue * stageProbability / 100` on every stage change
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 6.8 Write property test for pipeline summary aggregation
    - **Property 8: Pipeline Summary Aggregation** — per-stage totals: `totalValue = sum(estimatedValue)`, `weightedValue = sum(estimatedValue * probability / 100)`, `dealCount = count(opportunities)` for each stage
    - **Validates: Requirements 6.3, 6.5**

- [x] 7. Implement Activity Manager — Tasks and Calendar
  - [x] 7.1 Add task management to CRM or Sales service
    - Create Task entity with title, due_date, priority (High/Medium/Low), status (Open/In Progress/Completed/Overdue), associations to account/contact/opportunity
    - `POST /tasks` — create task with required title, due_date, priority
    - `GET /tasks` — list tasks sortable by due_date, priority, status
    - `PUT /tasks/:id` — update task
    - Implement overdue detection: scheduled job marks tasks as Overdue when `due_date < current_date AND status ≠ Completed`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.2 Implement call logging and calendar view support
    - `POST /activities/calls` — log call with duration, outcome, notes linked to account/contact
    - Calendar view data endpoint returning tasks, appointments, meetings in daily/weekly/monthly format
    - _Requirements: 7.4, 7.5_

  - [ ]* 7.3 Write property test for task sorting correctness
    - **Property 9: Task Sorting Correctness** — tasks sorted by due_date, priority, or status are totally ordered by that field's natural ordering
    - **Validates: Requirements 7.2**

  - [ ]* 7.4 Write property test for overdue task detection
    - **Property 10: Overdue Task Detection** — a task is marked Overdue iff `due_date < current_date AND status ∉ {Completed}`; completed or future tasks are never marked Overdue
    - **Validates: Requirements 7.3**

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Quotation Service
  - [x] 9.1 Scaffold `services/quotation-service` NestJS application with PostgreSQL (RLS) and S3
    - Create Product, Quotation, QuotationLineItem, QuotationSequence entities
    - Apply RLS policies on all tables
    - _Requirements: 3.1, 8.1_

  - [x] 9.2 Implement product catalog endpoints
    - `GET /products`, `POST /products`, `PUT /products/:id` — product CRUD with name, SKU, description, unit price (Thai Baht), unit of measure, WHT rate, active status
    - _Requirements: 8.1_

  - [x] 9.3 Implement quotation creation and financial calculations
    - `POST /quotations` — create quotation with line items from product catalog, quantities, line-item or total discounts
    - Calculate: `line_total = (quantity × unit_price) - discount_amount`, `subtotal = sum(line_totals)`, `vat_amount = (subtotal - total_discount) × 0.07`, `wht_amount = sum(line_total × wht_rate / 100)`, `grand_total = subtotal - total_discount + vat_amount - wht_amount`
    - All calculations use 2 decimal places, rounded half-up
    - `GET /quotations`, `GET /quotations/:id`, `PUT /quotations/:id`
    - _Requirements: 8.2, 8.3, 12.4_

  - [ ]* 9.4 Write property test for quotation financial calculations
    - **Property 11: Quotation Financial Calculation** — for any quotation with N line items, subtotal/VAT/WHT/grand_total are calculated correctly per the formula with 2 decimal precision
    - **Validates: Requirements 8.3, 12.4**

  - [x] 9.5 Implement quotation numbering, status transitions, and approval workflow
    - Sequential quotation number per tenant using `quotation_sequence` table with `SELECT ... FOR UPDATE` — format: `{prefix}-{year}-{zero_padded_sequence}`
    - Status state machine: Draft → {Sent, pending_approval}, pending_approval → {Sent, Draft}, Sent → {Accepted, Rejected, Expired}
    - `PUT /quotations/:id/status` — enforce valid transitions only
    - `POST /quotations/:id/approve` — manager approval for quotations exceeding discount threshold
    - Discount approval routing: if total discount % > tenant threshold → set status to `pending_approval`
    - _Requirements: 8.5, 8.7, 8.8_

  - [ ]* 9.6 Write property test for quotation number sequentiality
    - **Property 12: Quotation Number Sequentiality** — for any tenant, quotation numbers are strictly sequential with no gaps; `S2 = S1 + 1` for consecutive quotations
    - **Validates: Requirements 8.5**

  - [ ]* 9.7 Write property test for quotation status transitions
    - **Property 13: Quotation Status Transitions** — only valid state machine transitions are permitted; all other transitions are rejected
    - **Validates: Requirements 8.7**

  - [ ]* 9.8 Write property test for discount approval routing
    - **Property 14: Discount Approval Routing** — quotations with discount % > threshold get `pending_approval` status; those at or below proceed to `sent`
    - **Validates: Requirements 8.8**

  - [x] 9.9 Implement PDF generation and delivery
    - `POST /quotations/:id/finalize` — generate PDF using tenant's Thai quotation template (company logo, address, tax ID) and assign quotation number
    - `POST /quotations/:id/send` — deliver PDF via email or LINE OA based on user selection
    - Store generated PDF in S3 with tenant-prefixed key
    - _Requirements: 8.4, 8.6, 3.4_

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Notification Service — LINE OA, Email, Webhooks
  - [x] 11.1 Scaffold `services/notification-service` NestJS application with SQS consumer, Redis, and PostgreSQL
    - Create Notification, WebhookConfig, WebhookDelivery entities
    - Set up SQS queue consumers for async notification processing
    - _Requirements: 10.1, 17.1_

  - [x] 11.2 Implement LINE OA integration
    - `POST /line/configure` — configure LINE OA channel with tenant's channel access token and secret
    - `POST /line/webhook` — LINE webhook receiver for incoming customer messages → create activity record in CRM service
    - LINE push message sending for: lead assignment, task overdue, deal stage change (within 60 seconds)
    - Quotation PDF delivery via LINE message
    - Log all LINE messages with timestamps, recipient, delivery status
    - Retry on LINE API error: up to 3 times with exponential backoff (1s, 2s, 4s), log failures
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 11.3 Implement webhook system
    - `POST /webhooks`, `GET /webhooks`, `PUT /webhooks/:id` — webhook CRUD with URL, HMAC secret, event type filters, entity type filters
    - `GET /webhooks/:id/logs` — webhook delivery logs
    - Fire webhook events on entity create/update/delete within 30 seconds
    - HMAC signature on webhook payloads
    - Retry on delivery failure: up to 5 times with exponential backoff (5s, 10s, 20s, 40s, 80s)
    - _Requirements: 17.2, 17.3, 17.5, 17.6_

  - [x] 11.4 Implement API rate limiting
    - Redis-based sliding window rate limiter: 1000 requests/minute per tenant
    - Return HTTP 429 with `Retry-After` header when exceeded
    - _Requirements: 17.4_

  - [ ]* 11.5 Write property test for exponential backoff retry
    - **Property 15: Exponential Backoff Retry** — delay between attempt N and N+1 is `base_delay × 2^N`; stops after max attempts (3 for LINE, 5 for webhooks)
    - **Validates: Requirements 10.5, 17.5**

  - [ ]* 11.6 Write property test for API rate limiting
    - **Property 20: API Rate Limiting** — allows up to 1000 requests/minute per tenant; 1001st request returns HTTP 429; requests allowed again after window reset
    - **Validates: Requirements 17.4**

  - [ ]* 11.7 Write property test for webhook event filtering
    - **Property 21: Webhook Event Filtering** — only events matching both configured entity type AND event type are delivered; non-matching events are not delivered
    - **Validates: Requirements 17.6**

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement AI Service — Bedrock Integration
  - [x] 13.1 Create AI service module with AWS Bedrock (Claude) client
    - Configure Bedrock client with session management and conversation context
    - Implement common prompt templates for Thai and English
    - _Requirements: 11.8_

  - [x] 13.2 Implement meeting summarization and email reply suggestion
    - `POST /ai/summarize` — generate structured summary (key points, action items, next steps) from meeting notes within 10 seconds
    - `POST /ai/email-reply` — generate contextual reply draft based on email thread and customer history
    - Support Thai and English language input/output
    - _Requirements: 11.1, 11.2_

  - [x] 13.3 Implement lead scoring and close probability prediction
    - `GET /ai/lead-score/:leadId` — calculate lead score (0-100) based on engagement signals, demographic fit, behavioral data
    - `GET /ai/close-probability/:oppId` — predict close probability (0-100%) based on historical patterns, deal attributes, activity frequency
    - Scheduled daily job to update all lead scores
    - Clamp all scores to [0, 100] range
    - _Requirements: 11.3, 11.4_

  - [ ]* 13.4 Write property test for AI score bounds
    - **Property 16: AI Score Bounds** — for any lead score or close probability, the value is within [0, 100] inclusive; no negative or >100 values
    - **Validates: Requirements 11.3, 11.4**

  - [x] 13.5 Implement Thai chatbot and natural language search
    - `POST /ai/chat` — Thai language chatbot with CRM data context, respond within 5 seconds, maintain conversation context within session
    - `POST /ai/search` — natural language search (Thai/English) across accounts, contacts, leads, opportunities with ranked results
    - `GET /ai/next-action/:oppId` — next-best-action suggestions on opportunity detail page
    - _Requirements: 11.5, 11.6, 11.7_

- [x] 14. Implement PDPA Consent Management
  - [x] 14.1 Create ConsentRecord entity and endpoints
    - Immutable consent records: consent grants, withdrawals, and data access events
    - Configurable consent purposes and expiration dates
    - `POST /consent` — collect explicit consent from data subjects
    - `POST /consent/:id/withdraw` — record consent withdrawal (creates new record, never updates)
    - `DELETE /contacts/:id/pdpa` — execute data deletion within 30 days, log completion
    - _Requirements: 12.6, 12.7, 12.8_

- [x] 15. Implement Frontend — Next.js App Router with Apple Design System
  - [x] 15.1 Scaffold `apps/web-crm` Next.js application with App Router
    - Configure `next-intl` with Thai (th) default and English (en) locales
    - Set up Tailwind CSS with custom theme tokens for Apple design system
    - Configure SF Pro Display/Text fonts via `@font-face` with optical sizing
    - Set up TanStack Query for server state and Zustand for client UI state
    - _Requirements: 12.1, 14.1, 14.2_

  - [x] 15.2 Create `packages/ui-components` — Apple Design System component library
    - Glass navigation bar: `bg-black/80 backdrop-blur-[20px] backdrop-saturate-[180%]`, 48px height, 12px SF Pro Text white links
    - Primary Blue CTA button: `#0071e3` background, white text, 8px radius, 8px 15px padding
    - Pill CTA link: `rounded-[980px]`, transparent bg, `#0066cc` text with border
    - Card component: light (`bg-[#f5f5f7]`) and dark (`bg-[#272729]`) variants, 8px radius, card shadow only for elevated cards
    - Section layout component: alternating dark (`#000000`) and light (`#f5f5f7`) backgrounds
    - Typography components respecting SF Pro Display (≥20px) / SF Pro Text (<20px) boundary with correct letter-spacing per size tier
    - All interactive elements use Apple Blue `#0071e3`
    - Touch targets minimum 44x44px
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 15.3 Implement authentication pages
    - `(auth)/login` — email/password login form
    - `(auth)/mfa` — MFA verification page (TOTP/SMS)
    - `(auth)/sso` — SSO redirect flow for Google Workspace and Microsoft Entra ID
    - Wire to Auth Service API endpoints
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 15.4 Implement Dashboard pages
    - `(dashboard)/overview` — revenue dashboard with closed-won by month/quarter/year vs targets
    - Pipeline dashboard: deal count and value per stage with drill-down
    - Lead conversion report: conversion rates between stages
    - Rep performance report: activities, deals closed, revenue per rep
    - Top customers report ranked by revenue
    - Aging deals report: opportunities past expected close date
    - Date range filter refreshing all widgets within 3 seconds
    - Charts follow Apple design system (SF Pro typography, Apple Blue accent, `#f5f5f7` card backgrounds)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 15.5 Implement Customer 360 pages
    - `(crm)/accounts` — account list with search and filters
    - `(crm)/accounts/[id]` — account detail page with company info, Thai address display, contacts list, activity timeline, notes with attachments, tags
    - `(crm)/contacts` — contact list and detail views
    - Note creation with file upload (10MB limit)
    - Tag management UI for segmentation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [x] 15.6 Implement Lead and Pipeline pages
    - `(crm)/leads` — lead list and Kanban board with configurable status pipeline
    - Lead detail page with status history, duplicate detection alerts, AI score display
    - Bulk operations UI (assign, update status, delete)
    - Lead import page with CSV/Excel upload and per-row validation error display
    - `(sales)/opportunities` — opportunity Kanban board with drag-and-drop stage transitions
    - Opportunity detail page with deal info, audit history, AI close probability, next-best-action suggestions
    - Close Won/Lost modal with reason selection and notes
    - Pipeline summary view: total value, weighted value, deal count per stage
    - Sales targets page with progress visualization
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 15.7 Implement Quotation pages
    - `(quotation)/catalog` — product catalog management UI
    - `(quotation)/quotations` — quotation list with status filters
    - Quotation creation page: product selection from catalog, quantity input, line-item and total discount controls
    - Live calculation display: subtotal, VAT 7%, WHT, grand total in Thai Baht
    - Quotation detail page with PDF preview, status tracking, approval workflow UI
    - Send quotation modal: choose email or LINE OA delivery
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 15.8 Implement Activity Manager pages
    - Task list view sortable by due_date, priority, status with overdue highlighting
    - Task creation form with title, due_date, priority, account/contact/opportunity association
    - Calendar view (daily, weekly, monthly) displaying tasks, appointments, meetings
    - Call logging form with duration, outcome, notes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 15.9 Implement Global Search (Command Palette)
    - Global search bar accessible via Cmd/Ctrl+K using `cmdk` library
    - Search across accounts, contacts, leads, opportunities, tasks, notes
    - Results grouped by entity type with relevance ranking
    - Navigate directly to selected record's detail page
    - _Requirements: 16.1, 16.2, 16.3, 16.5_

  - [x] 15.10 Implement Settings pages
    - `(settings)/roles` — role management with granular permission assignment UI
    - `(settings)/integrations` — LINE OA, Gmail, Outlook, Google Calendar, Microsoft 365 Calendar configuration
    - `(settings)/webhooks` — webhook endpoint management with event type filtering and delivery logs
    - `(settings)/security` — IP allowlisting, MFA settings
    - `(settings)/pdpa` — PDPA consent management and audit log viewer
    - _Requirements: 2.2, 10.1, 13.1, 13.2, 17.1, 17.6, 15.3, 12.6_

- [x] 16. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implement Email and Calendar Integrations
  - [x] 17.1 Implement Gmail and Outlook email synchronization
    - Gmail API integration: bidirectional sync of sent/received emails, link to contacts by email address
    - Microsoft Graph API integration: bidirectional Outlook email sync, link to contacts by email address
    - Display synced emails in contact's activity timeline
    - Retry on sync failure: up to 3 times, notify user of persistent failures
    - _Requirements: 13.1, 13.2, 13.3, 13.6_

  - [x] 17.2 Implement Google Calendar and Microsoft 365 Calendar synchronization
    - Bidirectional calendar event sync within 5 minutes
    - Google Calendar API and Microsoft 365 Calendar API integration
    - _Requirements: 7.6, 13.4, 13.5_

- [x] 18. Wire all services together and implement cross-cutting concerns
  - [x] 18.1 Set up SQS event bus for inter-service communication
    - Configure SQS queues for: lead assignment notifications, task overdue notifications, deal stage change notifications, webhook event dispatch
    - Implement `DomainEvent` envelope for all events (eventId, eventType, tenantId, userId, timestamp, payload, version)
    - Wire CRM, Sales, Quotation services to publish events; Notification service to consume
    - _Requirements: 10.2, 17.2_

  - [x] 18.2 Implement API Gateway with authentication, rate limiting, and OpenAPI documentation
    - JWT validation on all routes
    - API key and OAuth 2.0 bearer token authentication for external API access
    - Rate limiting middleware (1000 req/min per tenant)
    - Generate OpenAPI 3.0 documentation for all core entity endpoints
    - _Requirements: 17.1, 17.3, 17.4_

  - [x] 18.3 Implement security hardening
    - AES-256 encryption at rest (RDS, S3 encryption settings)
    - TLS 1.2+ enforcement for all data in transit
    - IP allowlisting per tenant (optional security policy)
    - _Requirements: 15.1, 15.2, 15.3_

- [x] 19. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major service implementation
- Property tests validate the 21 universal correctness properties defined in the design using fast-check
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript throughout (NestJS backend, Next.js frontend)
- All financial calculations use 2 decimal precision with half-up rounding
- All database tables enforce tenant isolation via PostgreSQL RLS
