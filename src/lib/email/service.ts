import { Resend } from 'resend';
import { z } from 'zod';

// Import database service
import { EmailDatabase } from './database';
import { NotificationEmail } from './templates/notification';
import { PasswordResetEmail } from './templates/password-reset';
// Import email templates
import { WelcomeEmail } from './templates/welcome';
import type {
  BulkEmailResponse,
  EmailLog,
  EmailResponse,
  EmailStatus,
  EmailTemplate,
} from './types';
import { BulkEmailRequestSchema, SendEmailRequestSchema } from './types';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email service configuration
const EMAIL_CONFIG = {
  fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
  replyTo: process.env.RESEND_REPLY_TO_EMAIL,
  maxBulkSize: 50, // Resend limit for bulk emails
} as const;

/**
 * Email service class for handling email operations
 */
export class EmailService {
  /**
   * Send a single email using a template
   */
  static async sendEmail(
    data: z.infer<typeof SendEmailRequestSchema>
  ): Promise<EmailResponse> {
    try {
      // Validate input data
      const validatedData = SendEmailRequestSchema.parse(data);

      // Get the email template component
      const emailTemplate = this.getEmailTemplate(
        validatedData.template,
        validatedData.variables
      );

      // Send email via Resend
      const response = await resend.emails.send({
        from: EMAIL_CONFIG.fromEmail,
        to: validatedData.to,
        subject: validatedData.subject,
        react: emailTemplate,
        replyTo: EMAIL_CONFIG.replyTo,
      });

      if (response.error) {
        return {
          success: false,
          error: response.error.message || 'Failed to send email',
        };
      }

      // Log the email to database
      await EmailDatabase.logEmail({
        to: validatedData.to,
        subject: validatedData.subject,
        template: validatedData.template,
        status: 'sent',
        resendId: response.data?.id,
        variables: validatedData.variables,
      });

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      console.error('Email service error:', error);

      // Log failed email
      await EmailDatabase.logEmail({
        to: data.to,
        subject: data.subject,
        template: data.template,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        variables: data.variables,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Send bulk emails (up to 50 recipients per batch)
   */
  static async sendBulkEmail(
    data: z.infer<typeof BulkEmailRequestSchema>
  ): Promise<BulkEmailResponse> {
    try {
      // Validate input data
      const validatedData = BulkEmailRequestSchema.parse(data);

      // Split recipients into batches if needed
      const batches = this.chunkArray(
        validatedData.recipients,
        EMAIL_CONFIG.maxBulkSize
      );
      const results: BulkEmailResponse['results'] = [];

      for (const batch of batches) {
        // Get the email template component
        const emailTemplate = this.getEmailTemplate(
          validatedData.template,
          validatedData.variables
        );

        // Send batch via Resend
        const response = await resend.batch.send(
          batch.map((email) => ({
            from: EMAIL_CONFIG.fromEmail,
            to: email,
            subject: validatedData.subject,
            react: emailTemplate,
            replyTo: EMAIL_CONFIG.replyTo,
          }))
        );

        // Process batch results
        if (response.error) {
          // If batch fails, mark all emails as failed
          for (const email of batch) {
            results.push({
              email,
              success: false,
              error: response.error.message || 'Batch send failed',
            });

            // Log failed email
            await EmailDatabase.logEmail({
              to: email,
              subject: validatedData.subject,
              template: validatedData.template,
              status: 'failed',
              error: response.error.message || 'Batch send failed',
              variables: validatedData.variables,
            });
          }
        } else {
          // Process individual results
          if (response.data?.data && Array.isArray(response.data.data)) {
            for (let index = 0; index < response.data.data.length; index++) {
              const result = response.data.data[index];
              const email = batch[index];
              const success = true; // If it's in data array, it was successful

              results.push({
                email,
                success,
                messageId: result.id,
              });

              // Log each email
              await EmailDatabase.logEmail({
                to: email,
                subject: validatedData.subject,
                template: validatedData.template,
                status: 'sent',
                resendId: result.id,
                variables: validatedData.variables,
              });
            }
          }
        }
      }

      const totalSent = results.filter((r) => r.success).length;
      const totalFailed = results.filter((r) => !r.success).length;

      return {
        success: totalSent > 0,
        results,
        totalSent,
        totalFailed,
      };
    } catch (error) {
      console.error('Bulk email service error:', error);

      // Log all emails as failed
      for (const email of data.recipients) {
        await EmailDatabase.logEmail({
          to: email,
          subject: data.subject,
          template: data.template,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          variables: data.variables,
        });
      }

      return {
        success: false,
        results: data.recipients.map((email) => ({
          email,
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to send email',
        })),
        totalSent: 0,
        totalFailed: data.recipients.length,
      };
    }
  }

  /**
   * Get the appropriate email template component
   */
  private static getEmailTemplate(
    template: EmailTemplate,
    variables: any = {}
  ) {
    switch (template) {
      case 'welcome':
        return WelcomeEmail(variables);
      case 'password-reset':
        return PasswordResetEmail(variables);
      case 'notification':
        return NotificationEmail(variables);
      case 'payment-confirmation':
        // TODO: Implement in Phase 2
        return NotificationEmail(variables);
      case 'system-update':
        // TODO: Implement in Phase 2
        return NotificationEmail(variables);
      case 'marketing':
        // TODO: Implement in Phase 4
        return NotificationEmail(variables);
      default:
        throw new Error(`Unknown email template: ${template}`);
    }
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Test email sending functionality
   */
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to send a test email to verify configuration
      const response = await resend.emails.send({
        from: EMAIL_CONFIG.fromEmail,
        to: 'test@example.com', // This won't actually send due to Resend's test mode
        subject: 'Test Connection',
        html: '<p>This is a test email to verify Resend configuration.</p>',
      });

      return {
        success: !response.error,
        error: response.error?.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export default instance for convenience
export const emailService = EmailService;
