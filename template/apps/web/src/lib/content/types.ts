import { z } from 'zod';

// =============================================================================
// FIELD TYPE DEFINITIONS
// =============================================================================

// Base types for better type safety
export type FieldValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | Record<string, unknown>
  | null
  | undefined;
export type ContentData = Record<string, FieldValue>;
export type UIConfig = Record<string, unknown>;
export type MetadataRecord = Record<string, unknown>;

export const FIELD_TYPES = [
  'text',
  'textarea',
  'rich_text',
  'number',
  'date',
  'datetime',
  'boolean',
  'select',
  'multi_select',
  'file',
  'image',
  'url',
  'email',
  'phone',
  'relation',
  'json',
  'tags',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

// Field validation rules
export const fieldValidationSchema = z.object({
  required: z.boolean().default(false),
  min_length: z.number().optional(),
  max_length: z.number().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  pattern: z.string().optional(),
  options: z.array(z.string()).optional(), // For select/multi_select
  file_types: z.array(z.string()).optional(), // For file/image fields
  max_file_size: z.number().optional(), // In MB
  relation_to: z.string().optional(), // Content type ID for relations
  relation_multiple: z.boolean().default(false), // Multiple relations allowed
});

export type FieldValidation = z.infer<typeof fieldValidationSchema>;

// Field definition schema
export const fieldDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(FIELD_TYPES),
  description: z.string().optional(),
  default_value: z.unknown().optional(),
  validation: fieldValidationSchema,
  ui_config: z.record(z.unknown()).default({}), // Field-specific UI configuration
  order: z.number().default(0),
});

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

// =============================================================================
// CONTENT TYPE DEFINITIONS
// =============================================================================

export const CONTENT_STATUS = [
  'draft',
  'published',
  'archived',
  'pending_review',
] as const;
export type ContentStatus = (typeof CONTENT_STATUS)[number];

export const contentTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-_]+$/),
  description: z.string().optional(),
  icon: z.string().optional(),
  fields: z.array(fieldDefinitionSchema).min(1),
  ui_config: z
    .object({
      list_display: z.array(z.string()).default([]), // Field IDs to show in table view
      search_fields: z.array(z.string()).default([]), // Field IDs to include in search
      filter_fields: z.array(z.string()).default([]), // Field IDs to allow filtering by
      sort_field: z.string().optional(), // Default sort field
      sort_direction: z.enum(['asc', 'desc']).default('desc'),
      form_layout: z.record(z.unknown()).default({}), // Form layout configuration
      permissions: z
        .object({
          create: z.array(z.string()).default(['admin']), // Roles that can create
          read: z.array(z.string()).default(['admin', 'user']), // Roles that can read
          update: z.array(z.string()).default(['admin']), // Roles that can update
          delete: z.array(z.string()).default(['admin']), // Roles that can delete
        })
        .default({}),
    })
    .default({}),
  is_system: z.boolean().default(false), // System-defined content types
  created_by: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type ContentType = z.infer<typeof contentTypeSchema>;

// =============================================================================
// CONTENT INSTANCE DEFINITIONS
// =============================================================================

export const contentSchema = z.object({
  id: z.string().uuid(),
  content_type_id: z.string().uuid(),
  slug: z.string().optional(), // Auto-generated from title if not provided
  data: z.record(z.unknown()), // Dynamic field data based on content type
  metadata: z
    .object({
      seo_title: z.string().optional(),
      seo_description: z.string().optional(),
      featured_image: z.string().optional(),
      author: z.string().optional(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
    })
    .default({}),
  status: z.enum(CONTENT_STATUS).default('draft'),
  published_at: z.date().optional(),
  created_by: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type Content = z.infer<typeof contentSchema>;

// =============================================================================
// CONTENT RELATIONSHIPS
// =============================================================================

export const relationshipTypeSchema = z.object({
  from_content_id: z.string().uuid(),
  to_content_id: z.string().uuid(),
  relationship_type: z.string(), // e.g., 'belongs_to', 'has_many', 'many_to_many'
  field_name: z.string(), // The field in the content type that defines this relationship
  metadata: z.record(z.unknown()).default({}), // Additional relationship data
  created_at: z.date(),
});

export type ContentRelationship = z.infer<typeof relationshipTypeSchema>;

// =============================================================================
// VALIDATION & UTILITY TYPES
// =============================================================================

// Content creation/update types
export const createContentSchema = contentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateContentSchema = createContentSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateContent = z.infer<typeof createContentSchema>;
export type UpdateContent = z.infer<typeof updateContentSchema>;

// Content type creation/update types
export const createContentTypeSchema = contentTypeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateContentTypeSchema = createContentTypeSchema
  .partial()
  .extend({
    id: z.string().uuid(),
  });

export type CreateContentType = z.infer<typeof createContentTypeSchema>;
export type UpdateContentType = z.infer<typeof updateContentTypeSchema>;

// =============================================================================
// QUERY & FILTER TYPES
// =============================================================================

export const contentFilterSchema = z.object({
  content_type_id: z.string().uuid().optional(),
  status: z.enum(CONTENT_STATUS).optional(),
  created_by: z.string().uuid().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  date_from: z.date().optional(),
  date_to: z.date().optional(),
  featured: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sort_by: z.string().optional(),
  sort_direction: z.enum(['asc', 'desc']).default('desc'),
});

export type ContentFilter = z.infer<typeof contentFilterSchema>;

// =============================================================================
// FESTIVAL/EVENTS POC TYPES (Example Domain Implementation)
// =============================================================================

export const festivalDomainTypes = {
  EVENT: 'event',
  VENUE: 'venue',
  ARTIST: 'artist',
  SPONSOR: 'sponsor',
  TICKET: 'ticket',
} as const;

export type FestivalDomainType =
  (typeof festivalDomainTypes)[keyof typeof festivalDomainTypes];

// Pre-defined content types for festival domain
export const festivalContentTypes: CreateContentType[] = [
  {
    name: 'Event',
    slug: 'event',
    description: 'Festival events and performances',
    icon: '🎪',
    fields: [
      {
        id: 'title',
        name: 'title',
        label: 'Event Title',
        type: 'text',
        validation: { required: true, max_length: 200 },
        order: 1,
      },
      {
        id: 'description',
        name: 'description',
        label: 'Description',
        type: 'rich_text',
        validation: { required: true },
        order: 2,
      },
      {
        id: 'start_datetime',
        name: 'start_datetime',
        label: 'Start Date & Time',
        type: 'datetime',
        validation: { required: true },
        order: 3,
      },
      {
        id: 'end_datetime',
        name: 'end_datetime',
        label: 'End Date & Time',
        type: 'datetime',
        validation: { required: true },
        order: 4,
      },
      {
        id: 'venue',
        name: 'venue',
        label: 'Venue',
        type: 'relation',
        validation: {
          required: true,
          relation_to: 'venue',
          relation_multiple: false,
        },
        order: 5,
      },
      {
        id: 'artists',
        name: 'artists',
        label: 'Performing Artists',
        type: 'relation',
        validation: {
          relation_to: 'artist',
          relation_multiple: true,
        },
        order: 6,
      },
      {
        id: 'ticket_price',
        name: 'ticket_price',
        label: 'Ticket Price ($)',
        type: 'number',
        validation: { min_value: 0 },
        order: 7,
      },
      {
        id: 'capacity',
        name: 'capacity',
        label: 'Capacity',
        type: 'number',
        validation: { min_value: 1 },
        order: 8,
      },
    ],
    ui_config: {
      list_display: ['title', 'start_datetime', 'venue', 'ticket_price'],
      search_fields: ['title', 'description'],
      filter_fields: ['venue', 'start_datetime', 'ticket_price'],
      sort_field: 'start_datetime',
      sort_direction: 'asc',
    },
    is_system: false,
    created_by: '', // Will be set during creation
  },
  {
    name: 'Venue',
    slug: 'venue',
    description: 'Festival venues and locations',
    icon: '🏟️',
    fields: [
      {
        id: 'name',
        name: 'name',
        label: 'Venue Name',
        type: 'text',
        validation: { required: true, max_length: 200 },
        order: 1,
      },
      {
        id: 'description',
        name: 'description',
        label: 'Description',
        type: 'textarea',
        order: 2,
      },
      {
        id: 'address',
        name: 'address',
        label: 'Address',
        type: 'textarea',
        validation: { required: true },
        order: 3,
      },
      {
        id: 'capacity',
        name: 'capacity',
        label: 'Maximum Capacity',
        type: 'number',
        validation: { required: true, min_value: 1 },
        order: 4,
      },
      {
        id: 'amenities',
        name: 'amenities',
        label: 'Amenities',
        type: 'multi_select',
        validation: {
          options: [
            'Sound System',
            'Lighting',
            'Backstage',
            'VIP Area',
            'Bar',
            'Food Court',
            'Parking',
          ],
        },
        order: 5,
      },
      {
        id: 'website',
        name: 'website',
        label: 'Website',
        type: 'url',
        order: 6,
      },
    ],
    ui_config: {
      list_display: ['name', 'capacity', 'address'],
      search_fields: ['name', 'description', 'address'],
      filter_fields: ['capacity', 'amenities'],
      sort_field: 'name',
    },
    is_system: false,
    created_by: '', // Will be set during creation
  },
  {
    name: 'Artist',
    slug: 'artist',
    description: 'Performing artists and bands',
    icon: '🎤',
    fields: [
      {
        id: 'name',
        name: 'name',
        label: 'Artist/Band Name',
        type: 'text',
        validation: { required: true, max_length: 200 },
        order: 1,
      },
      {
        id: 'bio',
        name: 'bio',
        label: 'Biography',
        type: 'rich_text',
        order: 2,
      },
      {
        id: 'genre',
        name: 'genre',
        label: 'Genre',
        type: 'select',
        validation: {
          options: [
            'Rock',
            'Pop',
            'Hip Hop',
            'Electronic',
            'Jazz',
            'Folk',
            'Classical',
            'Alternative',
            'Indie',
            'Country',
          ],
        },
        order: 3,
      },
      {
        id: 'website',
        name: 'website',
        label: 'Website',
        type: 'url',
        order: 4,
      },
      {
        id: 'social_links',
        name: 'social_links',
        label: 'Social Media Links',
        type: 'json',
        ui_config: {
          fields: ['instagram', 'twitter', 'facebook', 'spotify', 'youtube'],
        },
        order: 5,
      },
      {
        id: 'photo',
        name: 'photo',
        label: 'Artist Photo',
        type: 'image',
        validation: {
          file_types: ['jpg', 'jpeg', 'png', 'webp'],
          max_file_size: 5,
        },
        order: 6,
      },
    ],
    ui_config: {
      list_display: ['name', 'genre'],
      search_fields: ['name', 'bio', 'genre'],
      filter_fields: ['genre'],
      sort_field: 'name',
    },
    is_system: false,
    created_by: '', // Will be set during creation
  },
];

// =============================================================================
// ERROR TYPES
// =============================================================================

export class ContentValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ContentValidationError';
  }
}

export class ContentTypeNotFoundError extends Error {
  constructor(contentTypeId: string) {
    super(`Content type not found: ${contentTypeId}`);
    this.name = 'ContentTypeNotFoundError';
  }
}

export class ContentNotFoundError extends Error {
  constructor(contentId: string) {
    super(`Content not found: ${contentId}`);
    this.name = 'ContentNotFoundError';
  }
}
