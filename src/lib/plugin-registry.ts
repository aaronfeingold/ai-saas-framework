import { z } from 'zod';

export const ContentFieldSchema = z.object({
  name: z.string(),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'boolean',
    'date',
    'select',
    'multiselect',
    'file',
    'url',
    'email',
  ]),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      options: z.array(z.string()).optional(),
    })
    .optional(),
  defaultValue: z.any().optional(),
});

export const ContentTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  category: z.string(),
  fields: z.array(ContentFieldSchema),
  meta: z
    .object({
      createdAt: z.date().default(() => new Date()),
      updatedAt: z.date().default(() => new Date()),
      version: z.string().default('1.0.0'),
    })
    .optional(),
});

export const DomainConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string(),
  contentTypes: z.array(ContentTypeSchema),
  aiPrompts: z.record(
    z.string(),
    z.object({
      system: z.string(),
      user: z.string().optional(),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().default(1000),
    })
  ),
  ui: z
    .object({
      theme: z
        .object({
          primary: z.string(),
          secondary: z.string(),
          accent: z.string(),
        })
        .optional(),
      navigation: z
        .array(
          z.object({
            label: z.string(),
            href: z.string(),
            icon: z.string().optional(),
          })
        )
        .optional(),
      dashboard: z
        .object({
          widgets: z.array(z.string()),
          layout: z.enum(['grid', 'list', 'masonry']).default('grid'),
        })
        .optional(),
    })
    .optional(),
  integrations: z
    .object({
      apis: z
        .array(
          z.object({
            name: z.string(),
            baseUrl: z.string(),
            authType: z.enum(['none', 'bearer', 'apikey', 'oauth']),
            headers: z.record(z.string(), z.string()).optional(),
          })
        )
        .optional(),
      webhooks: z
        .array(
          z.object({
            event: z.string(),
            url: z.string(),
            method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
          })
        )
        .optional(),
    })
    .optional(),
});

export type ContentField = z.infer<typeof ContentFieldSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type DomainConfig = z.infer<typeof DomainConfigSchema>;

export class PluginRegistry {
  private static instance: PluginRegistry;
  private plugins: Map<string, DomainConfig> = new Map();
  private activePlugin: string | null = null;

  private constructor() {}

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  async loadPlugin(config: DomainConfig): Promise<void> {
    try {
      const validatedConfig = DomainConfigSchema.parse(config);
      this.plugins.set(validatedConfig.id, validatedConfig);
      console.log(`Plugin ${validatedConfig.name} loaded successfully`);
    } catch (error) {
      throw new Error(`Failed to load plugin: ${error}`);
    }
  }

  async loadPluginFromFile(filePath: string): Promise<void> {
    try {
      const response = await fetch(filePath);
      const config = await response.json();
      await this.loadPlugin(config);
    } catch (error) {
      throw new Error(`Failed to load plugin from file ${filePath}: ${error}`);
    }
  }

  setActivePlugin(pluginId: string): boolean {
    if (this.plugins.has(pluginId)) {
      this.activePlugin = pluginId;
      localStorage.setItem('activePlugin', pluginId);
      return true;
    }
    return false;
  }

  getActivePlugin(): DomainConfig | null {
    if (!this.activePlugin) {
      this.activePlugin = localStorage.getItem('activePlugin');
    }

    if (this.activePlugin && this.plugins.has(this.activePlugin)) {
      return this.plugins.get(this.activePlugin)!;
    }

    return null;
  }

  getPlugin(pluginId: string): DomainConfig | null {
    return this.plugins.get(pluginId) || null;
  }

  getAllPlugins(): DomainConfig[] {
    return Array.from(this.plugins.values());
  }

  unloadPlugin(pluginId: string): boolean {
    if (this.activePlugin === pluginId) {
      this.activePlugin = null;
      localStorage.removeItem('activePlugin');
    }
    return this.plugins.delete(pluginId);
  }

  getContentTypes(): ContentType[] {
    const activePlugin = this.getActivePlugin();
    return activePlugin?.contentTypes || [];
  }

  getContentType(typeId: string): ContentType | null {
    const contentTypes = this.getContentTypes();
    return contentTypes.find((type) => type.id === typeId) || null;
  }

  getAIPrompt(promptKey: string): AIPromptConfig | null {
    const activePlugin = this.getActivePlugin();
    return activePlugin?.aiPrompts[promptKey] || null;
  }

  getUIConfig(): UIConfig {
    const activePlugin = this.getActivePlugin();
    return activePlugin?.ui || {};
  }

  getIntegrations(): Record<string, unknown> {
    const activePlugin = this.getActivePlugin();
    return activePlugin?.integrations || {};
  }

  validateContentItem(
    typeId: string,
    data: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const contentType = this.getContentType(typeId);
    if (!contentType) {
      return { valid: false, errors: ['Content type not found'] };
    }

    const errors: string[] = [];

    for (const field of contentType.fields) {
      const value = data[field.name];

      if (
        field.required &&
        (value === undefined || value === null || value === '')
      ) {
        errors.push(`Field ${field.label} is required`);
        continue;
      }

      if (value !== undefined && field.validation) {
        const validation = field.validation;

        if (
          validation.min !== undefined &&
          typeof value === 'string' &&
          value.length < validation.min
        ) {
          errors.push(
            `Field ${field.label} must be at least ${validation.min} characters`
          );
        }

        if (
          validation.max !== undefined &&
          typeof value === 'string' &&
          value.length > validation.max
        ) {
          errors.push(
            `Field ${field.label} must be no more than ${validation.max} characters`
          );
        }

        if (
          validation.pattern &&
          typeof value === 'string' &&
          !new RegExp(validation.pattern).test(value)
        ) {
          errors.push(`Field ${field.label} format is invalid`);
        }

        if (validation.options && !validation.options.includes(value)) {
          errors.push(
            `Field ${field.label} must be one of: ${validation.options.join(', ')}`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async exportConfig(pluginId: string): Promise<string> {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }
    return JSON.stringify(plugin, null, 2);
  }

  async importConfig(configJson: string): Promise<string> {
    try {
      const config = JSON.parse(configJson);
      await this.loadPlugin(config);
      return config.id;
    } catch (error) {
      throw new Error(`Failed to import config: ${error}`);
    }
  }

  getPluginStats(): {
    totalPlugins: number;
    activePlugin: string | null;
    contentTypesCount: number;
  } {
    return {
      totalPlugins: this.plugins.size,
      activePlugin: this.activePlugin,
      contentTypesCount: this.getContentTypes().length,
    };
  }
}

export const pluginRegistry = PluginRegistry.getInstance();
