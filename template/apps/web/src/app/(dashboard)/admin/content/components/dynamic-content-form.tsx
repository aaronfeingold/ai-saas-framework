'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  ContentType,
  CreateContent,
  FieldDefinition,
} from '@/lib/content/types';

interface DynamicContentFormProps {
  contentType: ContentType;
  initialData?: Partial<CreateContent>;
  mode?: 'create' | 'edit';
  onSave?: (data: unknown) => void;
}

export function DynamicContentForm({
  contentType,
  initialData,
  mode = 'create',
  onSave,
}: DynamicContentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create dynamic validation schema based on content type fields
  const formSchema = createDynamicSchema(contentType.fields);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(contentType.fields, initialData),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    try {
      const contentData = {
        content_type_id: contentType.id,
        data: values,
        status: 'draft' as const,
      };

      const url =
        mode === 'create'
          ? `/api/content/${contentType.slug}`
          : `/api/content/${contentType.slug}/${initialData?.id}`;

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          `${contentType.name} ${mode === 'create' ? 'created' : 'updated'} successfully`
        );

        if (onSave) {
          onSave(result);
        } else {
          router.push(`/admin/content/${contentType.slug}`);
        }
      } else {
        throw new Error('Failed to save content');
      }
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error(`Failed to ${mode} ${contentType.name.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6">
          {contentType.fields
            .sort((a, b) => a.order - b.order)
            .map((field) => (
              <DynamicFormField key={field.id} field={field} form={form} />
            ))}
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Create'
                : 'Update'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface DynamicFormFieldProps {
  field: FieldDefinition;
  form: {
    control: unknown;
  };
}

function DynamicFormField({ field, form }: DynamicFormFieldProps) {
  return (
    <FormField
      control={form.control}
      name={field.id}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1">
            {field.label}
            {field.validation.required && (
              <span className="text-destructive">*</span>
            )}
          </FormLabel>

          <FormControl>{renderFieldControl(field, formField)}</FormControl>

          {field.description && (
            <FormDescription>{field.description}</FormDescription>
          )}

          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function renderFieldControl(
  field: FieldDefinition,
  formField: {
    value: unknown;
    onChange: (value: unknown) => void;
  }
) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return (
        <Input
          type={field.type === 'text' ? 'text' : field.type}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          {...formField}
        />
      );

    case 'textarea':
      return (
        <Textarea
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="min-h-[100px]"
          {...formField}
        />
      );

    case 'rich_text':
      return (
        <RichTextEditor
          value={formField.value as string}
          onChange={formField.onChange}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          minHeight={200}
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          min={field.validation.min_value}
          max={field.validation.max_value}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          {...formField}
          onChange={(e) => formField.onChange(Number(e.target.value) || '')}
        />
      );

    case 'date':
      return <Input type="date" {...formField} />;

    case 'datetime':
      return <Input type="datetime-local" {...formField} />;

    case 'boolean':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={formField.value}
            onCheckedChange={formField.onChange}
          />
          <span className="text-sm">Yes</span>
        </div>
      );

    case 'select':
      return (
        <Select
          onValueChange={formField.onChange}
          defaultValue={formField.value}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.validation.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'multi_select':
      return (
        <div className="space-y-2">
          {field.validation.options?.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                checked={
                  Array.isArray(formField.value) &&
                  formField.value.includes(option)
                }
                onCheckedChange={(checked) => {
                  const currentValue = Array.isArray(formField.value)
                    ? formField.value
                    : [];
                  if (checked) {
                    formField.onChange([...currentValue, option]);
                  } else {
                    formField.onChange(
                      currentValue.filter((v) => v !== option)
                    );
                  }
                }}
              />
              <span className="text-sm">{option}</span>
            </div>
          ))}
        </div>
      );

    case 'tags':
      return (
        <Input
          placeholder="Enter tags separated by commas"
          {...formField}
          onChange={(e) => {
            const tags = e.target.value
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean);
            formField.onChange(tags);
          }}
        />
      );

    case 'file':
    case 'image':
      return <FileUploadField field={field} formField={formField} />;

    case 'json':
      return (
        <Textarea
          placeholder="Enter JSON data"
          className="min-h-[100px] font-mono"
          {...formField}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              formField.onChange(parsed);
            } catch {
              formField.onChange(e.target.value);
            }
          }}
        />
      );

    case 'relation':
      return <RelationField field={field} formField={formField} />;

    default:
      return (
        <Input
          placeholder={`Enter ${field.label.toLowerCase()}`}
          {...formField}
        />
      );
  }
}

function createDynamicSchema(fields: FieldDefinition[]) {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'rich_text':
      case 'email':
      case 'url':
      case 'phone':
        fieldSchema = z.string();
        if (field.validation.min_length) {
          fieldSchema = fieldSchema.min(field.validation.min_length);
        }
        if (field.validation.max_length) {
          fieldSchema = fieldSchema.max(field.validation.max_length);
        }
        if (field.validation.pattern) {
          fieldSchema = fieldSchema.regex(new RegExp(field.validation.pattern));
        }
        break;

      case 'number':
        fieldSchema = z.number();
        if (field.validation.min_value !== undefined) {
          fieldSchema = fieldSchema.min(field.validation.min_value);
        }
        if (field.validation.max_value !== undefined) {
          fieldSchema = fieldSchema.max(field.validation.max_value);
        }
        break;

      case 'boolean':
        fieldSchema = z.boolean();
        break;

      case 'date':
      case 'datetime':
        fieldSchema = z.string();
        break;

      case 'select':
        if (field.validation.options) {
          fieldSchema = z.enum(
            field.validation.options as [string, ...string[]]
          );
        } else {
          fieldSchema = z.string();
        }
        break;

      case 'multi_select':
      case 'tags':
        fieldSchema = z.array(z.string());
        break;

      case 'json':
        fieldSchema = z.unknown();
        break;

      case 'relation':
        if (field.validation.relation_multiple) {
          fieldSchema = z.array(z.string().uuid());
        } else {
          fieldSchema = z.string().uuid();
        }
        break;

      case 'file':
      case 'image':
        fieldSchema = z.string().url().or(z.string().min(1));
        break;

      default:
        fieldSchema = z.string();
    }

    if (!field.validation.required) {
      fieldSchema = fieldSchema.optional();
    }

    schemaFields[field.id] = fieldSchema;
  });

  return z.object(schemaFields);
}

function getDefaultValues(
  fields: FieldDefinition[],
  initialData?: Partial<CreateContent>
) {
  const defaults: Record<string, unknown> = {};

  fields.forEach((field) => {
    if (initialData?.data && field.id in initialData.data) {
      defaults[field.id] = initialData.data[field.id];
    } else if (field.default_value !== undefined) {
      defaults[field.id] = field.default_value;
    } else {
      switch (field.type) {
        case 'boolean':
          defaults[field.id] = false;
          break;
        case 'number':
          defaults[field.id] = '';
          break;
        case 'multi_select':
        case 'tags':
          defaults[field.id] = [];
          break;
        case 'json':
          defaults[field.id] = {};
          break;
        default:
          defaults[field.id] = '';
      }
    }
  });

  return defaults;
}

// RelationField component for handling content relationships
function RelationField({
  field,
  formField,
}: {
  field: FieldDefinition;
  formField: {
    value: unknown;
    onChange: (value: unknown) => void;
  };
}) {
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (field.validation.relation_to) {
      fetchRelationOptions(field.validation.relation_to);
    }
  }, [field.validation.relation_to]);

  const fetchRelationOptions = async (contentTypeSlug: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content/${contentTypeSlug}`);
      if (response.ok) {
        const data = await response.json();
        const mappedOptions =
          data.data?.map(
            (item: {
              id: string;
              data?: { title?: string; name?: string };
            }) => ({
              id: item.id,
              label: item.data?.title || item.data?.name || item.id,
            })
          ) || [];
        setOptions(mappedOptions);
      }
    } catch (error) {
      console.error('Error fetching relation options:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm">Loading options...</div>
    );
  }

  if (field.validation.relation_multiple) {
    // Multiple selection
    const selectedIds = Array.isArray(formField.value) ? formField.value : [];

    return (
      <div className="space-y-2">
        <Select
          onValueChange={(value) => {
            if (!selectedIds.includes(value)) {
              formField.onChange([...selectedIds, value]);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options
              .filter((option) => !selectedIds.includes(option.id))
              .map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id: string) => {
              const option = options.find((opt) => opt.id === id);
              return (
                <div
                  key={id}
                  className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-sm"
                >
                  {option?.label || id}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      formField.onChange(
                        selectedIds.filter(
                          (selectedId: string) => selectedId !== id
                        )
                      );
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  } else {
    // Single selection
    return (
      <Select
        onValueChange={formField.onChange}
        defaultValue={formField.value as string}
      >
        <SelectTrigger>
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
}

// Enhanced file upload component
function FileUploadField({
  field,
  formField,
}: {
  field: FieldDefinition;
  formField: {
    value: unknown;
    onChange: (value: unknown) => void;
  };
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      // Create a FormData object for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fieldType', field.type);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        formField.onChange(result.url || result.filename);

        // Set preview for images
        if (field.type === 'image' && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => setPreview(e.target?.result as string);
          reader.readAsDataURL(file);
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex w-full items-center justify-center">
        <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="mb-4 h-8 w-8 text-gray-500" />
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            {field.validation.file_types && (
              <p className="text-xs text-gray-500">
                {field.validation.file_types.join(', ').toUpperCase()}
              </p>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept={
              field.type === 'image'
                ? 'image/*'
                : field.validation.file_types
                    ?.map((type) => `.${type}`)
                    .join(',')
            }
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // Validate file size
                if (
                  field.validation.max_file_size &&
                  file.size > field.validation.max_file_size * 1024 * 1024
                ) {
                  toast.error(
                    `File size must be less than ${field.validation.max_file_size}MB`
                  );
                  return;
                }
                handleFileUpload(file);
              }
            }}
            disabled={uploading}
          />
        </label>
      </div>

      {uploading && (
        <div className="text-muted-foreground text-sm">Uploading...</div>
      )}

      {formField.value && (
        <div className="bg-muted flex items-center gap-2 rounded p-2">
          <span className="flex-1 truncate text-sm">
            {formField.value as string}
          </span>
          <X
            className="h-4 w-4 cursor-pointer"
            onClick={() => {
              formField.onChange('');
              setPreview(null);
            }}
          />
        </div>
      )}

      {preview && field.type === 'image' && (
        <div className="mt-2">
          <Image
            src={preview}
            alt="Preview"
            width={128}
            height={128}
            className="max-h-32 max-w-32 rounded object-cover"
          />
        </div>
      )}
    </div>
  );
}
