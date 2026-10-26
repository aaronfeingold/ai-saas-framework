import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
}

export function FormField({
  label,
  description,
  error,
  required = false,
  children,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className="grid w-full gap-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {description && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}

      {children}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
