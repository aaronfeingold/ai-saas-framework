import { z } from 'zod';

// Email status types
export type EmailStatus = 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';

// Email template types
export type EmailTemplate = 'welcome' | 'password-reset' | 'notification' | 'payment-confirmation' | 'invoice' | 'subscription-change' | 'system-update' | 'marketing';

// Base email data schema
export const EmailDataSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1, 'Subject is required'),
  template: z.enum(['welcome', 'password-reset', 'notification', 'payment-confirmation', 'invoice', 'subscription-change', 'system-update', 'marketing']),
  variables: z.record(z.any()).optional(),
});

// Send email request schema
export const SendEmailRequestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1, 'Subject is required'),
  template: z.enum(['welcome', 'password-reset', 'notification', 'payment-confirmation', 'invoice', 'subscription-change', 'system-update', 'marketing']),
  variables: z.record(z.any()).optional(),
});

// Bulk email request schema
export const BulkEmailRequestSchema = z.object({
  recipients: z.array(z.string().email()).min(1, 'At least one recipient required'),
  subject: z.string().min(1, 'Subject is required'),
  template: z.enum(['welcome', 'password-reset', 'notification', 'payment-confirmation', 'invoice', 'subscription-change', 'system-update', 'marketing']),
  variables: z.record(z.any()).optional(),
});

// Email log entry
export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  template: EmailTemplate;
  status: EmailStatus;
  resendId?: string;
  variables?: Record<string, any>;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Email service response types
export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkEmailResponse {
  success: boolean;
  results: Array<{
    email: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  totalSent: number;
  totalFailed: number;
}

// Template variables for different email types
export interface WelcomeEmailVariables {
  firstName: string;
  loginUrl: string;
}

export interface PasswordResetEmailVariables {
  firstName: string;
  resetUrl: string;
  expiryHours: number;
}

export interface NotificationEmailVariables {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

export interface PaymentConfirmationEmailVariables {
  firstName: string;
  amount: string;
  currency: string;
  planName: string;
  invoiceUrl: string;
  subscriptionStatus?: 'active' | 'trialing' | 'canceled' | 'past_due';
  billingPeriod?: string;
  nextBillingDate?: string;
  transactionId?: string;
}

export interface SystemUpdateEmailVariables {
  title: string;
  updateSummary: string;
  releaseNotesUrl?: string;
}

export interface InvoiceEmailVariables {
  firstName: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
  invoiceUrl: string;
  planName: string;
  billingPeriod: string;
  paymentMethod?: string;
}

export interface SubscriptionChangeEmailVariables {
  firstName: string;
  changeType: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate';
  oldPlan?: string;
  newPlan?: string;
  effectiveDate: string;
  nextBillingDate?: string;
  amount?: string;
  currency?: string;
  reason?: string;
}

export interface MarketingEmailVariables {
  firstName: string;
  title: string;
  content: string;
  ctaText?: string;
  ctaUrl?: string;
  unsubscribeUrl: string;
}

// Type helper to get variables for a specific template
export type EmailVariables<T extends EmailTemplate> =
  T extends 'welcome' ? WelcomeEmailVariables :
  T extends 'password-reset' ? PasswordResetEmailVariables :
  T extends 'notification' ? NotificationEmailVariables :
  T extends 'payment-confirmation' ? PaymentConfirmationEmailVariables :
  T extends 'invoice' ? InvoiceEmailVariables :
  T extends 'subscription-change' ? SubscriptionChangeEmailVariables :
  T extends 'system-update' ? SystemUpdateEmailVariables :
  T extends 'marketing' ? MarketingEmailVariables :
  Record<string, any>;