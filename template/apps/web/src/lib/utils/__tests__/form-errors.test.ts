import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import {
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  extractValidationErrors,
  getFieldError,
  getToastMessage,
  handleServerActionError,
  hasFieldError,
} from '../form-errors';

describe('Form Error Utilities', () => {
  describe('createErrorResponse', () => {
    it('should create error response', () => {
      const result = createErrorResponse('Test error message');

      expect(result).toEqual({
        success: false,
        error: 'Test error message',
      });
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response without data', () => {
      const result = createSuccessResponse();

      expect(result).toEqual({
        success: true,
      });
    });

    it('should create success response with data and message', () => {
      const data = { id: '123', name: 'Test' };
      const message = 'Operation successful';
      const result = createSuccessResponse(data, message);

      expect(result).toEqual({
        success: true,
        data,
        message,
      });
    });
  });

  describe('extractValidationErrors', () => {
    it('should extract validation errors from ZodError', () => {
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(1),
      });

      try {
        schema.parse({ email: 'invalid', name: '' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = extractValidationErrors(error);

          expect(errors).toHaveProperty('email');
          expect(errors).toHaveProperty('name');
          expect(errors.email).toContain('Invalid email');
        }
      }
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create validation error response', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      try {
        schema.parse({ email: 'invalid' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const result = createValidationErrorResponse(error);

          expect(result.success).toBe(false);
          expect(result.error).toBe('Validation failed');
          expect(result.errors).toHaveProperty('email');
        }
      }
    });
  });

  describe('handleServerActionError', () => {
    it('should handle ZodError', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      try {
        schema.parse({ email: 'invalid' });
      } catch (error) {
        const result = handleServerActionError(error);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation failed');
        expect(result.errors).toHaveProperty('email');
      }
    });

    it('should handle regular Error', () => {
      const error = new Error('Something went wrong');
      const result = handleServerActionError(error);

      expect(result).toEqual({
        success: false,
        error: 'Something went wrong',
      });
    });

    it('should handle unknown error with default message', () => {
      const result = handleServerActionError('unknown error');

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred',
      });
    });

    it('should handle unknown error with custom default message', () => {
      const customMessage = 'Custom error message';
      const result = handleServerActionError('unknown error', customMessage);

      expect(result).toEqual({
        success: false,
        error: customMessage,
      });
    });
  });

  describe('getFieldError', () => {
    it('should get field error', () => {
      const errors = {
        email: ['Invalid email format'],
        name: ['Name is required'],
      };

      const emailError = getFieldError(errors, 'email');
      expect(emailError).toBe('Invalid email format');
    });

    it('should return undefined for non-existent field', () => {
      const errors = {
        email: ['Invalid email format'],
      };

      const phoneError = getFieldError(errors, 'phone');
      expect(phoneError).toBeUndefined();
    });

    it('should handle undefined errors', () => {
      const phoneError = getFieldError(undefined, 'phone');
      expect(phoneError).toBeUndefined();
    });
  });

  describe('hasFieldError', () => {
    it('should return true for field with errors', () => {
      const errors = {
        email: ['Invalid email format'],
      };

      const hasError = hasFieldError(errors, 'email');
      expect(hasError).toBe(true);
    });

    it('should return false for field without errors', () => {
      const errors = {
        email: ['Invalid email format'],
      };

      const hasError = hasFieldError(errors, 'phone');
      expect(hasError).toBe(false);
    });

    it('should handle undefined errors', () => {
      const hasError = hasFieldError(undefined, 'email');
      expect(hasError).toBe(false);
    });
  });

  describe('getToastMessage', () => {
    it('should return success message', () => {
      const result = {
        success: true,
        message: 'Profile updated successfully',
      };

      const toast = getToastMessage(result);
      expect(toast).toEqual({
        type: 'success',
        message: 'Profile updated successfully',
      });
    });

    it('should return default success message', () => {
      const result = {
        success: true,
      };

      const toast = getToastMessage(result);
      expect(toast).toEqual({
        type: 'success',
        message: 'Operation completed successfully',
      });
    });

    it('should return error message', () => {
      const result = {
        success: false,
        error: 'Something went wrong',
      };

      const toast = getToastMessage(result);
      expect(toast).toEqual({
        type: 'error',
        message: 'Something went wrong',
      });
    });

    it('should return default error message', () => {
      const result = {
        success: false,
      };

      const toast = getToastMessage(result);
      expect(toast).toEqual({
        type: 'error',
        message: 'An error occurred',
      });
    });
  });
});
