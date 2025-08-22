import { z } from 'zod';

// App metadata configuration schema
export const AppMetadataSchema = z.object({
  // Basic app information
  title: z.string().min(1).max(100).default('fest-vibes-ai'),
  description: z
    .string()
    .min(1)
    .max(160)
    .default('AI-powered festival and event management platform'),

  // SEO and social media
  keywords: z
    .array(z.string())
    .default(['AI', 'festival', 'events', 'management', 'SaaS']),
  author: z.string().default('fest-vibes-ai'),

  // Open Graph / Social Media
  openGraph: z
    .object({
      type: z.string().default('website'),
      locale: z.string().default('en_US'),
      siteName: z.string().optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            width: z.number().optional(),
            height: z.number().optional(),
            alt: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),

  // Twitter Card
  twitter: z
    .object({
      card: z
        .enum(['summary', 'summary_large_image', 'app', 'player'])
        .default('summary_large_image'),
      site: z.string().optional(),
      creator: z.string().optional(),
      images: z.array(z.string().url()).optional(),
    })
    .optional(),

  // App-specific metadata
  manifest: z.string().default('/manifest.json'),
  themeColor: z.string().default('#2acf80'),
  backgroundColor: z.string().default('#ffffff'),

  // Icons and favicons
  icons: z
    .object({
      icon: z.string().default('/favicon.ico'),
      shortcut: z.string().optional(),
      apple: z.string().optional(),
      other: z
        .array(
          z.object({
            rel: z.string(),
            url: z.string(),
            sizes: z.string().optional(),
            type: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

// Brand configuration schema
export const BrandConfigSchema = z.object({
  // Company/Product information
  name: z.string().min(1).max(50).default('fest-vibes-ai'),
  tagline: z.string().max(100).optional(),
  logo: z
    .object({
      light: z.string().url().optional(),
      dark: z.string().url().optional(),
      favicon: z.string().default('/favicon.ico'),
    })
    .optional(),

  // Contact information
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      website: z.string().url().optional(),
    })
    .optional(),

  // Social media links
  social: z
    .object({
      twitter: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      facebook: z.string().url().optional(),
      instagram: z.string().url().optional(),
      github: z.string().url().optional(),
    })
    .optional(),
});

// Main app configuration schema
export const AppConfigSchema = z.object({
  // Project metadata
  project: z.object({
    name: z.string().min(1).max(50).default('fest-vibes-ai'),
    version: z.string().default('1.0.0'),
    description: z.string().max(200).optional(),
    domain: z.string().optional(),
    supabaseName: z.string().min(1).max(50).default('fest-vibes-ai'),
  }),

  // Metadata configuration
  metadata: AppMetadataSchema,

  // Brand configuration
  brand: BrandConfigSchema,

  // Environment-specific settings
  environment: z
    .object({
      production: z
        .object({
          url: z.string().url().optional(),
          apiUrl: z.string().url().optional(),
        })
        .optional(),
      development: z
        .object({
          url: z.string().url().default('http://localhost:3000'),
          apiUrl: z.string().url().optional(),
        })
        .optional(),
    })
    .optional(),

  // Feature flags
  features: z
    .object({
      analytics: z.boolean().default(true),
      darkMode: z.boolean().default(true),
      multiLanguage: z.boolean().default(false),
      maintenance: z.boolean().default(false),
    })
    .optional(),
});

// Export types
export type AppMetadata = z.infer<typeof AppMetadataSchema>;
export type BrandConfig = z.infer<typeof BrandConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

// Default configuration
export const DEFAULT_APP_CONFIG: AppConfig = {
  project: {
    name: 'fest-vibes-ai',
    version: '1.0.0',
    description: 'AI-powered festival and event management platform',
    supabaseName: 'fest-vibes-ai',
  },
  metadata: {
    title: 'fest-vibes-ai',
    description: 'AI-powered festival and event management platform',
    keywords: ['AI', 'festival', 'events', 'management', 'SaaS'],
    author: 'fest-vibes-ai',
    manifest: '/manifest.json',
    themeColor: '#2acf80',
    backgroundColor: '#ffffff',
  },
  brand: {
    name: 'fest-vibes-ai',
  },
  environment: {
    development: {
      url: 'http://localhost:3000',
    },
  },
  features: {
    analytics: true,
    darkMode: true,
    multiLanguage: false,
    maintenance: false,
  },
};
