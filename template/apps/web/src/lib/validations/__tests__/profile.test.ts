import { describe, expect, it } from '@jest/globals';

import {
  avatarUploadSchema,
  changePasswordSchema,
  safeParseEmail,
  safeParseProfile,
  updateEmailSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from '../profile';

describe('Profile Validation Schemas', () => {
  describe('updateProfileSchema', () => {
    it('should validate valid profile data', () => {
      const validData = {
        fullName: 'John Doe',
        displayName: 'johndoe',
        bio: 'Software developer',
        timezone: 'America/New_York',
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid full name', () => {
      const invalidData = {
        fullName: 'John123', // Contains numbers
        displayName: 'johndoe',
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty full name', () => {
      const invalidData = {
        fullName: '',
        displayName: 'johndoe',
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject too long display name', () => {
      const invalidData = {
        fullName: 'John Doe',
        displayName: 'a'.repeat(51), // Too long
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow empty bio', () => {
      const validData = {
        fullName: 'John Doe',
        displayName: 'johndoe',
        bio: '',
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('updateEmailSchema', () => {
    it('should validate valid email', () => {
      const validData = {
        email: 'john@example.com',
      };

      const result = updateEmailSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
      };

      const result = updateEmailSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const invalidData = {
        email: '',
      };

      const result = updateEmailSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('avatarUploadSchema', () => {
    it('should validate valid image file', () => {
      const validFile = new File(['test'], 'avatar.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 * 1024 }); // 1MB

      const validData = {
        avatar: validFile,
      };

      const result = avatarUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject non-image file', () => {
      const invalidFile = new File(['test'], 'document.pdf', {
        type: 'application/pdf',
      });

      const invalidData = {
        avatar: invalidFile,
      };

      const result = avatarUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject file too large', () => {
      const largeFile = new File(['test'], 'avatar.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 }); // 6MB

      const invalidData = {
        avatar: largeFile,
      };

      const result = avatarUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate strong password', () => {
      const validData = {
        currentPassword: 'oldpassword123',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject weak password', () => {
      const invalidData = {
        currentPassword: 'oldpassword123',
        newPassword: 'weak', // Too weak
        confirmPassword: 'weak',
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        currentPassword: 'oldpassword123',
        newPassword: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('updatePreferencesSchema', () => {
    it('should validate valid preferences', () => {
      const validData = {
        theme: 'dark',
        language: 'en',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        currency: 'USD',
        notifications: {
          email: true,
          chat: false,
          security: true,
        },
      };

      const result = updatePreferencesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid theme', () => {
      const invalidData = {
        theme: 'invalid-theme',
      };

      const result = updatePreferencesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow partial preferences', () => {
      const validData = {
        theme: 'light',
        notifications: {
          email: true,
        },
      };

      const result = updatePreferencesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Safe parsing helpers', () => {
    it('should parse valid profile data with safeParseProfile', () => {
      const validData = {
        fullName: 'John Doe',
        displayName: 'johndoe',
      };

      const result = safeParseProfile(validData);
      expect(result.success).toBe(true);
    });

    it('should parse valid email with safeParseEmail', () => {
      const validData = {
        email: 'john@example.com',
      };

      const result = safeParseEmail(validData);
      expect(result.success).toBe(true);
    });
  });
});
