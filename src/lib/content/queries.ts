import { type SQL, and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import {
  type Content,
  type ContentRelationship,
  type ContentType,
  type InsertContent,
  type InsertContentRelationship,
  type InsertContentType,
  contentRelationships,
  contentTypes,
  contents,
} from '@/lib/db/schema';

import type {
  ContentData,
  ContentFilter,
  ContentNotFoundError,
  ContentStatus,
  ContentTypeNotFoundError,
  CreateContent,
  CreateContentType,
  FieldDefinition,
  UpdateContent,
  UpdateContentType,
} from './types';
import { processContentData, validateContentData } from './validation';

// =============================================================================
// CONTENT TYPE OPERATIONS
// =============================================================================

/**
 * Create a new content type
 */
export async function createContentType(
  data: CreateContentType,
  userId: string
): Promise<ContentType> {
  const contentTypeData: InsertContentType = {
    ...data,
    id: nanoid(),
    fields: JSON.stringify(data.fields),
    uiConfig: JSON.stringify(data.ui_config || {}),
    isSystem: data.is_system ? 'true' : 'false',
    createdBy: userId,
  };

  const [result] = await db
    .insert(contentTypes)
    .values(contentTypeData)
    .returning();

  return transformContentTypeFromDb(result);
}

/**
 * Get all content types
 */
export async function getContentTypes(userId?: string): Promise<ContentType[]> {
  let query = db.select().from(contentTypes);

  if (userId) {
    query = query.where(
      or(eq(contentTypes.createdBy, userId), eq(contentTypes.isSystem, 'true'))
    );
  }

  const results = await query.orderBy(desc(contentTypes.createdAt));

  return results.map(transformContentTypeFromDb);
}

/**
 * Get a content type by ID
 */
export async function getContentTypeById(
  id: string
): Promise<ContentType | null> {
  const [result] = await db
    .select()
    .from(contentTypes)
    .where(eq(contentTypes.id, id))
    .limit(1);

  return result ? transformContentTypeFromDb(result) : null;
}

/**
 * Get a content type by slug
 */
export async function getContentTypeBySlug(
  slug: string
): Promise<ContentType | null> {
  const [result] = await db
    .select()
    .from(contentTypes)
    .where(eq(contentTypes.slug, slug))
    .limit(1);

  return result ? transformContentTypeFromDb(result) : null;
}

/**
 * Update a content type
 */
export async function updateContentType(
  id: string,
  data: Partial<UpdateContentType>,
  userId: string
): Promise<ContentType> {
  const updateData: Partial<InsertContentType> = {
    ...data,
    fields: data.fields ? JSON.stringify(data.fields) : undefined,
    uiConfig: data.ui_config ? JSON.stringify(data.ui_config) : undefined,
    isSystem:
      data.is_system !== undefined
        ? data.is_system
          ? 'true'
          : 'false'
        : undefined,
    updatedAt: new Date(),
  };

  const [result] = await db
    .update(contentTypes)
    .set(updateData)
    .where(and(eq(contentTypes.id, id), eq(contentTypes.createdBy, userId)))
    .returning();

  if (!result) {
    throw new ContentTypeNotFoundError(id);
  }

  return transformContentTypeFromDb(result);
}

/**
 * Delete a content type and all its content
 */
export async function deleteContentType(
  id: string,
  userId: string
): Promise<void> {
  const result = await db
    .delete(contentTypes)
    .where(
      and(
        eq(contentTypes.id, id),
        eq(contentTypes.createdBy, userId),
        eq(contentTypes.isSystem, 'false') // Cannot delete system content types
      )
    )
    .returning();

  if (!result.length) {
    throw new ContentTypeNotFoundError(id);
  }
}

// =============================================================================
// CONTENT OPERATIONS
// =============================================================================

/**
 * Create new content
 */
export async function createContent(
  contentTypeId: string,
  data: CreateContent,
  userId: string
): Promise<Content> {
  // Get content type to validate against
  const contentType = await getContentTypeById(contentTypeId);
  if (!contentType) {
    throw new ContentTypeNotFoundError(contentTypeId);
  }

  // Process and validate content data
  const processedData = processContentData(data.data, contentType.fields);
  const validation = await validateContentData(
    processedData,
    contentType.fields
  );

  if (!validation.success) {
    throw new Error(
      `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
    );
  }

  // Generate slug if not provided
  const slug = data.slug || generateSlug(processedData, contentType.fields);

  const contentData: InsertContent = {
    id: nanoid(),
    contentTypeId,
    slug,
    data: JSON.stringify(validation.data),
    metadata: JSON.stringify(data.metadata || {}),
    status: data.status || 'draft',
    publishedAt: data.status === 'published' ? new Date() : null,
    createdBy: userId,
  };

  const [result] = await db.insert(contents).values(contentData).returning();

  // Handle relationships
  if (result) {
    await createContentRelationships(
      result.id,
      validation.data,
      contentType.fields
    );
  }

  return transformContentFromDb(result);
}

/**
 * Get content with filtering and pagination
 */
export async function getContents(filter: ContentFilter): Promise<{
  contents: Content[];
  total: number;
}> {
  let query = db.select().from(contents);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(contents);

  // Build WHERE conditions
  const conditions: SQL[] = [];

  if (filter.content_type_id) {
    conditions.push(eq(contents.contentTypeId, filter.content_type_id));
  }

  if (filter.status) {
    conditions.push(eq(contents.status, filter.status));
  }

  if (filter.created_by) {
    conditions.push(eq(contents.createdBy, filter.created_by));
  }

  if (filter.featured !== undefined) {
    conditions.push(
      sql`(${contents.metadata}->>'featured')::boolean = ${filter.featured}`
    );
  }

  if (filter.tags?.length) {
    conditions.push(
      sql`${contents.metadata}->>'tags' ? ${JSON.stringify(filter.tags)}`
    );
  }

  if (filter.date_from) {
    conditions.push(sql`${contents.createdAt} >= ${filter.date_from}`);
  }

  if (filter.date_to) {
    conditions.push(sql`${contents.createdAt} <= ${filter.date_to}`);
  }

  // Search functionality
  if (filter.search) {
    // This is a basic search - can be enhanced with full-text search
    conditions.push(
      or(
        sql`${contents.data}::text ILIKE ${'%' + filter.search + '%'}`,
        sql`${contents.metadata}::text ILIKE ${'%' + filter.search + '%'}`
      )
    );
  }

  // Apply WHERE conditions
  if (conditions.length > 0) {
    const whereClause =
      conditions.length === 1 ? conditions[0] : and(...conditions);
    query = query.where(whereClause);
    countQuery = countQuery.where(whereClause);
  }

  // Get total count
  const [{ count: total }] = await countQuery;

  // Apply sorting
  const sortField = filter.sort_by || 'createdAt';
  const sortDirection = filter.sort_direction || 'desc';

  if (sortDirection === 'desc') {
    query = query.orderBy(
      desc(contents[sortField as keyof typeof contents] || contents.createdAt)
    );
  } else {
    query = query.orderBy(
      contents[sortField as keyof typeof contents] || contents.createdAt
    );
  }

  // Apply pagination
  query = query.limit(filter.limit).offset(filter.offset);

  const results = await query;

  return {
    contents: results.map(transformContentFromDb),
    total,
  };
}

/**
 * Get content by ID
 */
export async function getContentById(id: string): Promise<Content | null> {
  const [result] = await db
    .select()
    .from(contents)
    .where(eq(contents.id, id))
    .limit(1);

  return result ? transformContentFromDb(result) : null;
}

/**
 * Get content by slug and content type
 */
export async function getContentBySlug(
  contentTypeSlug: string,
  slug: string
): Promise<Content | null> {
  const [result] = await db
    .select({
      content: contents,
    })
    .from(contents)
    .innerJoin(contentTypes, eq(contents.contentTypeId, contentTypes.id))
    .where(and(eq(contentTypes.slug, contentTypeSlug), eq(contents.slug, slug)))
    .limit(1);

  return result ? transformContentFromDb(result.content) : null;
}

/**
 * Update content
 */
export async function updateContent(
  id: string,
  data: Partial<UpdateContent>,
  userId: string
): Promise<Content> {
  const existingContent = await getContentById(id);
  if (!existingContent) {
    throw new ContentNotFoundError(id);
  }

  const contentType = await getContentTypeById(existingContent.content_type_id);
  if (!contentType) {
    throw new ContentTypeNotFoundError(existingContent.content_type_id);
  }

  let processedData = existingContent.data;

  // Process and validate new data if provided
  if (data.data) {
    processedData = { ...existingContent.data, ...data.data };
    const processed = processContentData(processedData, contentType.fields);
    const validation = await validateContentData(processed, contentType.fields);

    if (!validation.success) {
      throw new Error(
        `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    processedData = validation.data;
  }

  const updateData: Partial<InsertContent> = {
    slug: data.slug,
    data: data.data ? JSON.stringify(processedData) : undefined,
    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    status: data.status,
    publishedAt:
      data.status === 'published'
        ? new Date()
        : data.status === 'draft'
          ? null
          : undefined,
    updatedAt: new Date(),
  };

  const [result] = await db
    .update(contents)
    .set(updateData)
    .where(and(eq(contents.id, id), eq(contents.createdBy, userId)))
    .returning();

  if (!result) {
    throw new ContentNotFoundError(id);
  }

  // Update relationships if data changed
  if (data.data) {
    await deleteContentRelationships(id);
    await createContentRelationships(id, processedData, contentType.fields);
  }

  return transformContentFromDb(result);
}

/**
 * Delete content
 */
export async function deleteContent(id: string, userId: string): Promise<void> {
  const result = await db
    .delete(contents)
    .where(and(eq(contents.id, id), eq(contents.createdBy, userId)))
    .returning();

  if (!result.length) {
    throw new ContentNotFoundError(id);
  }
}

/**
 * Publish content
 */
export async function publishContent(
  id: string,
  userId: string
): Promise<Content> {
  return updateContent(
    id,
    {
      status: 'published',
      published_at: new Date(),
    },
    userId
  );
}

/**
 * Unpublish content
 */
export async function unpublishContent(
  id: string,
  userId: string
): Promise<Content> {
  return updateContent(
    id,
    {
      status: 'draft',
      published_at: null,
    },
    userId
  );
}

// =============================================================================
// RELATIONSHIP OPERATIONS
// =============================================================================

/**
 * Create relationships for content based on relational fields
 */
async function createContentRelationships(
  contentId: string,
  data: ContentData,
  fields: FieldDefinition[]
): Promise<void> {
  const relationFields = fields.filter((f) => f.type === 'relation');

  for (const field of relationFields) {
    const value = data[field.name];
    if (!value) continue;

    const relationshipType = field.validation.relation_multiple
      ? 'has_many'
      : 'belongs_to';
    const relatedIds = Array.isArray(value) ? value : [value];

    for (const relatedId of relatedIds) {
      if (!relatedId) continue;

      const relationshipData: InsertContentRelationship = {
        fromContentId: contentId,
        toContentId: relatedId,
        relationshipType,
        fieldName: field.name,
        metadata: JSON.stringify({}),
      };

      await db.insert(contentRelationships).values(relationshipData);
    }
  }
}

/**
 * Delete all relationships for a content item
 */
async function deleteContentRelationships(contentId: string): Promise<void> {
  await db
    .delete(contentRelationships)
    .where(eq(contentRelationships.fromContentId, contentId));
}

/**
 * Get related content for a content item
 */
export async function getRelatedContent(
  contentId: string,
  fieldName?: string
): Promise<ContentRelationship[]> {
  let query = db
    .select()
    .from(contentRelationships)
    .where(eq(contentRelationships.fromContentId, contentId));

  if (fieldName) {
    query = query.where(eq(contentRelationships.fieldName, fieldName));
  }

  return query;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Transform database content type to API format
 */
function transformContentTypeFromDb(dbContentType: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  fields: string | FieldDefinition[];
  uiConfig: string | Record<string, unknown>;
  isSystem: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): ContentType {
  return {
    ...dbContentType,
    fields:
      typeof dbContentType.fields === 'string'
        ? (JSON.parse(dbContentType.fields) as FieldDefinition[])
        : dbContentType.fields,
    ui_config:
      typeof dbContentType.uiConfig === 'string'
        ? (JSON.parse(dbContentType.uiConfig) as Record<string, unknown>)
        : dbContentType.uiConfig,
    is_system: dbContentType.isSystem === 'true',
    created_by: dbContentType.createdBy,
    created_at: dbContentType.createdAt,
    updated_at: dbContentType.updatedAt,
  };
}

/**
 * Transform database content to API format
 */
function transformContentFromDb(dbContent: {
  id: string;
  contentTypeId: string;
  slug: string | null;
  data: string | ContentData;
  metadata: string | Record<string, unknown>;
  status: ContentStatus;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Content {
  return {
    ...dbContent,
    content_type_id: dbContent.contentTypeId,
    data:
      typeof dbContent.data === 'string'
        ? (JSON.parse(dbContent.data) as ContentData)
        : dbContent.data,
    metadata:
      typeof dbContent.metadata === 'string'
        ? (JSON.parse(dbContent.metadata) as Record<string, unknown>)
        : dbContent.metadata,
    published_at: dbContent.publishedAt,
    created_by: dbContent.createdBy,
    created_at: dbContent.createdAt,
    updated_at: dbContent.updatedAt,
  };
}

/**
 * Generate a URL-friendly slug from content data
 */
function generateSlug(data: ContentData, fields: FieldDefinition[]): string {
  // Try to find a title/name field
  const titleField = fields.find(
    (f) =>
      ['title', 'name', 'headline'].includes(f.name.toLowerCase()) &&
      ['text', 'textarea'].includes(f.type)
  );

  let text = '';

  if (titleField && data[titleField.name]) {
    text = String(data[titleField.name]);
  } else {
    // Fallback to first text field
    const firstTextField = fields.find((f) =>
      ['text', 'textarea'].includes(f.type)
    );
    if (firstTextField && data[firstTextField.name]) {
      text = String(data[firstTextField.name]);
    }
  }

  if (!text) {
    return nanoid(10);
  }

  // Convert to slug
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) || nanoid(10)
  );
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Bulk update content status
 */
export async function bulkUpdateContentStatus(
  contentIds: string[],
  status: ContentStatus,
  userId: string
): Promise<void> {
  await db
    .update(contents)
    .set({
      status,
      publishedAt: status === 'published' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(inArray(contents.id, contentIds), eq(contents.createdBy, userId))
    );
}

/**
 * Bulk delete content
 */
export async function bulkDeleteContent(
  contentIds: string[],
  userId: string
): Promise<void> {
  await db
    .delete(contents)
    .where(
      and(inArray(contents.id, contentIds), eq(contents.createdBy, userId))
    );
}
