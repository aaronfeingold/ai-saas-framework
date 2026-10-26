import { z } from 'zod';

import type {
  ContentData,
  ContentValidationError,
  FieldDefinition,
  FieldValidation,
  FieldValue,
} from './types';

// =============================================================================
// FIELD VALIDATION BUILDERS
// =============================================================================

/**
 * Creates a Zod schema for a specific field type with validation rules
 */
export function createFieldSchema(
  field: FieldDefinition
): z.ZodSchema<FieldValue> {
  const { type, validation } = field;

  let schema: z.ZodSchema<FieldValue>;

  // Base schema by field type
  switch (type) {
    case 'text':
    case 'textarea':
    case 'rich_text':
    case 'url':
    case 'email':
    case 'phone':
      schema = z.string();
      break;

    case 'number':
      schema = z.number();
      break;

    case 'date':
    case 'datetime':
      schema = z.union([z.string(), z.date()]).transform((val) => {
        if (typeof val === 'string') {
          const date = new Date(val);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
          return date;
        }
        return val;
      });
      break;

    case 'boolean':
      schema = z.boolean();
      break;

    case 'select':
      if (!validation.options?.length) {
        throw new Error(
          `Select field "${field.name}" must have options defined`
        );
      }
      schema = z.enum(validation.options as [string, ...string[]]);
      break;

    case 'multi_select':
      if (!validation.options?.length) {
        throw new Error(
          `Multi-select field "${field.name}" must have options defined`
        );
      }
      schema = z.array(z.enum(validation.options as [string, ...string[]]));
      break;

    case 'file':
    case 'image':
      schema = z.union([
        z.string().url(), // URL to uploaded file
        z.object({
          name: z.string(),
          size: z.number(),
          type: z.string(),
          url: z.string().url(),
        }),
      ]);
      break;

    case 'relation':
      if (validation.relation_multiple) {
        schema = z.array(z.string().uuid());
      } else {
        schema = z.string().uuid();
      }
      break;

    case 'json':
      schema = z.record(z.unknown());
      break;

    case 'tags':
      schema = z.array(z.string());
      break;

    default:
      throw new Error(`Unsupported field type: ${type}`);
  }

  // Apply validation rules
  schema = applyValidationRules(schema, field, validation);

  // Handle required/optional
  if (!validation.required) {
    schema = schema.optional();
  }

  return schema;
}

/**
 * Applies validation rules to a base schema
 */
function applyValidationRules(
  schema: z.ZodSchema<FieldValue>,
  field: FieldDefinition,
  validation: FieldValidation
): z.ZodSchema<FieldValue> {
  // String validations
  if (schema instanceof z.ZodString) {
    if (validation.min_length !== undefined) {
      schema = schema.min(validation.min_length);
    }
    if (validation.max_length !== undefined) {
      schema = schema.max(validation.max_length);
    }
    if (validation.pattern) {
      schema = schema.regex(new RegExp(validation.pattern));
    }

    // Specific string type validations
    if (field.type === 'email') {
      schema = schema.email();
    } else if (field.type === 'url') {
      schema = schema.url();
    } else if (field.type === 'phone') {
      schema = schema.regex(/^[+]?[1-9]?[0-9]{7,15}$/);
    }
  }

  // Number validations
  if (schema instanceof z.ZodNumber) {
    if (validation.min_value !== undefined) {
      schema = schema.min(validation.min_value);
    }
    if (validation.max_value !== undefined) {
      schema = schema.max(validation.max_value);
    }
  }

  // File validations
  if (field.type === 'file' || field.type === 'image') {
    schema = schema.refine((value) => {
      if (typeof value === 'string') return true; // URL is valid

      if (typeof value === 'object' && value !== null) {
        const file = value as Record<string, unknown>;

        // Check file types
        if (validation.file_types?.length) {
          const fileExtension = file.name?.split('.').pop()?.toLowerCase();
          if (!validation.file_types.includes(fileExtension)) {
            throw new ContentValidationError(
              `File type not allowed. Allowed types: ${validation.file_types.join(', ')}`,
              field.name,
              value
            );
          }
        }

        // Check file size (convert MB to bytes)
        if (
          validation.max_file_size &&
          file.size > validation.max_file_size * 1024 * 1024
        ) {
          throw new ContentValidationError(
            `File size too large. Maximum size: ${validation.max_file_size}MB`,
            field.name,
            value
          );
        }

        return true;
      }

      return false;
    });
  }

  return schema;
}

// =============================================================================
// CONTENT VALIDATION
// =============================================================================

/**
 * Creates a complete validation schema for a content type
 */
export function createContentValidationSchema(
  fields: FieldDefinition[]
): z.ZodSchema<ContentData> {
  const schemaFields: Record<string, z.ZodSchema<FieldValue>> = {};

  for (const field of fields) {
    try {
      schemaFields[field.name] = createFieldSchema(field);
    } catch (error) {
      throw new ContentValidationError(
        `Failed to create validation schema for field "${field.name}": ${error.message}`,
        field.name,
        null
      );
    }
  }

  return z.object(schemaFields);
}

/**
 * Validates content data against a content type's field definitions
 */
export async function validateContentData(
  data: ContentData,
  fields: FieldDefinition[]
): Promise<
  | { success: true; data: ContentData }
  | { success: false; errors: ContentValidationError[] }
> {
  try {
    const schema = createContentValidationSchema(fields);
    const validatedData = await schema.parseAsync(data);

    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        (err) =>
          new ContentValidationError(
            err.message,
            err.path.join('.'),
            err.code === 'invalid_type' ? data[err.path[0]] : err.input
          )
      );
      return { success: false, errors };
    }

    if (error instanceof ContentValidationError) {
      return { success: false, errors: [error] };
    }

    throw error;
  }
}

// =============================================================================
// FIELD VALUE PROCESSORS
// =============================================================================

/**
 * Processes and normalizes field values before storage
 */
export function processFieldValue(
  value: FieldValue,
  field: FieldDefinition
): FieldValue {
  if (value === null || value === undefined) {
    return field.validation.required ? undefined : null;
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'rich_text':
    case 'url':
    case 'email':
    case 'phone':
      return typeof value === 'string' ? value.trim() : String(value);

    case 'number':
      return typeof value === 'number' ? value : parseFloat(value);

    case 'date':
    case 'datetime':
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      }
      return null;

    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
      return Boolean(value);

    case 'select':
      return typeof value === 'string' ? value : String(value);

    case 'multi_select':
    case 'tags':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return [];

    case 'file':
    case 'image':
      return value; // Files are handled separately in upload process

    case 'relation':
      if (field.validation.relation_multiple) {
        return Array.isArray(value) ? value : [value].filter(Boolean);
      }
      return value;

    case 'json':
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      return {};

    default:
      return value;
  }
}

/**
 * Processes all field values in content data
 */
export function processContentData(
  data: ContentData,
  fields: FieldDefinition[]
): ContentData {
  const processed: ContentData = {};

  for (const field of fields) {
    const value = data[field.name];
    processed[field.name] = processFieldValue(value, field);
  }

  return processed;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates that a content type definition is correct
 */
export function validateContentTypeDefinition(
  fields: FieldDefinition[]
): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  const fieldNames = new Set<string>();

  // Check for duplicate field names
  for (const field of fields) {
    if (fieldNames.has(field.name)) {
      errors.push(`Duplicate field name: ${field.name}`);
    }
    fieldNames.add(field.name);

    // Validate field-specific requirements
    if (field.type === 'select' || field.type === 'multi_select') {
      if (!field.validation.options?.length) {
        errors.push(
          `Field "${field.name}" of type ${field.type} must have options defined`
        );
      }
    }

    if (field.type === 'relation') {
      if (!field.validation.relation_to) {
        errors.push(
          `Field "${field.name}" of type relation must have relation_to defined`
        );
      }
    }

    // Validate field names (must be valid JS identifiers)
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(field.name)) {
      errors.push(`Field name "${field.name}" must be a valid identifier`);
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Generates a default value for a field
 */
export function getFieldDefaultValue(field: FieldDefinition): FieldValue {
  if (field.default_value !== undefined) {
    return field.default_value;
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'rich_text':
    case 'url':
    case 'email':
    case 'phone':
    case 'select':
      return '';

    case 'number':
      return 0;

    case 'boolean':
      return false;

    case 'multi_select':
    case 'tags':
      return [];

    case 'json':
      return {};

    case 'date':
    case 'datetime':
      return null;

    case 'file':
    case 'image':
    case 'relation':
      return null;

    default:
      return null;
  }
}
