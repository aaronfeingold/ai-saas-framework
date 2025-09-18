import { z } from 'zod';
import { db } from '@/lib/db/postgres';
import { eq, and, desc } from 'drizzle-orm';
import {
  emailTemplates,
  emailTemplateVersions,
  type SelectEmailTemplate,
  type SelectEmailTemplateVersion,
  type InsertEmailTemplate,
  type InsertEmailTemplateVersion
} from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

// Template variable schema
export const TemplateVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'date', 'url']),
  required: z.boolean().default(false),
  description: z.string().optional(),
  defaultValue: z.any().optional(),
});

export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;

// Template creation schema
export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  category: z.enum(['transactional', 'marketing', 'system']).default('transactional'),
  subject: z.string().min(1, 'Subject is required'),
  htmlContent: z.string().min(1, 'HTML content is required'),
  textContent: z.string().optional(),
  variables: z.array(TemplateVariableSchema).default([]),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  changeNote: z.string().optional(),
});

export type CreateTemplateData = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateData = z.infer<typeof UpdateTemplateSchema>;

export class TemplateService {
  /**
   * Create a new email template
   */
  static async createTemplate(data: CreateTemplateData): Promise<SelectEmailTemplate> {
    const user = await getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate the data
    const validatedData = CreateTemplateSchema.parse(data);

    // Check if template name already exists
    const existing = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.name, validatedData.name))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Template with name "${validatedData.name}" already exists`);
    }

    // Create the template
    const [template] = await db
      .insert(emailTemplates)
      .values({
        ...validatedData,
        variables: validatedData.variables,
        createdBy: user.id,
      })
      .returning();

    // Create the initial version
    await db.insert(emailTemplateVersions).values({
      templateId: template.id,
      version: 1,
      subject: validatedData.subject,
      htmlContent: validatedData.htmlContent,
      textContent: validatedData.textContent,
      variables: validatedData.variables,
      changeNote: 'Initial version',
      createdBy: user.id,
    });

    return template;
  }

  /**
   * Update an existing template
   */
  static async updateTemplate(
    templateId: string,
    data: UpdateTemplateData
  ): Promise<SelectEmailTemplate> {
    const user = await getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate the data
    const validatedData = UpdateTemplateSchema.parse(data);

    // Get the current template
    const [currentTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1);

    if (!currentTemplate) {
      throw new Error('Template not found');
    }

    if (currentTemplate.isSystem) {
      throw new Error('Cannot update system templates');
    }

    // Check for name conflicts if name is being updated
    if (validatedData.name && validatedData.name !== currentTemplate.name) {
      const existing = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.name, validatedData.name))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(`Template with name "${validatedData.name}" already exists`);
      }
    }

    // Update the template
    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set({
        ...validatedData,
        version: currentTemplate.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, templateId))
      .returning();

    // Create a new version if content changed
    const contentChanged =
      validatedData.subject !== undefined ||
      validatedData.htmlContent !== undefined ||
      validatedData.textContent !== undefined ||
      validatedData.variables !== undefined;

    if (contentChanged) {
      await db.insert(emailTemplateVersions).values({
        templateId: templateId,
        version: updatedTemplate.version,
        subject: validatedData.subject || currentTemplate.subject,
        htmlContent: validatedData.htmlContent || currentTemplate.htmlContent,
        textContent: validatedData.textContent || currentTemplate.textContent,
        variables: validatedData.variables || currentTemplate.variables,
        changeNote: validatedData.changeNote || 'Template updated',
        createdBy: user.id,
      });
    }

    return updatedTemplate;
  }

  /**
   * Get all templates with optional filtering
   */
  static async getTemplates(options: {
    category?: string;
    active?: boolean;
    includeSystem?: boolean;
  } = {}): Promise<SelectEmailTemplate[]> {
    let query = db.select().from(emailTemplates);

    const conditions = [];

    if (options.category) {
      conditions.push(eq(emailTemplates.category, options.category));
    }

    if (options.active !== undefined) {
      conditions.push(eq(emailTemplates.isActive, options.active));
    }

    if (!options.includeSystem) {
      conditions.push(eq(emailTemplates.isSystem, false));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(emailTemplates.updatedAt));
  }

  /**
   * Get a template by ID or name
   */
  static async getTemplate(
    identifier: string,
    byName = false
  ): Promise<SelectEmailTemplate | null> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(
        byName
          ? eq(emailTemplates.name, identifier)
          : eq(emailTemplates.id, identifier)
      )
      .limit(1);

    return template || null;
  }

  /**
   * Get template versions
   */
  static async getTemplateVersions(templateId: string): Promise<SelectEmailTemplateVersion[]> {
    return await db
      .select()
      .from(emailTemplateVersions)
      .where(eq(emailTemplateVersions.templateId, templateId))
      .orderBy(desc(emailTemplateVersions.version));
  }

  /**
   * Get a specific template version
   */
  static async getTemplateVersion(
    templateId: string,
    version: number
  ): Promise<SelectEmailTemplateVersion | null> {
    const [templateVersion] = await db
      .select()
      .from(emailTemplateVersions)
      .where(and(
        eq(emailTemplateVersions.templateId, templateId),
        eq(emailTemplateVersions.version, version)
      ))
      .limit(1);

    return templateVersion || null;
  }

  /**
   * Delete a template (only non-system templates)
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1);

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.isSystem) {
      throw new Error('Cannot delete system templates');
    }

    await db
      .delete(emailTemplates)
      .where(eq(emailTemplates.id, templateId));
  }

  /**
   * Toggle template active status
   */
  static async toggleTemplateStatus(templateId: string): Promise<SelectEmailTemplate> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1);

    if (!template) {
      throw new Error('Template not found');
    }

    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set({
        isActive: !template.isActive,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, templateId))
      .returning();

    return updatedTemplate;
  }

  /**
   * Restore a template to a specific version
   */
  static async restoreTemplateVersion(
    templateId: string,
    version: number,
    changeNote?: string
  ): Promise<SelectEmailTemplate> {
    const user = await getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get the template and version
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1);

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.isSystem) {
      throw new Error('Cannot restore system templates');
    }

    const [templateVersion] = await db
      .select()
      .from(emailTemplateVersions)
      .where(and(
        eq(emailTemplateVersions.templateId, templateId),
        eq(emailTemplateVersions.version, version)
      ))
      .limit(1);

    if (!templateVersion) {
      throw new Error('Template version not found');
    }

    // Update the template with the version content
    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set({
        subject: templateVersion.subject,
        htmlContent: templateVersion.htmlContent,
        textContent: templateVersion.textContent,
        variables: templateVersion.variables,
        version: template.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, templateId))
      .returning();

    // Create a new version entry
    await db.insert(emailTemplateVersions).values({
      templateId: templateId,
      version: updatedTemplate.version,
      subject: templateVersion.subject,
      htmlContent: templateVersion.htmlContent,
      textContent: templateVersion.textContent,
      variables: templateVersion.variables,
      changeNote: changeNote || `Restored to version ${version}`,
      createdBy: user.id,
    });

    return updatedTemplate;
  }

  /**
   * Get template statistics
   */
  static async getTemplateStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    categories: Record<string, number>;
  }> {
    const templates = await db.select().from(emailTemplates);

    const stats = {
      total: templates.length,
      active: templates.filter(t => t.isActive).length,
      inactive: templates.filter(t => !t.isActive).length,
      categories: {} as Record<string, number>,
    };

    // Count by category
    templates.forEach(template => {
      const category = template.category || 'uncategorized';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    });

    return stats;
  }

  /**
   * Validate template variables against provided data
   */
  static validateTemplateVariables(
    templateVariables: TemplateVariable[],
    providedData: Record<string, any>
  ): { isValid: boolean; errors: string[]; missingRequired: string[] } {
    const errors: string[] = [];
    const missingRequired: string[] = [];

    templateVariables.forEach(variable => {
      const value = providedData[variable.name];

      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        missingRequired.push(variable.name);
        return;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        return;
      }

      // Type validation
      switch (variable.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Variable '${variable.name}' must be a string`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`Variable '${variable.name}' must be a number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Variable '${variable.name}' must be a boolean`);
          }
          break;
        case 'date':
          if (!(value instanceof Date) && !Date.parse(value)) {
            errors.push(`Variable '${variable.name}' must be a valid date`);
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push(`Variable '${variable.name}' must be a valid URL`);
          }
          break;
      }
    });

    return {
      isValid: errors.length === 0 && missingRequired.length === 0,
      errors,
      missingRequired,
    };
  }
}
