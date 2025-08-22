# User Profile & Account Management System

## Overview

A comprehensive user profile and account management system built for the AI SaaS Framework. This system provides a complete set of pages and components for users to manage their personal information, account settings, security preferences, and application preferences.

## Features

### ✅ Implemented

- **Enhanced Database Schema**: Extended user profiles with additional fields
- **Profile Management**: Full name, display name, bio, timezone, avatar
- **Account Settings**: Email management, account deletion
- **Security Features**: Session tracking, security event logging, placeholder for 2FA
- **Preferences**: Theme settings, notification preferences, language/region settings
- **Comprehensive Validation**: Zod schemas for all forms with proper error handling
- **Responsive UI**: Mobile-friendly design with consistent styling
- **Security Logging**: All profile changes are logged for audit trails

### 🚧 Planned/TODO

- **Avatar Upload to Supabase Storage**: Currently simulated, needs real implementation
- **Two-Factor Authentication**: UI is ready, backend implementation needed
- **Email Verification Workflow**: Complete email verification process
- **Real Session Management**: Connect to actual session tracking
- **Notification System**: Backend for email notifications
- **Data Export**: User data export functionality

## Architecture

### Database Schema

#### Enhanced Users Table

```sql
- id (UUID, Primary Key)
- email (TEXT, NOT NULL)
- full_name (TEXT, NOT NULL)
- display_name (TEXT) -- NEW
- bio (TEXT) -- NEW
- avatar_url (TEXT) -- NEW
- timezone (TEXT) -- NEW
- preferences (JSONB) -- NEW
- last_seen_at (TIMESTAMP) -- NEW
- email_verified (BOOLEAN) -- NEW
- two_factor_enabled (BOOLEAN) -- NEW
- profile_completed_at (TIMESTAMP) -- NEW
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### User Sessions Table

```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- session_token (TEXT, Unique)
- device_info (TEXT)
- ip_address (TEXT)
- location (TEXT)
- is_active (BOOLEAN)
- last_active_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

#### Security Events Table

```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- event_type (TEXT)
- event_data (JSONB)
- ip_address (TEXT)
- user_agent (TEXT)
- success (BOOLEAN)
- risk_score (INTEGER)
- created_at (TIMESTAMP)
```

### File Structure

```
src/app/(dashboard)/settings/
├── layout.tsx                     # Main settings layout with sidebar
├── page.tsx                       # Redirects to profile
├── profile/
│   ├── page.tsx                   # Profile management page
│   ├── actions.ts                 # Server actions for profile operations
│   └── components/
│       └── profile-form.tsx       # Profile editing form
├── account/
│   ├── page.tsx                   # Account settings page
│   └── components/
│       ├── email-form.tsx         # Email management
│       └── delete-account-form.tsx
├── security/
│   ├── page.tsx                   # Security settings page
│   └── components/
│       ├── two-factor-setup.tsx   # 2FA management
│       ├── session-manager.tsx    # Active sessions
│       └── security-log.tsx       # Security event history
└── preferences/
    ├── page.tsx                   # User preferences page
    └── components/
        ├── theme-settings.tsx     # Theme preferences
        ├── notification-settings.tsx
        └── language-settings.tsx
```

### Reusable Components

```
src/components/ui/
├── page-header.tsx        # Consistent page titles
├── sidebar-nav.tsx        # Settings navigation
├── settings-card.tsx      # Consistent card layout
├── submit-button.tsx      # Loading state button
├── avatar-upload.tsx      # Image upload with preview
└── form-field.tsx         # Form field wrapper
```

### Validation & Error Handling

```
src/lib/validations/profile.ts     # Zod schemas for all forms
src/lib/utils/form-errors.ts       # Error handling utilities
```

## Usage

### Basic Profile Update

```typescript
import { updateProfile } from '@/app/(dashboard)/settings/profile/actions';

// In a form component
const handleSubmit = async (formData: FormData) => {
  const result = await updateProfile(formData);

  if (result.success) {
    toast.success(result.message);
  } else {
    toast.error(result.error);
  }
};
```

### Using Validation Schemas

```typescript
import { updateProfileSchema } from '@/lib/validations/profile';

const validateProfileData = (data: unknown) => {
  const result = updateProfileSchema.safeParse(data);
  return result.success ? result.data : null;
};
```

### Custom Form with Error Handling

```typescript
import { FormField } from '@/components/ui/form-field';
import { SettingsCard } from '@/components/ui/settings-card';
import { SubmitButton } from '@/components/ui/submit-button';

export function CustomForm() {
  return (
    <SettingsCard
      title="Custom Settings"
      description="Manage your custom settings."
      footer={<SubmitButton>Save Changes</SubmitButton>}
    >
      <FormField
        label="Setting Name"
        description="Description of the setting."
        required
      >
        <Input name="setting_name" required />
      </FormField>
    </SettingsCard>
  );
}
```

## Security Features

### Event Logging

All profile operations are automatically logged:

- Profile updates
- Email changes
- Avatar uploads
- Account deletions
- Failed attempts

### Input Validation

- Client-side validation with Zod schemas
- Server-side validation before database operations
- Comprehensive error messages
- SQL injection protection through Drizzle ORM

### Session Management

- Device tracking
- IP address logging
- Location detection
- Session expiration
- Active session management

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run profile validation tests
npm test -- src/lib/validations/__tests__/profile.test.ts

# Run error handling tests
npm test -- src/lib/utils/__tests__/form-errors.test.ts
```

### Test Coverage

- Validation schema tests
- Error handling utility tests
- Component integration tests (TODO)
- E2E user journey tests (TODO)

## Migration Guide

### Database Migration

Run the migration to add new profile fields:

```bash
# Apply the migration
psql $DATABASE_URL -f src/lib/db/migrations/002_user_profile_enhancements.sql
```

### Existing User Data

The system gracefully handles existing users:

- New fields are optional
- Default values are provided
- Profile completion tracking available

## Customization

### Adding New Profile Fields

1. **Update Database Schema**:

```sql
ALTER TABLE users ADD COLUMN custom_field TEXT;
```

2. **Update Validation Schema**:

```typescript
// In src/lib/validations/profile.ts
export const updateProfileSchema = z.object({
  // ... existing fields
  customField: z.string().optional(),
});
```

3. **Update Form Component**:

```typescript
<FormField label="Custom Field" htmlFor="custom_field">
  <Input id="custom_field" name="custom_field" />
</FormField>
```

### Adding New Settings Pages

1. **Create Page Structure**:

```
src/app/(dashboard)/settings/custom/
├── page.tsx
├── actions.ts
└── components/
    └── custom-form.tsx
```

2. **Update Navigation**:

```typescript
// In src/app/(dashboard)/settings/layout.tsx
const sidebarNavItems = [
  // ... existing items
  {
    title: "Custom Settings",
    href: "/settings/custom",
    icon: <CustomIcon className="h-4 w-4" />,
  },
];
```

## Best Practices

1. **Always validate on both client and server**
2. **Log security-relevant events**
3. **Use consistent error handling patterns**
4. **Follow the existing component structure**
5. **Test new features thoroughly**
6. **Maintain backward compatibility**

## Support

For questions or issues with the user profile system:

1. Check this documentation first
2. Review the test files for usage examples
3. Examine existing components for patterns
4. Follow the established validation and error handling patterns
