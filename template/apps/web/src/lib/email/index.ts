// Main email system exports
export { EmailService } from './service';
export { EmailDatabase } from './database';

// Template exports
export * from './templates';

// Type exports
export * from './types';

// Convenience exports for common operations
export const emailService = EmailService;
export const emailDatabase = EmailDatabase;