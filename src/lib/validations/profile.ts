import { z } from 'zod';

// Profile update validation
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be less than 100 characters')
    .regex(
      /^[a-zA-Z\s'-]+$/,
      'Full name can only contain letters, spaces, hyphens, and apostrophes'
    ),

  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be less than 50 characters')
    .regex(
      /^[a-zA-Z0-9\s_-]+$/,
      'Display name can only contain letters, numbers, spaces, underscores, and hyphens'
    ),

  bio: z
    .string()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .or(z.literal('')),

  timezone: z
    .string()
    .regex(/^[A-Za-z]+\/[A-Za-z_]+$/, 'Invalid timezone format')
    .optional(),
});

// Email update validation
export const updateEmailSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email address is too long'),
});

// Avatar upload validation
export const avatarUploadSchema = z.object({
  avatar: z
    .instanceof(File)
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      'Avatar must be less than 5MB'
    )
    .refine(
      (file) =>
        ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
          file.type
        ),
      'Avatar must be a JPEG, PNG, GIF, or WebP image'
    ),
});

// Password change validation (for future use)
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),

    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be less than 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      ),

    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Preferences validation
export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z
    .string()
    .regex(/^[a-z]{2}$/, 'Invalid language code')
    .optional(),
  timezone: z.string().optional(),
  dateFormat: z
    .enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MMM DD, YYYY'])
    .optional(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      chat: z.boolean().optional(),
      security: z.boolean().optional(),
      marketing: z.boolean().optional(),
      system: z.boolean().optional(),
      digest: z.boolean().optional(),
    })
    .optional(),
});

// Security settings validation
export const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean(),
  backupCodes: z.array(z.string()).optional(),
});

// Account deletion validation
export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .refine((value) => value === 'DELETE', 'Please type DELETE to confirm'),

  password: z.string().min(1, 'Password is required to delete your account'),
});

// Export types for TypeScript
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type UpdateEmailData = z.infer<typeof updateEmailSchema>;
export type AvatarUploadData = z.infer<typeof avatarUploadSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type UpdatePreferencesData = z.infer<typeof updatePreferencesSchema>;
export type SecuritySettingsData = z.infer<typeof securitySettingsSchema>;
export type DeleteAccountData = z.infer<typeof deleteAccountSchema>;

// Validation helper functions
export const validateFormData = <T>(
  schema: z.ZodSchema<T>,
  formData: FormData
):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> } => {
  try {
    const data = Object.fromEntries(formData.entries());
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    throw error;
  }
};

// Safe parsing for client-side validation
export const safeParseProfile = (data: unknown) =>
  updateProfileSchema.safeParse(data);
export const safeParseEmail = (data: unknown) =>
  updateEmailSchema.safeParse(data);
export const safeParsePassword = (data: unknown) =>
  changePasswordSchema.safeParse(data);
export const safeParsePreferences = (data: unknown) =>
  updatePreferencesSchema.safeParse(data);
