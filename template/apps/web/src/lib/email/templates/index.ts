// Email template exports
export { WelcomeEmail } from './welcome';
export { PasswordResetEmail } from './password-reset';  
export { NotificationEmail } from './notification';

// Re-export types for convenience
export type {
  WelcomeEmailVariables,
  PasswordResetEmailVariables,
  NotificationEmailVariables,
} from '../types';