import { z } from 'zod';
import { EmailService } from './service';
import { EmailDatabase } from './database';
import { db } from '@/lib/db/postgres';
import { eq, count } from 'drizzle-orm';
import { emailLogs } from '@/lib/db/schema';
import type { EmailTemplate } from './types';

export interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  template: EmailTemplate;
  variables: Record<string, any>;
  priority: 'low' | 'normal' | 'high';
  maxRetries: number;
  currentRetry: number;
  scheduledAt: Date;
  createdAt: Date;
  error?: string;
}

export interface EmailQueueOptions {
  priority?: 'low' | 'normal' | 'high';
  maxRetries?: number;
  delaySeconds?: number;
}

export class EmailQueue {
  private static isProcessing = false;
  private static batchSize = 10;
  private static retryDelays = [60, 300, 900, 1800]; // 1min, 5min, 15min, 30min

  /**
   * Add an email to the queue for later processing
   */
  static async addToQueue(
    to: string,
    subject: string,
    template: EmailTemplate,
    variables: Record<string, any>,
    options: EmailQueueOptions = {}
  ): Promise<string> {
    const {
      priority = 'normal',
      maxRetries = 3,
      delaySeconds = 0
    } = options;

    const scheduledAt = new Date();
    if (delaySeconds > 0) {
      scheduledAt.setSeconds(scheduledAt.getSeconds() + delaySeconds);
    }

    // Create email log entry with pending status
    const emailLog = await EmailDatabase.logEmail({
      to,
      subject,
      template,
      variables,
      status: 'pending',
    });

    // Store queue metadata in the email log variables
    await db
      .update(emailLogs)
      .set({
        variables: {
          ...variables,
          _queue: {
            priority,
            maxRetries,
            currentRetry: 0,
            scheduledAt: scheduledAt.toISOString(),
            createdAt: emailLog.createdAt.toISOString(),
          }
        }
      })
      .where(eq(emailLogs.id, emailLog.id));

    return emailLog.id;
  }

  /**
   * Process queued emails
   */
  static async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('Email queue already processing');
      return;
    }

    this.isProcessing = true;
    console.log('Starting email queue processing');

    try {
      // Get pending emails that are ready to be sent
      const pendingEmails = await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.status, 'pending'))
        .limit(this.batchSize);

      if (pendingEmails.length === 0) {
        console.log('No pending emails to process');
        return;
      }

      console.log(`Processing ${pendingEmails.length} emails`);

      // Sort by priority and scheduled time
      const sortedEmails = pendingEmails
        .filter(email => {
          const queueData = email.variables?._queue;
          if (!queueData?.scheduledAt) return true;
          return new Date(queueData.scheduledAt) <= new Date();
        })
        .sort((a, b) => {
          const aPriority = this.getPriorityValue(a.variables?._queue?.priority || 'normal');
          const bPriority = this.getPriorityValue(b.variables?._queue?.priority || 'normal');
          if (aPriority !== bPriority) return bPriority - aPriority;

          const aScheduled = new Date(a.variables?._queue?.scheduledAt || a.createdAt);
          const bScheduled = new Date(b.variables?._queue?.scheduledAt || b.createdAt);
          return aScheduled.getTime() - bScheduled.getTime();
        });

      // Process emails in parallel but with concurrency limit
      const promises = sortedEmails.map(email => this.processSingleEmail(email));
      await Promise.allSettled(promises);

    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single email from the queue
   */
  private static async processSingleEmail(emailLog: any): Promise<void> {
    const queueData = emailLog.variables?._queue || {};
    const currentRetry = queueData.currentRetry || 0;
    const maxRetries = queueData.maxRetries || 3;

    try {
      // Extract clean variables (without queue metadata)
      const { _queue, ...cleanVariables } = emailLog.variables || {};

      console.log(`Sending email ${emailLog.id} (attempt ${currentRetry + 1})`);

      // Send the email
      const result = await EmailService.sendEmail({
        to: emailLog.to,
        subject: emailLog.subject,
        template: emailLog.template as EmailTemplate,
        variables: cleanVariables,
      });

      if (result.success) {
        // Update status to sent
        await db
          .update(emailLogs)
          .set({
            status: 'sent',
            resendId: result.messageId,
            sentAt: new Date(),
            error: null,
          })
          .where(eq(emailLogs.id, emailLog.id));

        console.log(`Email ${emailLog.id} sent successfully`);
      } else {
        throw new Error(result.error || 'Unknown email service error');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error sending email ${emailLog.id}:`, errorMessage);

      if (currentRetry < maxRetries) {
        // Schedule retry with exponential backoff
        const retryDelay = this.retryDelays[currentRetry] || 1800; // Default 30 min
        const nextScheduledAt = new Date();
        nextScheduledAt.setSeconds(nextScheduledAt.getSeconds() + retryDelay);

        await db
          .update(emailLogs)
          .set({
            error: errorMessage,
            variables: {
              ...emailLog.variables,
              _queue: {
                ...queueData,
                currentRetry: currentRetry + 1,
                scheduledAt: nextScheduledAt.toISOString(),
              }
            }
          })
          .where(eq(emailLogs.id, emailLog.id));

        console.log(`Email ${emailLog.id} scheduled for retry ${currentRetry + 1} in ${retryDelay} seconds`);
      } else {
        // Max retries reached, mark as failed
        await db
          .update(emailLogs)
          .set({
            status: 'failed',
            error: errorMessage,
          })
          .where(eq(emailLogs.id, emailLog.id));

        console.error(`Email ${emailLog.id} failed permanently after ${maxRetries} retries`);
      }
    }
  }

  /**
   * Get the priority value for sorting (higher number = higher priority)
   */
  private static getPriorityValue(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Start the queue processor with interval
   */
  static startProcessor(intervalMs = 60000): void {
    console.log(`Starting email queue processor with ${intervalMs}ms interval`);

    // Process immediately
    this.processQueue();

    // Set up interval
    setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
  }> {
    // Use proper SQL aggregation for accurate and efficient statistics
    const stats = await db
      .select({
        status: emailLogs.status,
        count: count(),
      })
      .from(emailLogs)
      .groupBy(emailLogs.status);

    const counts = {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
    };

    // Process aggregated results
    stats.forEach((stat: { status: string; count: number }) => {
      const status = stat.status;
      const statCount = stat.count || 0;
      if (status in counts) {
        counts[status as keyof typeof counts] = statCount;
      }
    });

    return {
      ...counts,
      processing: this.isProcessing ? 1 : 0,
    };
  }

  /**
   * Retry failed emails
   */
  static async retryFailedEmails(): Promise<number> {
    const failedEmails = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.status, 'failed'));

    let retriedCount = 0;

    for (const email of failedEmails) {
      const queueData = email.variables?._queue || {};

      // Reset retry counter and set to pending
      await db
        .update(emailLogs)
        .set({
          status: 'pending',
          error: null,
          variables: {
            ...email.variables,
            _queue: {
              ...queueData,
              currentRetry: 0,
              scheduledAt: new Date().toISOString(),
            }
          }
        })
        .where(eq(emailLogs.id, email.id));

      retriedCount++;
    }

    return retriedCount;
  }
}

// Enhanced EmailService to support queuing
export class EnhancedEmailService extends EmailService {
  /**
   * Send email immediately or queue it based on options
   */
  static async sendEmailWithQueue(
    to: string,
    subject: string,
    template: EmailTemplate,
    variables: Record<string, any>,
    options: EmailQueueOptions & { immediate?: boolean } = {}
  ): Promise<{ success: boolean; messageId?: string; queueId?: string; error?: string }> {
    const { immediate = false, ...queueOptions } = options;

    if (immediate) {
      return await this.sendEmail({
        to,
        subject,
        template,
        variables,
      });
    } else {
      try {
        const queueId = await EmailQueue.addToQueue(to, subject, template, variables, queueOptions);
        return { success: true, queueId };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to queue email'
        };
      }
    }
  }
}
