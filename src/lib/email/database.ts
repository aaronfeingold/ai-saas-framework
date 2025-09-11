import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc, and, count } from 'drizzle-orm';

import { emailLogs, type InsertEmailLog, type SelectEmailLog } from '@/lib/db/schema';
import type { EmailStatus, EmailTemplate } from './types';

// Database connection
const connectionString = process.env.VECTOR_DATABASE_URL || process.env.DATABASE_URL || '';
const sql = postgres(connectionString);
const db = drizzle(sql);

/**
 * Database service for email operations
 */
export class EmailDatabase {
  /**
   * Log an email to the database
   */
  static async logEmail(data: {
    to: string;
    subject: string;
    template: EmailTemplate;
    status: EmailStatus;
    resendId?: string;
    error?: string;
    variables?: Record<string, any>;
  }): Promise<SelectEmailLog> {
    try {
      const emailLog: InsertEmailLog = {
        to: data.to,
        subject: data.subject,
        template: data.template,
        status: data.status,
        resendId: data.resendId,
        variables: data.variables,
        error: data.error,
        sentAt: data.status === 'sent' ? new Date() : undefined,
      };

      const [result] = await db.insert(emailLogs).values(emailLog).returning();
      return result;
    } catch (error) {
      console.error('Failed to log email to database:', error);
      throw error;
    }
  }

  /**
   * Update email status (e.g., when webhook receives delivery confirmation)
   */
  static async updateEmailStatus(
    resendId: string,
    status: EmailStatus,
    deliveredAt?: Date
  ): Promise<SelectEmailLog | null> {
    try {
      const updateData: Partial<SelectEmailLog> = {
        status,
        updatedAt: new Date(),
      };

      if (deliveredAt) {
        updateData.deliveredAt = deliveredAt;
      }

      const [result] = await db
        .update(emailLogs)
        .set(updateData)
        .where(eq(emailLogs.resendId, resendId))
        .returning();

      return result || null;
    } catch (error) {
      console.error('Failed to update email status:', error);
      return null;
    }
  }

  /**
   * Get email logs with optional filtering
   */
  static async getEmailLogs(options: {
    limit?: number;
    offset?: number;
    status?: EmailStatus;
    template?: EmailTemplate;
    email?: string;
  } = {}): Promise<{
    logs: SelectEmailLog[];
    total: number;
  }> {
    try {
      const { limit = 50, offset = 0, status, template, email } = options;

      // Build where conditions
      const conditions = [];
      if (status) conditions.push(eq(emailLogs.status, status));
      if (template) conditions.push(eq(emailLogs.template, template));
      if (email) conditions.push(eq(emailLogs.to, email));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get logs
      const logs = await db
        .select()
        .from(emailLogs)
        .where(whereClause)
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(emailLogs)
        .where(whereClause);

      return {
        logs,
        total: total || 0,
      };
    } catch (error) {
      console.error('Failed to get email logs:', error);
      throw error;
    }
  }

  /**
   * Get email statistics
   */
  static async getEmailStats(options: {
    startDate?: Date;
    endDate?: Date;
    template?: EmailTemplate;
  } = {}): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    bounced: number;
  }> {
    try {
      const { startDate, endDate, template } = options;

      // Build where conditions
      const conditions = [];
      if (startDate) conditions.push(eq(emailLogs.createdAt, startDate));
      if (endDate) conditions.push(eq(emailLogs.createdAt, endDate));
      if (template) conditions.push(eq(emailLogs.template, template));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get counts by status
      const stats = await db
        .select({
          status: emailLogs.status,
          count: count(),
        })
        .from(emailLogs)
        .where(whereClause)
        .groupBy(emailLogs.status);

      // Process results
      const result = {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        bounced: 0,
      };

      stats.forEach((stat) => {
        const status = stat.status as EmailStatus;
        const statCount = stat.count || 0;
        
        result.total += statCount;
        result[status] = statCount;
      });

      return result;
    } catch (error) {
      console.error('Failed to get email stats:', error);
      throw error;
    }
  }

  /**
   * Get recent email activity for a specific email address
   */
  static async getEmailActivity(
    email: string,
    limit: number = 10
  ): Promise<SelectEmailLog[]> {
    try {
      return await db
        .select()
        .from(emailLogs)
        .where(eq(emailLogs.to, email))
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Failed to get email activity:', error);
      return [];
    }
  }

  /**
   * Check if database connection is working
   */
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to count records in the emailLogs table
      await db.select({ count: count() }).from(emailLogs).limit(1);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Initialize database tables (run migrations)
   * This is a simple check - in production you'd use proper migrations
   */
  static async initializeDatabase(): Promise<{ success: boolean; error?: string }> {
    try {
      // This is a basic initialization check
      // In a real implementation, you'd use proper migration tools
      const testResult = await this.testConnection();
      
      if (!testResult.success) {
        return {
          success: false,
          error: 'Database connection failed. Please ensure the email_logs table exists.',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database initialization failed',
      };
    }
  }
}

// Export default instance for convenience
export const emailDatabase = EmailDatabase;