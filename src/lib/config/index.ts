import type { Metadata } from 'next';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { AppConfig, AppConfigSchema, DEFAULT_APP_CONFIG } from './types';

// Configuration file path
const CONFIG_FILE_PATH = join(process.cwd(), 'app.config.json');

/**
 * Load app configuration from file or return defaults
 */
export function loadAppConfig(): AppConfig {
  try {
    if (!existsSync(CONFIG_FILE_PATH)) {
      console.warn(
        'WARNING: app.config.json not found, using defaults. Run `pnpm create-new` to set up configuration.'
      );
      return DEFAULT_APP_CONFIG;
    }

    const configData = readFileSync(CONFIG_FILE_PATH, 'utf-8');
    const parsedConfig = JSON.parse(configData);

    // Validate the configuration
    const validatedConfig = AppConfigSchema.parse(parsedConfig);
    return validatedConfig;
  } catch (error) {
    console.error('ERROR: Error loading app configuration:', error);
    console.warn(
      'WARNING: Using default configuration. Please check your app.config.json file.'
    );
    return DEFAULT_APP_CONFIG;
  }
}

/**
 * Save app configuration to file
 */
export function saveAppConfig(config: AppConfig): void {
  try {
    // Validate the configuration before saving
    const validatedConfig = AppConfigSchema.parse(config);
    const configData = JSON.stringify(validatedConfig, null, 2);
    writeFileSync(CONFIG_FILE_PATH, configData, 'utf-8');
    console.log('SUCCESS: App configuration saved successfully');
  } catch (error) {
    console.error('ERROR: Error saving app configuration:', error);
    throw error;
  }
}

/**
 * Convert app config to Next.js metadata format
 */
export function configToMetadata(config: AppConfig): Metadata {
  const { metadata, brand, environment } = config;

  // Get the current environment URL
  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = isDev
    ? environment?.development?.url || 'http://localhost:3000'
    : environment?.production?.url ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://fest-vibes-ai.com';

  const nextMetadata: Metadata = {
    title: {
      default: metadata.title,
      template: `%s | ${metadata.title}`,
    },
    description: metadata.description,
    keywords: metadata.keywords,
    authors: [{ name: metadata.author }],
    creator: brand.name,
    publisher: brand.name,

    // Basic meta tags
    manifest: metadata.manifest,
    themeColor: metadata.themeColor,

    // Icons
    icons: {
      icon: metadata.icons?.icon || '/favicon.ico',
      shortcut: metadata.icons?.shortcut,
      apple: metadata.icons?.apple,
      other: metadata.icons?.other || [],
    },

    // Open Graph
    openGraph: {
      type:
        (metadata.openGraph?.type as
          | 'website'
          | 'article'
          | 'book'
          | 'profile'
          | 'music.song'
          | 'music.album'
          | 'music.playlist'
          | 'music.radio_station'
          | 'video.movie'
          | 'video.episode'
          | 'video.tv_show'
          | 'video.other') || 'website',
      locale: metadata.openGraph?.locale || 'en_US',
      title: metadata.title,
      description: metadata.description,
      siteName: metadata.openGraph?.siteName || brand.name,
      url: baseUrl,
      images: metadata.openGraph?.images || [
        {
          url: `${baseUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: metadata.title,
        },
      ],
    },

    // Twitter
    twitter: {
      card: metadata.twitter?.card || 'summary_large_image',
      site: metadata.twitter?.site,
      creator: metadata.twitter?.creator,
      title: metadata.title,
      description: metadata.description,
      images: metadata.twitter?.images || [`${baseUrl}/og-image.png`],
    },

    // Viewport
    viewport: {
      width: 'device-width',
      initialScale: 1,
    },

    // Robots
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    // Additional metadata
    category: 'Technology',
    classification: 'Business',
    ...(baseUrl && { metadataBase: new URL(baseUrl) }),
  };

  return nextMetadata;
}

/**
 * Get configuration value with fallback
 */
export function getConfigValue<T>(
  path: string,
  fallback: T,
  config?: AppConfig
): T {
  const appConfig = config || loadAppConfig();

  try {
    const keys = path.split('.');
    let value: unknown = appConfig;

    for (const key of keys) {
      value = (value as Record<string, unknown>)?.[key];
    }

    return value !== undefined ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Check if configuration file exists
 */
export function hasConfigFile(): boolean {
  return existsSync(CONFIG_FILE_PATH);
}

/**
 * Get configuration file path
 */
export function getConfigFilePath(): string {
  return CONFIG_FILE_PATH;
}

// Export the loaded config as a singleton
let _cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!_cachedConfig) {
    _cachedConfig = loadAppConfig();
  }
  return _cachedConfig;
}

// Clear cache (useful for testing or when config changes)
export function clearConfigCache(): void {
  _cachedConfig = null;
}
