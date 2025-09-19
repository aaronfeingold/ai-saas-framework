# Email System MVP - Phase 1

This document describes the Email System MVP implementation for the AI SaaS Framework.

## Overview

The email system provides a complete solution for sending transactional and bulk emails using Resend as the email service provider. It includes template management, database logging, rate limiting, and a testing interface.

## Features Implemented

### ✅ Phase 1 - Core Email Infrastructure (MVP)

- **Email Service Layer** (`src/lib/email/service.ts`)
  - Resend integration for email sending
  - Template-based email composition
  - Bulk email support with batching
  - Error handling and logging
  - Rate limiting (basic implementation)

- **Email Templates** (`src/lib/email/templates/`)
  - Welcome email template
  - Password reset email template
  - General notification template
  - React Email components with responsive design

- **Database Integration** (`src/lib/email/database.ts`)
  - Email logging to PostgreSQL
  - Email statistics tracking
  - Status updates and delivery tracking
  - Query interface for email history

- **API Endpoints**
  - `POST /api/email/send` - Send single emails
  - `POST /api/email/bulk` - Send bulk emails
  - `GET /api/email/test` - System connectivity test
  - `POST /api/email/test` - Send test emails
  - `GET /api/email/logs` - Retrieve email logs
  - `GET /api/email/stats` - Email statistics

- **Admin Interface**
  - Email system test page (`/admin/email-test`)
  - System status monitoring
  - Test email sending interface
  - Email logs and statistics viewing

- **Database Schema**
  - `email_logs` table for tracking sent emails
  - `email_templates` table (ready for Phase 2)
  - `email_campaigns` table (ready for Phase 4)
  - `email_campaign_recipients` table (ready for Phase 4)

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```env
# Resend Configuration
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Database (uses existing VECTOR_DATABASE_URL)
VECTOR_DATABASE_URL=postgresql://username:password@localhost:5432/vector_db
```

### Dependencies

The following packages have been added:

```bash
pnpm add resend @react-email/components
```

## Usage Examples

### Sending a Single Email

```typescript
import { EmailService } from '@/lib/email';

const result = await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to our platform!',
  template: 'welcome',
  variables: {
    firstName: 'John',
    loginUrl: 'https://your-app.com/login',
  },
});
```

### Sending Bulk Emails

```typescript
import { EmailService } from '@/lib/email';

const result = await EmailService.sendBulkEmail({
  recipients: ['user1@example.com', 'user2@example.com'],
  subject: 'Important Update',
  template: 'notification',
  variables: {
    title: 'System Maintenance',
    message: 'Scheduled maintenance tonight.',
  },
});
```

### Retrieving Email Logs

```typescript
import { EmailDatabase } from '@/lib/email';

const { logs, total } = await EmailDatabase.getEmailLogs({
  limit: 50,
  status: 'sent',
  template: 'welcome',
});
```

## API Documentation

### POST /api/email/send

Send a single email using a template.

**Request Body:**
```json
{
  "to": "user@example.com",
  "subject": "Welcome!",
  "template": "welcome",
  "variables": {
    "firstName": "John",
    "loginUrl": "https://app.com/login"
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "resend_message_id",
  "message": "Email sent successfully"
}
```

### POST /api/email/bulk

Send emails to multiple recipients.

**Request Body:**
```json
{
  "recipients": ["user1@example.com", "user2@example.com"],
  "subject": "Newsletter",
  "template": "notification",
  "variables": {
    "title": "Monthly Update",
    "message": "Here's what's new this month..."
  }
}
```

### GET /api/email/logs

Retrieve email logs with optional filtering.

**Query Parameters:**
- `limit` (optional): Number of logs to return (max 100)
- `offset` (optional): Pagination offset
- `status` (optional): Filter by status (pending, sent, delivered, bounced, failed)
- `template` (optional): Filter by template type
- `email` (optional): Filter by recipient email

## Available Templates

### 1. Welcome Template
- **Variables:** `firstName`, `loginUrl`
- **Use case:** New user registration

### 2. Password Reset Template
- **Variables:** `firstName`, `resetUrl`, `expiryHours`
- **Use case:** Password reset requests

### 3. Notification Template
- **Variables:** `title`, `message`, `actionUrl`, `actionText`
- **Use case:** General notifications and alerts

## Rate Limiting

- **Single emails:** 10 emails per hour per IP
- **Bulk emails:** 3 bulk operations per day per IP (max 100 recipients each)

## Error Handling

All email operations include comprehensive error handling:
- Input validation with Zod schemas
- Resend API error handling
- Database logging of all attempts
- Detailed error messages and debugging information

## Testing

### System Test
Visit `/admin/email-test` to:
- Test Resend connectivity
- Test database connectivity
- Send test emails
- View recent email logs
- Monitor email statistics

### API Testing
```bash
# Test system connectivity
curl http://localhost:3000/api/email/test

# Send test email
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "template": "notification"}'
```

## Security Features

- Server-side only email operations
- Input validation and sanitization
- Rate limiting to prevent abuse
- No credential exposure to client-side
- CORS protection on API endpoints

## Performance Considerations

- Bulk email batching (50 emails per batch)
- Database indexing on frequently queried fields
- Efficient email template rendering
- Connection pooling for database operations

## Next Steps (Phase 2)

The system is ready for Phase 2 implementation:
- **Transactional Email System** - Payment confirmations, enhanced auth emails
- **Template Management** - Admin interface for template creation
- **Webhook Integration** - Resend delivery status webhooks
- **Email Queue** - Background job processing

## Troubleshooting

### Common Issues

1. **"RESEND_API_KEY is not configured"**
   - Ensure `RESEND_API_KEY` is set in `.env.local`
   - Verify API key is valid and active

2. **"Database connection failed"**
   - Check `VECTOR_DATABASE_URL` configuration
   - Ensure PostgreSQL is running and accessible
   - Run database migrations to create email tables

3. **"Rate limit exceeded"**
   - Implement proper rate limiting with Redis for production
   - Current implementation uses in-memory storage

### Debug Mode

Set `NODE_ENV=development` to enable detailed error logging and stack traces.

## Database Migration

To create the email tables, you'll need to run database migrations. The schema has been added to `src/lib/db/schema.ts` with the following tables:

- `email_logs` - Core email logging
- `email_templates` - Template storage (Phase 2)
- `email_campaigns` - Marketing campaigns (Phase 4)
- `email_campaign_recipients` - Campaign tracking (Phase 4)

Make sure to generate and run the appropriate migration files using your preferred migration tool.