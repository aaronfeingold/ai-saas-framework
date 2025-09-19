#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const { green, blue, yellow, red, cyan, magenta, bright, reset } = colors;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to ask questions
function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Helper function to ask yes/no questions
async function askYesNo(question, defaultValue = 'y') {
  const answer = await ask(
    `${question} ${yellow}(y/n, default: ${defaultValue})${reset} `
  );
  const normalized = answer.toLowerCase().trim();

  if (normalized === '') return defaultValue.toLowerCase() === 'y';
  return normalized === 'y' || normalized === 'yes';
}

// Validate URL format
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Default configuration template
const DEFAULT_CONFIG = {
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
  auth: {
    provider: 'supabase',
    database: 'neondb',
  },
};

async function collectProjectInfo() {
  console.log(`${bright}${blue}Project Information${reset}`);
  console.log("Let's set up your fest-vibes-ai project configuration.\n");

  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Project basics
  const projectName = await ask(
    `${cyan}Project name${reset} ${yellow}(${config.project.name})${reset}: `
  );
  if (projectName.trim()) {
    config.project.name = projectName.trim();
    config.brand.name = projectName.trim();
    config.metadata.title = projectName.trim();
    config.project.supabaseName = projectName.trim();
  }

  const description = await ask(
    `${cyan}Project description${reset} ${yellow}(${config.project.description})${reset}: `
  );
  if (description.trim()) {
    config.project.description = description.trim();
    config.metadata.description = description.trim();
  }

  const version = await ask(
    `${cyan}Project version${reset} ${yellow}(${config.project.version})${reset}: `
  );
  if (version.trim()) {
    config.project.version = version.trim();
  }

  const supabaseName = await ask(
    `${cyan}Supabase application name${reset} ${yellow}(${config.project.supabaseName})${reset}: `
  );
  if (supabaseName.trim()) {
    config.project.supabaseName = supabaseName.trim();
  }

  return config;
}

async function collectAuthenticationInfo(config) {
  console.log(`\n${bright}${cyan}Authentication Configuration${reset}`);
  console.log('Choose your authentication provider:\n');

  console.log(
    `${green}1) Supabase Auth${reset} ${yellow}(Recommended - Fully managed)${reset}`
  );
  console.log('   ✓ Fully managed authentication service');
  console.log('   ✓ Built-in OAuth providers & email verification');
  console.log('   ✓ Row Level Security (RLS) support');
  console.log('   ✓ Separate auth and business databases\n');

  console.log(
    `${blue}2) NextAuth.js${reset} ${yellow}(Self-hosted with full control)${reset}`
  );
  console.log('   ✓ Self-hosted authentication');
  console.log('   ✓ Multiple OAuth providers');
  console.log('   ✓ Single database for auth and business data');
  console.log('   ✓ Full customization control\n');

  const authChoice = await ask(
    `${cyan}Select authentication provider${reset} ${yellow}(1-2, default: 1)${reset}: `
  );

  const authProvider = authChoice === '2' ? 'nextauth' : 'supabase';

  if (!config.auth) config.auth = {};
  config.auth.provider = authProvider;
  config.auth.database = 'neondb'; // Always use NeonDB for business data

  console.log(
    `\n${green}✓ Selected: ${authProvider === 'supabase' ? 'Supabase Auth' : 'NextAuth.js'}${reset}`
  );

  return config;
}

async function collectMetadataInfo(config) {
  console.log(`\n${bright}${magenta}SEO & Metadata Configuration${reset}`);

  const author = await ask(
    `${cyan}Author/Company name${reset} ${yellow}(${config.metadata.author})${reset}: `
  );
  if (author.trim()) {
    config.metadata.author = author.trim();
  }

  const keywords = await ask(
    `${cyan}SEO Keywords (comma-separated)${reset} ${yellow}(${config.metadata.keywords.join(', ')})${reset}: `
  );
  if (keywords.trim()) {
    config.metadata.keywords = keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k);
  }

  const themeColor = await ask(
    `${cyan}Theme color (hex)${reset} ${yellow}(${config.metadata.themeColor})${reset}: `
  );
  if (themeColor.trim() && themeColor.startsWith('#')) {
    config.metadata.themeColor = themeColor.trim();
  }

  return config;
}

async function collectContactInfo(config) {
  console.log(`\n${bright}${green}Contact Information${reset}`);

  const setupContact = await askYesNo(
    'Do you want to configure contact information?',
    'n'
  );

  if (setupContact) {
    if (!config.brand.contact) config.brand.contact = {};

    const email = await ask(`${cyan}Contact email${reset}: `);
    if (email.trim() && isValidEmail(email.trim())) {
      config.brand.contact.email = email.trim();
    } else if (email.trim()) {
      console.log(`${red}⚠️  Invalid email format, skipping...${reset}`);
    }

    const website = await ask(`${cyan}Website URL${reset}: `);
    if (website.trim() && isValidUrl(website.trim())) {
      config.brand.contact.website = website.trim();
    } else if (website.trim()) {
      console.log(`${red}⚠️  Invalid URL format, skipping...${reset}`);
    }

    const phone = await ask(`${cyan}Phone number${reset}: `);
    if (phone.trim()) {
      config.brand.contact.phone = phone.trim();
    }
  }

  return config;
}

async function collectSocialMedia(config) {
  console.log(`\n${bright}${blue}Social Media Links${reset}`);

  const setupSocial = await askYesNo(
    'Do you want to configure social media links?',
    'n'
  );

  if (setupSocial) {
    if (!config.brand.social) config.brand.social = {};

    const platforms = [
      { name: 'Twitter/X', key: 'twitter' },
      { name: 'LinkedIn', key: 'linkedin' },
      { name: 'Facebook', key: 'facebook' },
      { name: 'Instagram', key: 'instagram' },
      { name: 'GitHub', key: 'github' },
    ];

    for (const platform of platforms) {
      const url = await ask(`${cyan}${platform.name} URL${reset}: `);
      if (url.trim() && isValidUrl(url.trim())) {
        config.brand.social[platform.key] = url.trim();
      } else if (url.trim()) {
        console.log(
          `${red}WARNING: Invalid URL format for ${platform.name}, skipping...${reset}`
        );
      }
    }
  }

  return config;
}

async function collectEnvironmentInfo(config) {
  console.log(`\n${bright}${yellow}Environment Configuration${reset}`);

  const prodUrl = await ask(
    `${cyan}Production URL${reset} ${yellow}(optional)${reset}: `
  );
  if (prodUrl.trim() && isValidUrl(prodUrl.trim())) {
    if (!config.environment.production) config.environment.production = {};
    config.environment.production.url = prodUrl.trim();
  } else if (prodUrl.trim()) {
    console.log(`${red}WARNING: Invalid URL format, skipping...${reset}`);
  }

  return config;
}

async function collectFeatureFlags(config) {
  console.log(`\n${bright}${magenta}Feature Configuration${reset}`);

  config.features.analytics = await askYesNo('Enable analytics?', 'y');
  config.features.darkMode = await askYesNo('Enable dark mode?', 'y');
  config.features.multiLanguage = await askYesNo(
    'Enable multi-language support?',
    'n'
  );

  return config;
}

function validateConfig(config) {
  console.log(`\n${bright}${blue}Validating configuration...${reset}`);

  const errors = [];

  if (!config.project.name) errors.push('Project name is required');
  if (!config.metadata.title) errors.push('Title is required');
  if (!config.metadata.description) errors.push('Description is required');

  if (errors.length > 0) {
    console.log(`${red}ERROR: Configuration validation failed:${reset}`);
    errors.forEach((error) => console.log(`   • ${error}`));
    return false;
  }

  console.log(`${green}SUCCESS: Configuration is valid!${reset}`);
  return true;
}

function saveConfig(config) {
  const configPath = path.join(process.cwd(), 'app.config.json');

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(
      `${green}SUCCESS: Configuration saved to app.config.json${reset}`
    );
    return true;
  } catch (error) {
    console.log(
      `${red}ERROR: Error saving configuration: ${error.message}${reset}`
    );
    return false;
  }
}

function createManifest(config) {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');

  const manifest = {
    name: config.metadata.title,
    short_name: config.project.name,
    description: config.metadata.description,
    start_url: '/',
    display: 'standalone',
    background_color: config.metadata.backgroundColor,
    theme_color: config.metadata.themeColor,
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };

  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`${green}SUCCESS: Web app manifest created${reset}`);
  } catch (error) {
    console.log(
      `${yellow}WARNING: Could not create manifest.json: ${error.message}${reset}`
    );
  }
}

function createEnvTemplate(config) {
  const envPath = path.join(process.cwd(), '.env.example');

  let envTemplate = `# Project Configuration
PROJECT_NAME="${config.project.name}"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# AI Providers
ANTHROPIC_API_KEY="your_anthropic_api_key"
OPENAI_API_KEY="your_openai_api_key"
GOOGLE_GENERATIVE_AI_API_KEY="your_google_api_key"

# Stripe (for payments)
STRIPE_SECRET_KEY="your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="your_stripe_publishable_key"

# Auth Provider Configuration
AUTH_PROVIDER="${config.auth.provider}"
`;

  if (config.auth.provider === 'supabase') {
    envTemplate += `
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
`;
  } else {
    envTemplate += `
# NextAuth.js
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Providers (optional)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
`;
  }

  try {
    fs.writeFileSync(envPath, envTemplate, 'utf-8');
    console.log(
      `${green}SUCCESS: Environment template created (.env.example)${reset}`
    );
  } catch (error) {
    console.log(
      `${yellow}WARNING: Could not create .env.example: ${error.message}${reset}`
    );
  }
}

function displaySummary(config) {
  console.log(`\n${bright}${green}Configuration Summary${reset}`);
  console.log('━'.repeat(50));
  console.log(
    `${cyan}Project:${reset} ${config.project.name} (v${config.project.version})`
  );
  console.log(`${cyan}Description:${reset} ${config.project.description}`);
  console.log(`${cyan}Author:${reset} ${config.metadata.author}`);
  console.log(
    `${cyan}Authentication:${reset} ${config.auth.provider === 'supabase' ? 'Supabase Auth' : 'NextAuth.js'}`
  );
  console.log(`${cyan}Theme Color:${reset} ${config.metadata.themeColor}`);

  if (config.brand.contact?.email) {
    console.log(`${cyan}Contact:${reset} ${config.brand.contact.email}`);
  }

  if (config.environment.production?.url) {
    console.log(
      `${cyan}Production URL:${reset} ${config.environment.production.url}`
    );
  }

  console.log(`${cyan}Features:${reset}`);
  console.log(
    `  • Analytics: ${config.features.analytics ? green + 'YES' + reset : red + 'NO' + reset}`
  );
  console.log(
    `  • Dark Mode: ${config.features.darkMode ? green + 'YES' + reset : red + 'NO' + reset}`
  );
  console.log(
    `  • Multi-language: ${config.features.multiLanguage ? green + 'YES' + reset : red + 'NO' + reset}`
  );

  console.log('\n━'.repeat(50));
}

async function main() {
  console.log(`${bright}${blue}`);
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│                                                 │');
  console.log('│        Welcome to fest-vibes-ai Setup!         │');
  console.log('│                                                 │');
  console.log('└─────────────────────────────────────────────────┘');
  console.log(reset);

  const configExists = fs.existsSync(
    path.join(process.cwd(), 'app.config.json')
  );

  if (configExists) {
    const overwrite = await askYesNo(
      `${yellow}WARNING: Configuration file already exists. Do you want to overwrite it?${reset}`,
      'n'
    );

    if (!overwrite) {
      console.log(`${blue}Keeping existing configuration. Goodbye!${reset}`);
      rl.close();
      return;
    }
  }

  try {
    console.log(
      `${blue}Let's configure your fest-vibes-ai application step by step...${reset}\n`
    );

    let config = await collectProjectInfo();
    config = await collectAuthenticationInfo(config);
    config = await collectMetadataInfo(config);
    config = await collectContactInfo(config);
    config = await collectSocialMedia(config);
    config = await collectEnvironmentInfo(config);
    config = await collectFeatureFlags(config);

    if (!validateConfig(config)) {
      console.log(
        `${red}ERROR: Please fix the errors and run the setup again.${reset}`
      );
      rl.close();
      return;
    }

    displaySummary(config);

    const proceed = await askYesNo('\nDoes this look correct?', 'y');

    if (!proceed) {
      console.log(
        `${yellow}Setup cancelled. Run 'pnpm create-new' to try again.${reset}`
      );
      rl.close();
      return;
    }

    if (saveConfig(config)) {
      createManifest(config);
      createEnvTemplate(config);

      console.log(`\n${bright}${green}Setup completed successfully!${reset}`);
      console.log(`\n${cyan}Next steps:${reset}`);
      console.log(`1. Check your ${bright}app.config.json${reset} file`);
      console.log(
        `2. Copy ${bright}.env.example${reset} to ${bright}.env.local${reset} and configure your ${config.auth.provider === 'supabase' ? 'Supabase' : 'NextAuth.js'} settings`
      );
      console.log(
        `3. Add your logo files to the ${bright}public${reset} directory`
      );
      console.log(`4. Run ${bright}pnpm dev${reset} to start your application`);
      console.log(`\n${blue}Happy coding!${reset}`);
    }
  } catch (error) {
    console.log(`\n${red}ERROR: An error occurred: ${error.message}${reset}`);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${yellow}Setup cancelled by user. Goodbye!${reset}`);
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error(`${red}FATAL ERROR: ${error.message}${reset}`);
  process.exit(1);
});
