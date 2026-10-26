import { z } from 'zod';

import {
  type ContentField,
  type ContentType,
  pluginRegistry,
} from './plugin-registry';

export interface GeneratedSchema {
  zodSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  formSchema: FormFieldConfig[];
  tableColumns: TableColumnConfig[];
  validationRules: ValidationRule[];
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type:
    | 'input'
    | 'textarea'
    | 'select'
    | 'multiselect'
    | 'checkbox'
    | 'date'
    | 'file';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  description?: string;
  defaultValue?: unknown;
}

export interface TableColumnConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'badge';
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: 'default' | 'badge' | 'date' | 'currency' | 'link';
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'length' | 'pattern' | 'numeric' | 'email' | 'url';
  params?: Record<string, unknown>;
  message: string;
}

export class SchemaGenerator {
  private static instance: SchemaGenerator;

  private constructor() {}

  static getInstance(): SchemaGenerator {
    if (!SchemaGenerator.instance) {
      SchemaGenerator.instance = new SchemaGenerator();
    }
    return SchemaGenerator.instance;
  }

  generateSchema(contentTypeId: string): GeneratedSchema | null {
    const contentType = pluginRegistry.getContentType(contentTypeId);
    if (!contentType) {
      return null;
    }

    return {
      zodSchema: this.generateZodSchema(contentType),
      formSchema: this.generateFormSchema(contentType),
      tableColumns: this.generateTableColumns(contentType),
      validationRules: this.generateValidationRules(contentType),
    };
  }

  private generateZodSchema(
    contentType: ContentType
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of contentType.fields) {
      let zodType = this.getZodTypeForField(field);

      // Apply validation rules
      if (field.validation) {
        zodType = this.applyValidationToZodType(zodType, field);
      }

      // Handle required fields
      if (!field.required) {
        zodType = zodType.optional();
      }

      shape[field.name] = zodType;
    }

    return z.object(shape);
  }

  private getZodTypeForField(field: ContentField): z.ZodTypeAny {
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'url':
      case 'email':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'date':
        return z.string().datetime().or(z.date());
      case 'select':
        if (field.validation?.options) {
          return z.enum(field.validation.options as [string, ...string[]]);
        }
        return z.string();
      case 'multiselect':
        if (field.validation?.options) {
          return z.array(
            z.enum(field.validation.options as [string, ...string[]])
          );
        }
        return z.array(z.string());
      case 'file':
        return z.string(); // File URL or path
      default:
        return z.string();
    }
  }

  private applyValidationToZodType(
    zodType: z.ZodTypeAny,
    field: ContentField
  ): z.ZodTypeAny {
    const validation = field.validation!;

    if (zodType instanceof z.ZodString) {
      if (validation.min) {
        zodType = zodType.min(validation.min);
      }
      if (validation.max) {
        zodType = zodType.max(validation.max);
      }
      if (validation.pattern) {
        zodType = zodType.regex(new RegExp(validation.pattern));
      }
      if (field.type === 'email') {
        zodType = zodType.email();
      }
      if (field.type === 'url') {
        zodType = zodType.url();
      }
    }

    if (zodType instanceof z.ZodNumber) {
      if (validation.min) {
        zodType = zodType.min(validation.min);
      }
      if (validation.max) {
        zodType = zodType.max(validation.max);
      }
    }

    return zodType;
  }

  private generateFormSchema(contentType: ContentType): FormFieldConfig[] {
    return contentType.fields.map((field) => ({
      name: field.name,
      label: field.label,
      type: this.mapFieldTypeToFormType(field.type),
      placeholder: this.generatePlaceholder(field),
      options: field.validation?.options?.map((option) => ({
        value: option,
        label: option.charAt(0).toUpperCase() + option.slice(1),
      })),
      validation: {
        required: field.required,
        minLength: field.validation?.min,
        maxLength: field.validation?.max,
        pattern: field.validation?.pattern,
        min: field.type === 'number' ? field.validation?.min : undefined,
        max: field.type === 'number' ? field.validation?.max : undefined,
      },
      description: field.description,
      defaultValue: field.defaultValue,
    }));
  }

  private mapFieldTypeToFormType(fieldType: string): FormFieldConfig['type'] {
    switch (fieldType) {
      case 'text':
      case 'url':
      case 'email':
      case 'number':
        return 'input';
      case 'textarea':
        return 'textarea';
      case 'boolean':
        return 'checkbox';
      case 'date':
        return 'date';
      case 'select':
        return 'select';
      case 'multiselect':
        return 'multiselect';
      case 'file':
        return 'file';
      default:
        return 'input';
    }
  }

  private generatePlaceholder(field: ContentField): string {
    switch (field.type) {
      case 'text':
        return `Enter ${field.label.toLowerCase()}`;
      case 'textarea':
        return `Enter ${field.label.toLowerCase()}...`;
      case 'email':
        return 'user@example.com';
      case 'url':
        return 'https://example.com';
      case 'number':
        return 'Enter a number';
      case 'date':
        return 'Select a date';
      case 'select':
        return `Select ${field.label.toLowerCase()}`;
      case 'multiselect':
        return `Select ${field.label.toLowerCase()}`;
      default:
        return `Enter ${field.label.toLowerCase()}`;
    }
  }

  private generateTableColumns(contentType: ContentType): TableColumnConfig[] {
    const columns: TableColumnConfig[] = [];

    // Add ID column first
    columns.push({
      key: 'id',
      label: 'ID',
      type: 'text',
      sortable: true,
      width: '80px',
    });

    // Add field columns
    for (const field of contentType.fields) {
      const column: TableColumnConfig = {
        key: field.name,
        label: field.label,
        type: this.mapFieldTypeToTableType(field.type),
        sortable: this.isFieldSortable(field.type),
        filterable: this.isFieldFilterable(field.type),
        render: this.getColumnRenderType(field.type),
      };

      // Set column width based on type
      if (field.type === 'boolean') {
        column.width = '100px';
      } else if (field.type === 'date') {
        column.width = '150px';
      } else if (field.type === 'number') {
        column.width = '120px';
      }

      columns.push(column);
    }

    // Add action column
    columns.push({
      key: 'actions',
      label: 'Actions',
      type: 'text',
      sortable: false,
      filterable: false,
      width: '120px',
    });

    return columns;
  }

  private mapFieldTypeToTableType(
    fieldType: string
  ): TableColumnConfig['type'] {
    switch (fieldType) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'date';
      case 'select':
      case 'multiselect':
        return 'badge';
      default:
        return 'text';
    }
  }

  private isFieldSortable(fieldType: string): boolean {
    return ['text', 'number', 'date', 'boolean'].includes(fieldType);
  }

  private isFieldFilterable(fieldType: string): boolean {
    return ['text', 'select', 'boolean', 'date'].includes(fieldType);
  }

  private getColumnRenderType(fieldType: string): TableColumnConfig['render'] {
    switch (fieldType) {
      case 'date':
        return 'date';
      case 'number':
        return 'default';
      case 'boolean':
        return 'badge';
      case 'select':
      case 'multiselect':
        return 'badge';
      case 'url':
        return 'link';
      default:
        return 'default';
    }
  }

  private generateValidationRules(contentType: ContentType): ValidationRule[] {
    const rules: ValidationRule[] = [];

    for (const field of contentType.fields) {
      if (field.required) {
        rules.push({
          field: field.name,
          type: 'required',
          message: `${field.label} is required`,
        });
      }

      if (field.validation) {
        const validation = field.validation;

        if (validation.min && field.type === 'text') {
          rules.push({
            field: field.name,
            type: 'length',
            params: { min: validation.min },
            message: `${field.label} must be at least ${validation.min} characters`,
          });
        }

        if (validation.max && field.type === 'text') {
          rules.push({
            field: field.name,
            type: 'length',
            params: { max: validation.max },
            message: `${field.label} must be no more than ${validation.max} characters`,
          });
        }

        if (validation.pattern) {
          rules.push({
            field: field.name,
            type: 'pattern',
            params: { pattern: validation.pattern },
            message: `${field.label} format is invalid`,
          });
        }

        if (field.type === 'email') {
          rules.push({
            field: field.name,
            type: 'email',
            message: `${field.label} must be a valid email address`,
          });
        }

        if (field.type === 'url') {
          rules.push({
            field: field.name,
            type: 'url',
            message: `${field.label} must be a valid URL`,
          });
        }

        if (field.type === 'number') {
          rules.push({
            field: field.name,
            type: 'numeric',
            message: `${field.label} must be a valid number`,
          });

          if (validation.min) {
            rules.push({
              field: field.name,
              type: 'numeric',
              params: { min: validation.min },
              message: `${field.label} must be at least ${validation.min}`,
            });
          }

          if (validation.max) {
            rules.push({
              field: field.name,
              type: 'numeric',
              params: { max: validation.max },
              message: `${field.label} must be no more than ${validation.max}`,
            });
          }
        }
      }
    }

    return rules;
  }

  generateTypescriptInterface(contentType: ContentType): string {
    const interfaceName = this.toPascalCase(contentType.name);
    const fields = contentType.fields
      .map((field) => {
        const tsType = this.mapFieldTypeToTypescript(field);
        const optional = field.required ? '' : '?';
        return `  ${field.name}${optional}: ${tsType};`;
      })
      .join('\n');

    return `export interface ${interfaceName} {
  id: string;
${fields}
  createdAt: Date;
  updatedAt: Date;
}`;
  }

  private mapFieldTypeToTypescript(field: ContentField): string {
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'url':
      case 'email':
      case 'file':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'Date';
      case 'select':
        if (field.validation?.options) {
          const options = field.validation.options
            .map((opt) => `'${opt}'`)
            .join(' | ');
          return options;
        }
        return 'string';
      case 'multiselect':
        if (field.validation?.options) {
          const options = field.validation.options
            .map((opt) => `'${opt}'`)
            .join(' | ');
          return `(${options})[]`;
        }
        return 'string[]';
      default:
        return 'string';
    }
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  }

  getAllSchemas(): Record<string, GeneratedSchema> {
    const contentTypes = pluginRegistry.getContentTypes();
    const schemas: Record<string, GeneratedSchema> = {};

    for (const contentType of contentTypes) {
      const schema = this.generateSchema(contentType.id);
      if (schema) {
        schemas[contentType.id] = schema;
      }
    }

    return schemas;
  }

  validateData(
    contentTypeId: string,
    data: Record<string, unknown>
  ): { valid: boolean; errors: Record<string, string[]> } {
    const schema = this.generateSchema(contentTypeId);
    if (!schema) {
      return { valid: false, errors: { general: ['Content type not found'] } };
    }

    try {
      schema.zodSchema.parse(data);
      return { valid: true, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const field = issue.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(issue.message);
        }
        return { valid: false, errors };
      }
      return { valid: false, errors: { general: ['Validation failed'] } };
    }
  }
}

export const schemaGenerator = SchemaGenerator.getInstance();
