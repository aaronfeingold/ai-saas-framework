'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type FormFieldConfig,
  type GeneratedSchema,
  schemaGenerator,
} from '@/lib/schema-generator';
import { cn } from '@/lib/utils';

interface DynamicFormProps {
  contentTypeId: string;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function DynamicForm({
  contentTypeId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save',
}: DynamicFormProps) {
  const [schema, setSchema] = useState<GeneratedSchema | null>(null);
  const [multiSelectValues, setMultiSelectValues] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    const generatedSchema = schemaGenerator.generateSchema(contentTypeId);
    setSchema(generatedSchema);

    // Initialize multi-select values
    if (generatedSchema && initialData) {
      const multiSelectFields = generatedSchema.formSchema.filter(
        (field) => field.type === 'multiselect'
      );
      const values: Record<string, string[]> = {};
      for (const field of multiSelectFields) {
        values[field.name] = initialData[field.name] || [];
      }
      setMultiSelectValues(values);
    }
  }, [contentTypeId, initialData]);

  const form = useForm({
    resolver: schema ? zodResolver(schema.zodSchema) : undefined,
    defaultValues: initialData || {},
  });

  if (!schema) {
    return <div>Loading form...</div>;
  }

  const handleMultiSelectChange = (
    fieldName: string,
    value: string,
    checked: boolean
  ) => {
    setMultiSelectValues((prev) => {
      const current = prev[fieldName] || [];
      const updated = checked
        ? [...current, value]
        : current.filter((v) => v !== value);

      form.setValue(fieldName, updated);
      return { ...prev, [fieldName]: updated };
    });
  };

  const renderField = (field: FormFieldConfig) => {
    return (
      <FormField
        key={field.name}
        control={form.control}
        name={field.name}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel>{field.label}</FormLabel>
            <FormControl>{renderFieldInput(field, formField)}</FormControl>
            {field.description && (
              <FormDescription>{field.description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  const renderFieldInput = (
    field: FormFieldConfig,
    formField: { value: unknown; onChange: (value: unknown) => void }
  ) => {
    switch (field.type) {
      case 'input':
        return (
          <Input
            {...formField}
            placeholder={field.placeholder}
            type={getInputType(field)}
            disabled={isLoading}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...formField}
            placeholder={field.placeholder}
            disabled={isLoading}
            className="min-h-[100px]"
          />
        );

      case 'select':
        return (
          <Select
            onValueChange={formField.onChange}
            defaultValue={formField.value}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="space-y-3">
            <div className="grid gap-2">
              {field.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.name}-${option.value}`}
                    checked={(multiSelectValues[field.name] || []).includes(
                      option.value
                    )}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange(
                        field.name,
                        option.value,
                        !!checked
                      )
                    }
                    disabled={isLoading}
                  />
                  <label
                    htmlFor={`${field.name}-${option.value}`}
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            {(multiSelectValues[field.name] || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(multiSelectValues[field.name] || []).map((value) => (
                  <Badge key={value} variant="secondary" className="gap-1">
                    {field.options?.find((opt) => opt.value === value)?.label ||
                      value}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() =>
                        handleMultiSelectChange(field.name, value, false)
                      }
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formField.value}
              onCheckedChange={formField.onChange}
              disabled={isLoading}
            />
            <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {field.label}
            </label>
          </div>
        );

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !formField.value && 'text-muted-foreground'
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formField.value ? (
                  new Date(formField.value).toLocaleDateString()
                ) : (
                  <span>{field.placeholder}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={
                  formField.value ? new Date(formField.value) : undefined
                }
                onSelect={(date) => formField.onChange(date?.toISOString())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case 'file':
        return (
          <Input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // In a real app, you'd upload the file and get a URL
                formField.onChange(file.name);
              }
            }}
            disabled={isLoading}
          />
        );

      default:
        return (
          <Input
            {...formField}
            placeholder={field.placeholder}
            disabled={isLoading}
          />
        );
    }
  };

  const getInputType = (field: FormFieldConfig): string => {
    if (field.name.includes('email')) return 'email';
    if (field.name.includes('url') || field.name.includes('website'))
      return 'url';
    if (field.name.includes('phone')) return 'tel';
    if (field.name.includes('password')) return 'password';
    if (field.validation?.pattern?.includes('\\d')) return 'number';
    return 'text';
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {schema.formSchema.map(renderField)}
        </div>

        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
