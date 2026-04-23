# Requirements Document

## Introduction

This document defines the requirements for a multi-tenant SaaS CRM platform purpose-built for Small and Medium Businesses (SMBs) in Thailand. The platform targets four primary industry segments — retail, service, manufacturing, and distribution — and provides a complete customer relationship management solution with deep Thailand localization, AI-powered sales assistance, and an Apple-inspired design system. The MVP scope covers authentication, Customer 360, lead management, sales pipeline, activity management, quotation generation, dashboards, LINE notifications, and an AI sales assistant.

## Glossary

- **CRM_Platform**: The multi-tenant SaaS CRM web application for Thai SMBs
- **Customer_360_Module**: The module providing a unified view of account information, contacts, timeline, notes, attachments, and tags
- **Lead_Manager**: The module responsible for lead capture, import, assignment, status tracking, and duplicate detection
- **Pipeline_Manager**: The module managing sales opportunities through configurable Kanban stages with deal values and forecasting
- **Activity_Manager**: The module handling tasks, reminders, calendar appointments, call logs, and meeting notes
- **Quotation_Engine**: The module for creating quotations from a product catalog, applying pricing and discounts, and generating PDF documents
- **Dashboard_Engine**: The module rendering revenue, pipeline, lead conversion, rep performance, and aging deal reports
- **Notification_Service**: The service responsible for delivering notifications via LINE OA, email, and in-app channels
- **AI_Assistant**: The AI-powered module providing sales assistance, meeting summarization, lead scoring, close probability prediction, and Thai language chatbot capabilities, powered by AWS Bedrock
- **Auth_Service**: The authentication and authorization service supporting MFA, SSO, and role-based access control (RBAC)
- **Tenant**: An isolated organizational unit within the multi-tenant architecture, representing one SMB customer
- **PDPA_Module**: The module managing Personal Data Protection Act (Thailand) consent collection, storage, and audit logging
- **User**: An authenticated person within a Tenant who interacts with the CRM_Platform
- **Admin**: A User with elevated permissions to configure Tenant settings, manage users, and define roles
- **Sales_Rep**: A User whose primary role is managing leads, opportunities, and customer relationships
- **VAT**: Value Added Tax at the Thailand standard rate of 7%
- **WHT**: Withholding Tax as defined by Thai Revenue Department regulations
- **LINE_OA**: LINE Official Account, the business messaging channel on the LINE platform
- **RBAC**: Role-Based Access Control, a permission model where access is granted based on assigned roles
- **MFA**: Multi-Factor Authentication requiring two or more verification methods
- **SSO**: Single Sign-On allowing authentication via external identity providers

## Requirements

### Requirement 1: User Authentication and Session Management

**User Story:** As a User, I want to securely log in to the CRM platform with multiple authentication options, so that my account and customer data remain protected.

#### Acceptance Criteria

1. WHEN a User submits valid credentials (email and password), THE Auth_Service SHALL authenticate the User and issue a session token within 2 seconds
2. WHEN a User enables MFA, THE Auth_Service SHALL require a second verification factor (TOTP or SMS) before granting access
3. WHERE SSO is configured for a Tenant, THE Auth_Service SHALL redirect the User to the configured identity provider (Google Workspace, Microsoft Entra ID) for authentication
4. IF a User submits invalid credentials 5 consecutive times, THEN THE Auth_Service SHALL lock the account for 15 minutes and notify the User via email
5. WHEN a session token expires, THE Auth_Service SHALL require the User to re-authenticate
6. THE Auth_Service SHALL store passwords using bcrypt with a minimum cost factor of 12
7. WHEN a User logs out, THE Auth_Service SHALL invalidate the session token immediately

### Requirement 2: Role-Based Access Control

**User Story:** As an Admin, I want to define roles and permissions for my team members, so that each person can access only the features and data relevant to their responsibilities.

#### Acceptance Criteria

1. THE CRM_Platform SHALL enforce RBAC on every API endpoint and UI component
2. WHEN an Admin creates a custom role, THE CRM_Platform SHALL allow the Admin to assign granular permissions (create, read, update, delete) per module
3. THE CRM_Platform SHALL provide default roles: Admin, Sales Manager, Sales_Rep, and Viewer
4. IF a User attempts to access a resource without the required permission, THEN THE CRM_Platform SHALL return an HTTP 403 response and log the access attempt
5. WHEN an Admin modifies a role's permissions, THE CRM_Platform SHALL apply the changes to all Users assigned that role within 30 seconds

### Requirement 3: Multi-Tenant Data Isolation

**User Story:** As a platform operator, I want each Tenant's data to be completely isolated, so that no Tenant can access another Tenant's information.

#### Acceptance Criteria

1. THE CRM_Platform SHALL enforce Tenant-level data isolation on every database query using row-level security or schema separation
2. THE CRM_Platform SHALL include a tenant identifier in every API request and validate the identifier against the authenticated User's Tenant
3. IF a User attempts to access data belonging to a different Tenant, THEN THE CRM_Platform SHALL reject the request and log a security event
4. THE CRM_Platform SHALL isolate file storage (S3) by Tenant using prefixed object keys or separate buckets
5. THE CRM_Platform SHALL isolate search indices (OpenSearch) by Tenant

### Requirement 4: Customer 360 — Account and Contact Management

**User Story:** As a Sales_Rep, I want a unified view of each customer including accounts, contacts, activity timeline, notes, and attachments, so that I can understand the full customer relationship at a glance.

#### Acceptance Criteria

1. THE Customer_360_Module SHALL display account details (company name, industry, address, phone, email, website, tax ID) on a single page
2. WHEN a User opens an account, THE Customer_360_Module SHALL display all associated contacts with name, title, phone, email, and LINE ID
3. THE Customer_360_Module SHALL display a chronological activity timeline showing all interactions (calls, emails, meetings, notes, deal changes) for the account
4. WHEN a User adds a note to an account or contact, THE Customer_360_Module SHALL save the note with author, timestamp, and optional file attachments (up to 10 MB per file)
5. THE Customer_360_Module SHALL support tagging accounts and contacts with custom labels for segmentation
6. WHEN a User searches for an account or contact, THE Customer_360_Module SHALL return results within 500 milliseconds using OpenSearch full-text search
7. THE Customer_360_Module SHALL display Thai address format (sub-district, district, province, postal code) for all Thai addresses

### Requirement 5: Lead Management

**User Story:** As a Sales_Rep, I want to capture, import, assign, and track leads through a status pipeline, so that I can efficiently convert prospects into customers.

#### Acceptance Criteria

1. WHEN a lead is submitted via a web capture form, THE Lead_Manager SHALL create a new lead record with source attribution and timestamp
2. WHEN a User imports leads from a CSV or Excel file, THE Lead_Manager SHALL validate required fields (name, phone or email) and report validation errors per row before import
3. WHEN a new lead is created, THE Lead_Manager SHALL execute assignment rules (round-robin, territory-based, or manual) to assign the lead to a Sales_Rep
4. THE Lead_Manager SHALL provide a configurable status pipeline (e.g., New, Contacted, Qualified, Proposal, Negotiation, Won, Lost) displayed as a Kanban board
5. WHEN a User moves a lead to a new status, THE Lead_Manager SHALL record the status change with timestamp and User in the lead's activity history
6. WHEN a new lead is created, THE Lead_Manager SHALL check for duplicates by matching on email, phone number, and company name, and flag potential duplicates to the User
7. THE Lead_Manager SHALL allow bulk operations (assign, update status, delete) on selected leads

### Requirement 6: Sales Pipeline and Opportunity Management

**User Story:** As a Sales Manager, I want to manage sales opportunities through visual pipeline stages with deal values and forecasting, so that I can track revenue progress and predict outcomes.

#### Acceptance Criteria

1. THE Pipeline_Manager SHALL display opportunities in a drag-and-drop Kanban board with configurable stages per Tenant
2. WHEN a User creates an opportunity, THE Pipeline_Manager SHALL require deal name, associated account, estimated value (in Thai Baht), expected close date, and pipeline stage
3. THE Pipeline_Manager SHALL calculate weighted pipeline value by multiplying deal value by stage probability percentage
4. WHEN a User closes an opportunity as Won or Lost, THE Pipeline_Manager SHALL require a reason selection and optional notes
5. THE Pipeline_Manager SHALL display a pipeline summary showing total value, weighted value, and deal count per stage
6. WHEN a User updates an opportunity's stage or value, THE Pipeline_Manager SHALL record the change in the opportunity's audit history with timestamp and User
7. THE Pipeline_Manager SHALL support setting quarterly and monthly sales targets per Sales_Rep and display progress against targets

### Requirement 7: Activity Management — Tasks and Calendar

**User Story:** As a Sales_Rep, I want to manage tasks, reminders, and calendar appointments linked to accounts and deals, so that I can stay organized and follow up on time.

#### Acceptance Criteria

1. WHEN a User creates a task, THE Activity_Manager SHALL require a title, due date, priority (High, Medium, Low), and optional association to an account, contact, or opportunity
2. THE Activity_Manager SHALL display tasks in a list view sortable by due date, priority, and status (Open, In Progress, Completed, Overdue)
3. WHEN a task's due date passes without completion, THE Activity_Manager SHALL mark the task as Overdue and send a notification to the assigned User
4. THE Activity_Manager SHALL provide a calendar view displaying tasks, appointments, and meetings in daily, weekly, and monthly formats
5. WHEN a User logs a call, THE Activity_Manager SHALL record the call duration, outcome, and notes linked to the relevant account or contact
6. WHERE Google Calendar or Microsoft 365 Calendar integration is configured, THE Activity_Manager SHALL synchronize appointments bidirectionally within 5 minutes

### Requirement 8: Quotation Generation

**User Story:** As a Sales_Rep, I want to create quotations from a product catalog, apply discounts, and generate professional PDF documents, so that I can send proposals to customers quickly.

#### Acceptance Criteria

1. THE Quotation_Engine SHALL maintain a product catalog with product name, SKU, description, unit price (Thai Baht), and unit of measure per Tenant
2. WHEN a User creates a quotation, THE Quotation_Engine SHALL allow selecting products from the catalog, specifying quantities, and applying line-item or total discounts
3. THE Quotation_Engine SHALL calculate subtotal, VAT at 7%, WHT (when applicable), and grand total automatically
4. WHEN a User finalizes a quotation, THE Quotation_Engine SHALL generate a PDF document using the Tenant's configured Thai quotation template with company logo, address, and tax ID
5. THE Quotation_Engine SHALL assign a sequential quotation number per Tenant with a configurable prefix (e.g., QT-2025-0001)
6. WHEN a User sends a quotation, THE Quotation_Engine SHALL deliver the PDF via email or LINE OA based on the User's selection
7. THE Quotation_Engine SHALL track quotation status (Draft, Sent, Accepted, Rejected, Expired) and record status changes with timestamps
8. IF a discount exceeds the approval threshold configured by the Admin, THEN THE Quotation_Engine SHALL route the quotation for manager approval before sending

### Requirement 9: Dashboard and Reporting

**User Story:** As a Sales Manager, I want interactive dashboards showing revenue, pipeline health, lead conversion, and team performance, so that I can make data-driven decisions.

#### Acceptance Criteria

1. THE Dashboard_Engine SHALL display a revenue dashboard showing closed-won revenue by month, quarter, and year with comparison to targets
2. THE Dashboard_Engine SHALL display a pipeline dashboard showing deal count and value per stage with drill-down capability
3. THE Dashboard_Engine SHALL display a lead conversion report showing conversion rates between pipeline stages
4. THE Dashboard_Engine SHALL display a rep performance report showing activities, deals closed, and revenue per Sales_Rep
5. THE Dashboard_Engine SHALL display a top customers report ranked by revenue contribution
6. THE Dashboard_Engine SHALL display an aging deals report highlighting opportunities that have exceeded their expected close date
7. WHEN a User applies a date range filter, THE Dashboard_Engine SHALL refresh all dashboard widgets within 3 seconds
8. THE Dashboard_Engine SHALL render all charts and data visualizations following the Apple-inspired design system (SF Pro typography, Apple Blue #0071e3 accent, light gray #f5f5f7 card backgrounds)

### Requirement 10: LINE OA Notification Integration

**User Story:** As a Sales_Rep, I want to receive CRM notifications via LINE and send messages to customers through LINE OA, so that I can communicate through the channel most used in Thailand.

#### Acceptance Criteria

1. WHEN a Tenant configures LINE OA integration, THE Notification_Service SHALL authenticate with the LINE Messaging API using the Tenant's channel access token
2. WHEN a new lead is assigned, a task becomes overdue, or a deal stage changes, THE Notification_Service SHALL send a LINE push message to the assigned User within 60 seconds
3. WHEN a User sends a quotation via LINE, THE Notification_Service SHALL deliver the quotation PDF as a LINE message to the customer's LINE account
4. THE Notification_Service SHALL log all LINE messages sent and received with timestamps, recipient, and delivery status
5. IF the LINE API returns an error, THEN THE Notification_Service SHALL retry delivery up to 3 times with exponential backoff and log the failure
6. WHEN a customer replies via LINE OA, THE Notification_Service SHALL create an activity record in the Customer_360_Module linked to the matching contact

### Requirement 11: AI Sales Assistant

**User Story:** As a Sales_Rep, I want an AI assistant that helps me summarize meetings, score leads, predict deal outcomes, and answer questions in Thai, so that I can work more efficiently and close more deals.

#### Acceptance Criteria

1. WHEN a User requests a meeting summary, THE AI_Assistant SHALL generate a structured summary (key points, action items, next steps) from the provided meeting notes within 10 seconds
2. WHEN a User requests an email reply suggestion, THE AI_Assistant SHALL generate a contextual reply draft based on the email thread and customer history
3. THE AI_Assistant SHALL calculate a lead score (0-100) for each lead based on engagement signals, demographic fit, and behavioral data, and update the score daily
4. THE AI_Assistant SHALL predict close probability (0-100%) for each opportunity based on historical win/loss patterns, deal attributes, and activity frequency
5. WHEN a User asks a question in Thai via the chatbot interface, THE AI_Assistant SHALL respond in Thai with relevant CRM data within 5 seconds
6. THE AI_Assistant SHALL provide next-best-action suggestions (e.g., follow up, send proposal, schedule meeting) on the opportunity detail page
7. WHEN a User performs a natural language search (Thai or English), THE AI_Assistant SHALL query across accounts, contacts, leads, and opportunities and return ranked results
8. THE AI_Assistant SHALL use AWS Bedrock as the inference engine and maintain conversation context within a session

### Requirement 12: Thailand Localization

**User Story:** As a User in Thailand, I want the CRM to display in Thai language with Thai date formats, Thai Baht currency, and compliance with Thai tax and privacy regulations, so that the platform fits my local business practices.

#### Acceptance Criteria

1. THE CRM_Platform SHALL provide a complete Thai language UI including all labels, menus, messages, tooltips, and error messages
2. THE CRM_Platform SHALL display dates in Thai Buddhist Era format (พ.ศ.) with the option to switch to Gregorian (ค.ศ.)
3. THE CRM_Platform SHALL use Thai Baht (฿) as the default currency with Thai number formatting (comma for thousands, period for decimals)
4. THE Quotation_Engine SHALL calculate VAT at 7% and support configurable WHT rates (1%, 2%, 3%, 5%) per product or service category
5. THE CRM_Platform SHALL display addresses in Thai format: street, sub-district (ตำบล/แขวง), district (อำเภอ/เขต), province (จังหวัด), postal code
6. THE PDPA_Module SHALL collect explicit consent from data subjects before storing personal data, with configurable consent purposes and expiration dates
7. THE PDPA_Module SHALL maintain an immutable audit log of all consent grants, withdrawals, and data access events
8. WHEN a data subject requests data deletion under PDPA, THE PDPA_Module SHALL execute the deletion within 30 days and log the completion

### Requirement 13: Email and Calendar Integration

**User Story:** As a Sales_Rep, I want my CRM to sync with Gmail, Outlook, and my calendar, so that I can track email conversations and appointments without switching between applications.

#### Acceptance Criteria

1. WHERE Gmail integration is configured, THE CRM_Platform SHALL synchronize sent and received emails bidirectionally, linking emails to matching contacts by email address
2. WHERE Outlook integration is configured, THE CRM_Platform SHALL synchronize sent and received emails bidirectionally, linking emails to matching contacts by email address
3. WHEN an email is linked to a contact, THE Customer_360_Module SHALL display the email in the contact's activity timeline
4. WHERE Google Calendar integration is configured, THE Activity_Manager SHALL synchronize calendar events bidirectionally within 5 minutes
5. WHERE Microsoft 365 Calendar integration is configured, THE Activity_Manager SHALL synchronize calendar events bidirectionally within 5 minutes
6. IF an email synchronization fails, THEN THE CRM_Platform SHALL retry synchronization up to 3 times and notify the User of persistent failures

### Requirement 14: Apple-Inspired Design System Implementation

**User Story:** As a User, I want the CRM interface to follow the Apple-inspired design system with clean typography, minimal chrome, and consistent visual language, so that the application feels premium and is easy to use.

#### Acceptance Criteria

1. THE CRM_Platform SHALL use SF Pro Display for text at 20px and above, and SF Pro Text for text below 20px, with the specified negative letter-spacing at each size tier
2. THE CRM_Platform SHALL use Apple Blue (#0071e3) as the sole accent color for all interactive elements (buttons, links, focus states)
3. THE CRM_Platform SHALL implement the translucent dark glass navigation bar (rgba(0,0,0,0.8) with backdrop-filter: saturate(180%) blur(20px)) as the primary navigation component
4. THE CRM_Platform SHALL use pill-shaped CTAs (980px border-radius) for primary action links and standard 8px border-radius for filled buttons
5. THE CRM_Platform SHALL alternate between dark (#000000) and light (#f5f5f7) section backgrounds for page layouts following the cinematic rhythm pattern
6. THE CRM_Platform SHALL apply the card shadow (rgba(0,0,0,0.22) 3px 5px 30px 0px) only for elevated product cards and use no shadow for standard content cards
7. THE CRM_Platform SHALL be responsive across all defined breakpoints (360px to 1440px+) with touch targets meeting minimum 44x44px dimensions

### Requirement 15: Security and Data Protection

**User Story:** As an Admin, I want the platform to encrypt data, enforce security policies, and pass vulnerability assessments, so that our customer data is protected against threats.

#### Acceptance Criteria

1. THE CRM_Platform SHALL encrypt all data at rest using AES-256 encryption
2. THE CRM_Platform SHALL encrypt all data in transit using TLS 1.2 or higher
3. THE Auth_Service SHALL support IP allowlisting per Tenant as an optional security policy
4. THE CRM_Platform SHALL maintain an immutable audit log of all data creation, modification, and deletion events with User identity, timestamp, and changed fields
5. WHEN a security vulnerability is reported, THE CRM_Platform SHALL provide a mechanism for applying patches without service downtime
6. THE CRM_Platform SHALL undergo quarterly automated vulnerability scans and annual penetration testing

### Requirement 16: Search and Data Discovery

**User Story:** As a User, I want to search across all CRM data quickly using keywords or natural language, so that I can find any customer, deal, or activity without navigating through multiple screens.

#### Acceptance Criteria

1. THE CRM_Platform SHALL provide a global search bar accessible from every page via keyboard shortcut (Cmd/Ctrl + K)
2. WHEN a User enters a search query, THE CRM_Platform SHALL return results across accounts, contacts, leads, opportunities, tasks, and notes within 500 milliseconds
3. THE CRM_Platform SHALL rank search results by relevance using OpenSearch scoring and display results grouped by entity type
4. THE CRM_Platform SHALL support Thai language tokenization in search indexing for accurate Thai text search
5. WHEN a User selects a search result, THE CRM_Platform SHALL navigate directly to the selected record's detail page

### Requirement 17: Webhook and API Integration

**User Story:** As an Admin, I want to configure webhooks and access a public API, so that I can integrate the CRM with external systems like ERP, accounting software, and custom applications.

#### Acceptance Criteria

1. THE CRM_Platform SHALL provide a RESTful API with OpenAPI 3.0 documentation for all core entities (accounts, contacts, leads, opportunities, tasks, quotations)
2. WHEN a core entity is created, updated, or deleted, THE CRM_Platform SHALL fire a webhook event to all configured endpoint URLs within 30 seconds
3. THE CRM_Platform SHALL authenticate API requests using API keys or OAuth 2.0 bearer tokens scoped to a Tenant
4. THE CRM_Platform SHALL enforce API rate limiting at 1000 requests per minute per Tenant and return HTTP 429 when exceeded
5. WHEN a webhook delivery fails, THE CRM_Platform SHALL retry delivery up to 5 times with exponential backoff and provide a webhook delivery log in the Admin settings
6. THE CRM_Platform SHALL support webhook event filtering so that Admins can subscribe to specific entity types and event types
