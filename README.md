# AI SaaS Framework

A comprehensive Next.js 15 framework for building AI-powered SaaS applications with multi-database architecture, authentication, payments, and RAG capabilities.

## Architecture Overview

This framework implements a simplified two-database architecture for optimal performance and reduced complexity:

- **Supabase**: User authentication, profiles, subscriptions, sessions
- **PostgreSQL + pgvector**: Business data, domain content, vector embeddings, semantic search, RAG operations
- **Redis**: Enhanced caching layer for all databases

## Prerequisites

Before setting up fest-vibes-ai, ensure you have the following services ready:

### Required Services

1. **Supabase Account** - [Create account](https://supabase.com/dashboard)
   - For user authentication, profiles, and session management
2. **Stripe Account** - [Create account](https://dashboard.stripe.com/register)
   - For payment processing and subscription management
3. **NeonDB Database** - PostgreSQL with pgvector extension
   - For business data, content, and vector embeddings
   - Serverless PostgreSQL optimized for modern applications
   - Sign up at [neon.tech](https://neon.tech)
4. **Redis Instance** - [Upstash Redis](https://upstash.com/redis) or self-hosted
   - For caching and session storage

### Required Environment Variables

You'll need to obtain API keys and connection strings from each service above.

## Quick Start

1. **Clone and install dependencies:**

```bash
cd ai-saas-framework
pnpm install
```

2. **Run the interactive setup:**

```bash
pnpm create-new
```

This will guide you through configuring your application metadata, branding, and other settings. The setup creates an `app.config.json` file that controls:

- Project metadata (title, description, version)
- SEO settings (keywords, Open Graph, Twitter cards)
- Brand configuration (logos, contact info, social media)
- Feature flags (analytics, dark mode, etc.)
- Environment-specific URLs

3. **Set up environment variables:**

```bash
cp .env.example .env.local
# Fill in all required environment variables from the services above
```

4. **Set up databases (see Database Setup section below)**

5. **Run the development server:**

```bash
pnpm dev
```

## Database Setup and Configuration

### 1. Supabase Setup (User Database)

1. **Create a Supabase project:** https://supabase.com/dashboard
2. **Get your credentials:**
   - Go to Settings > API
   - Copy the Project URL and anon/public key
   - Copy the service_role key from the same page

3. **Configure environment variables:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. **Create required tables in Supabase SQL Editor:**

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### 2. NeonDB Setup (Business + Vector Database)

1. **Create a NeonDB Project:**
   - Go to [neon.tech](https://neon.tech) and sign up
   - Create a new project with PostgreSQL 15+
   - Choose a region close to your users

2. **Enable Required Extensions:**
   - In the NeonDB SQL Editor, run:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

3. **Get Your Connection String:**
   - Go to your project dashboard
   - Copy the connection string from the "Connection Details" section
   - It should look like: `postgresql://username:password@hostname/database?sslmode=require`

4. **Alternative: Local PostgreSQL with pgvector (for development)**

   ```bash
   # Install PostgreSQL
   brew install postgresql  # macOS
   sudo apt-get install postgresql postgresql-contrib  # Ubuntu

   # Install pgvector
   git clone https://github.com/pgvector/pgvector.git
   cd pgvector
   make
   make install  # or sudo make install

   # Start PostgreSQL
   brew services start postgresql  # macOS
   sudo systemctl start postgresql  # Ubuntu

   # Create database and enable extensions
   psql postgres
   CREATE DATABASE ai_saas_framework;
   \c ai_saas_framework
   CREATE EXTENSION vector;
   CREATE EXTENSION "uuid-ossp";
   ```

5. **Configure environment variables:**

```env
# Use your NeonDB connection string
POSTGRES_URL=postgresql://username:password@hostname/database?sslmode=require
POSTGRES_DIRECT_URL=postgresql://username:password@hostname/database?sslmode=require
# For compatibility with existing database queries
DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require
```

### 3. Redis Setup (Caching Layer)

1. **Option A: Redis Cloud (Recommended for production)**
   - Sign up at https://redis.com/try-free/
   - Create a database
   - Copy the Redis URL

2. **Option B: Local Redis**

   ```bash
   # Install Redis
   brew install redis  # macOS
   sudo apt-get install redis-server  # Ubuntu

   # Start Redis
   brew services start redis  # macOS
   sudo systemctl start redis-server  # Ubuntu
   ```

3. **Configure environment variables:**

```env
REDIS_URL=redis://localhost:6379
# or for Redis Cloud:
REDIS_URL=rediss://username:password@endpoint:port
```

## Third-Party Service Configuration

## Available AI Models

The framework supports 12 AI models across 4 providers, plus embedding models for RAG functionality.

### OpenAI Models

- **GPT-4o**: Advanced multimodal model with vision and reasoning capabilities
- **GPT-4o Mini**: Faster, cost-effective version of GPT-4o with vision support
- **o1-preview**: Advanced reasoning model (preview) - specialized for complex problem-solving
- **o1-mini**: Faster reasoning model with enhanced analytical capabilities

### Anthropic Models

- **Claude 3.5 Sonnet**: Most capable Claude model with enhanced reasoning and vision
- **Claude 3.5 Haiku**: Fast and efficient Claude model with vision support

### Google Models

- **Gemini 2.0 Flash**: Fast multimodal model with enhanced capabilities and reasoning
- **Gemini 1.5 Flash**: Balanced speed and capability with vision support
- **Gemini 1.5 Pro**: Most capable Gemini model with extended context window

### Perplexity Models

- **Llama 3.1 Sonar Large (Online)**: Large model with real-time web search capabilities
- **Llama 3.1 Sonar Small (Online)**: Efficient model with real-time web search

### Embedding Models (for RAG)

- **OpenAI text-embedding-ada-002**: Used for vector embeddings and semantic search

### User Access Tiers

Model access varies by subscription tier:

- **Guest**: Claude 3.5 Haiku only (10 messages/day, no file uploads)
- **Free**: Claude 3.5 Haiku + Sonnet (50 messages/day, file uploads allowed)
- **Pro**: All Claude models (500 messages/day, RAG enabled, 50MB files)
- **Enterprise**: All Claude models (unlimited usage, RAG enabled, 100MB files)

_Note: OpenAI, Google, and Perplexity models are configured but require additional entitlement updates to be available per tier._

### Required API Keys

To use specific model providers, obtain API keys from:

#### Anthropic (Claude AI)

1. **Get API key:** https://console.anthropic.com/
2. **Configure environment:**

```env
ANTHROPIC_API_KEY=sk-ant-your-api-key
```

#### OpenAI

1. **Get API key:** https://platform.openai.com/api-keys
2. **Configure environment:**

```env
OPENAI_API_KEY=sk-your-openai-api-key
```

#### Google AI

1. **Get API key:** https://aistudio.google.com/app/apikey
2. **Configure environment:**

```env
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key
```

#### Perplexity

1. **Get API key:** https://www.perplexity.ai/settings/api
2. **Configure environment:**

```env
PERPLEXITY_API_KEY=your-perplexity-api-key
```

### Stripe (Payments)

1. **Create Stripe account:** https://dashboard.stripe.com/register
2. **Get your keys from Dashboard > Developers > API keys**
3. **Configure environment:**

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

4. **Set up webhooks:**
   - Go to Dashboard > Developers > Webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Select events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
   - Copy webhook secret:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### NextAuth Configuration

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-32-character-secret-key-here
```

Generate a secret:

```bash
openssl rand -base64 32
```

## Configuration System

fest-vibes-ai uses a dynamic configuration system that allows you to customize your application without code changes.

### Configuration File Structure

The `app.config.json` file (created by running `pnpm create-new`) contains:

```json
{
  "project": {
    "name": "your-app-name",
    "version": "1.0.0",
    "description": "Your app description",
    "supabaseName": "your-supabase-app-name"
  },
  "metadata": {
    "title": "Your App Title",
    "description": "SEO description",
    "keywords": ["keyword1", "keyword2"],
    "themeColor": "#2acf80"
  },
  "brand": {
    "name": "Your Brand",
    "contact": {
      "email": "hello@yourapp.com"
    },
    "social": {
      "twitter": "https://twitter.com/yourapp"
    }
  },
  "features": {
    "analytics": true,
    "darkMode": true,
    "multiLanguage": false
  }
}
```

### Dynamic Metadata

The configuration automatically generates:

- Next.js metadata for SEO
- Open Graph tags for social sharing
- Twitter Card meta tags
- Web app manifest
- Favicon and icon configurations

### Reconfiguring Your App

To update your configuration:

```bash
pnpm create-new
```

Or manually edit `app.config.json` and restart your development server.

## Development Workflow

### Initialize Databases

```bash
# Initialize PostgreSQL database (extensions + tables)
pnpm db:init

# Test all database connections
curl http://localhost:3000/api/health
```

### Database Health Monitoring

The framework includes built-in health checks for all databases:

```bash
# Check all database connections
curl http://localhost:3000/api/health

# Response format:
{
  "supabase": { "healthy": true, "message": "Connected", "timestamp": "..." },
  "postgres": {
    "healthy": true,
    "message": "Connected - Business + Vector operations ready",
    "extensions": ["vector", "uuid-ossp"],
    "timestamp": "..."
  },
  "redis": { "healthy": true, "message": "Connected", "timestamp": "..." },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Production Deployment

### Environment Setup

1. **Set up production databases:**
   - Supabase: Upgrade to Pro plan for production usage
   - PostgreSQL: Use managed PostgreSQL with pgvector support (Supabase, AWS RDS, etc.)
   - Redis: Use Redis Cloud or managed Redis service

2. **Configure production environment variables in your deployment platform**

3. **Set up monitoring:**
   - Database connection monitoring via `/api/health`
   - Application performance monitoring
   - Error tracking and logging

### Security Considerations

1. **Database Security:**
   - Enable SSL/TLS for all database connections
   - Use strong passwords and rotate them regularly
   - Configure proper firewall rules and IP whitelisting
   - Enable audit logging for sensitive operations

2. **API Security:**
   - Validate all environment variables are set
   - Implement rate limiting on API routes
   - Use HTTPS in production
   - Validate webhook signatures (Stripe)

3. **User Data Protection:**
   - Implement proper data retention policies
   - Use encryption for sensitive data
   - Comply with GDPR/CCPA requirements
   - Regular security audits

## Performance Optimization

### Database Performance

- **Connection Pooling:** Pre-configured for each database type
- **Caching Strategy:** Redis caching for frequently accessed data
- **Query Optimization:** Proper indexing and query patterns
- **Load Balancing:** Ready for read/write splitting

### Caching Strategy

- **User Data:** 5-minute TTL
- **Vector Search Results:** 30-minute TTL
- **Content Data:** 10-minute TTL (configurable)
- **Session Data:** 1-hour TTL

## Troubleshooting

### Common Issues

1. **Database Connection Issues:**

   ```bash
   # Check health endpoint
   curl http://localhost:3000/api/health

   # Check environment variables
   echo $SUPABASE_URL
   echo $MONGODB_URI
   echo $VECTOR_DATABASE_URL
   echo $REDIS_URL
   ```

2. **Authentication Issues:**
   - Verify Supabase credentials
   - Check NEXTAUTH_SECRET is set
   - Ensure callback URLs are configured

3. **Payment Issues:**
   - Verify Stripe keys are correct
   - Check webhook endpoint is accessible
   - Verify webhook secret matches

4. **AI/Vector Issues:**
   - Verify Anthropic API key
   - Check pgvector extension is installed
   - Verify vector database connectivity

## Architecture Details

### Simplified Database Strategy

This framework uses a streamlined two-database architecture for optimal performance and reduced complexity:

1. **User Database (Supabase):** High-frequency, low-latency authentication operations
2. **Business + Vector Database (PostgreSQL + pgvector):** All business data, content, and AI operations
3. **Cache Layer (Redis):** Enhanced caching for frequently accessed data

### Data Flow

1. **User Authentication:** Supabase handles all auth operations with dedicated connection pool
2. **Business Operations:** PostgreSQL handles chat, content, and business logic with optimized queries
3. **AI Operations:** Same PostgreSQL instance provides semantic search and RAG with vector operations
4. **Performance:** Enhanced Redis caching compensates for unified database approach
5. **Connection Management:** Optimized connection pooling balances business and vector workloads

This simplified architecture reduces operational complexity while maintaining performance through intelligent caching and connection pooling strategies.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test all database integrations
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
