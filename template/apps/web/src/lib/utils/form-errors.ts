import { z } from 'zod';

// Generic error response type
export interface ActionResult<T = unknown> {
  success?: boolean;
  error?: string;
  errors?: Record<string, string[]>;
  data?: T;
  message?: string;
}

// Helper function to create error responses
export const createErrorResponse = (error: string): ActionResult => ({
  success: false,
  error,
});

export const createSuccessResponse = <T>(
  data?: T,
  message?: string
): ActionResult<T> => ({
  success: true,
  data,
  message,
});

// Extract validation errors from Zod error
export const extractValidationErrors = (
  error: z.ZodError
): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return errors;
};

// Create validation error response
export const createValidationErrorResponse = (
  error: z.ZodError
): ActionResult => ({
  success: false,
  errors: extractValidationErrors(error),
  error: 'Validation failed',
});

// Handle server action errors consistently
export const handleServerActionError = (
  error: unknown,
  defaultMessage = 'An unexpected error occurred'
): ActionResult => {
  console.error('Server action error:', error);

  if (error instanceof z.ZodError) {
    return createValidationErrorResponse(error);
  }

  if (error instanceof Error) {
    return createErrorResponse(error.message);
  }

  return createErrorResponse(defaultMessage);
};

// Client-side form error handling
export interface FormErrors {
  [key: string]: string | undefined;
}

export const getFieldError = (
  errors: Record<string, string[]> | undefined,
  fieldName: string
): string | undefined => {
  return errors?.[fieldName]?.[0];
};

export const hasFieldError = (
  errors: Record<string, string[]> | undefined,
  fieldName: string
): boolean => {
  return Boolean(errors?.[fieldName]?.length);
};

// Toast message helpers for different action results
export const getToastMessage = (
  result: ActionResult
): { type: 'success' | 'error'; message: string } => {
  if (result.success) {
    return {
      type: 'success',
      message: result.message || 'Operation completed successfully',
    };
  } else {
    return {
      type: 'error',
      message: result.error || 'An error occurred',
    };
  }
};

// Form submission handler helper
export const handleFormSubmit = async <T>(
  action: (formData: FormData) => Promise<ActionResult<T>>,
  formData: FormData,
  onSuccess?: (data: T) => void,
  onError?: (error: string) => void
): Promise<void> => {
  try {
    const result = await action(formData);

    if (result.success) {
      onSuccess?.(result.data as T);
    } else {
      onError?.(result.error || 'An error occurred');
    }
  } catch (error) {
    console.error('Form submission error:', error);
    onError?.('An unexpected error occurred');
  }
};

// Optimistic update helper
export const withOptimisticUpdate = <T>(
  optimisticValue: T,
  setter: (value: T) => void,
  action: () => Promise<ActionResult>,
  originalValue: T
) => {
  return async () => {
    // Apply optimistic update
    setter(optimisticValue);

    try {
      const result = await action();

      if (!result.success) {
        // Revert optimistic update on failure
        setter(originalValue);
        throw new Error(result.error);
      }
    } catch (error) {
      // Revert optimistic update on error
      setter(originalValue);
      throw error;
    }
  };
};
