# AI SaaS Framework

A comprehensive Next.js 15 framework for building AI-powered SaaS applications with multi-database architecture, authentication, payments, and RAG capabilities.

## Architecture Overview

This framework implements a three-database architecture for optimal performance isolation:

- **Supabase**: User authentication, profiles, subscriptions, sessions
- **MongoDB**: Domain content, user-generated data, business logic
- **PostgreSQL + pgvector**: Vector embeddings, semantic search, RAG operations
- **Redis**: Caching layer for all databases

## Quick Start

1. **Clone and install dependencies:**

```bash
cd ai-saas-framework
pnpm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env.local
# Fill in all required environment variables
```

3. **Set up databases (see Database Setup section below)**

4. **Run the development server:**

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

### 2. MongoDB Setup (Content Database)

1. **Option A: MongoDB Atlas (Recommended for production)**
   - Create account at https://www.mongodb.com/atlas
   - Create a new cluster
   - Get connection string from Connect > Connect your application
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/dbname`

2. **Option B: Local MongoDB**

   ```bash
   # Install MongoDB locally
   brew install mongodb/brew/mongodb-community  # macOS
   sudo apt-get install mongodb  # Ubuntu

   # Start MongoDB
   brew services start mongodb/brew/mongodb-community  # macOS
   sudo systemctl start mongod  # Ubuntu
   ```

3. **Configure environment variables:**

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-saas-framework
MONGODB_DB_NAME=ai-saas-framework
```

### 3. PostgreSQL + pgvector Setup (Vector Database)

1. **Option A: Supabase (Separate Project for Vectors)**
   - Create a second Supabase project for vectors
   - Enable the pgvector extension in SQL Editor:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Option B: Local PostgreSQL with pgvector**

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

   # Create database and enable extension
   psql postgres
   CREATE DATABASE vector_db;
   \c vector_db
   CREATE EXTENSION vector;
   ```

3. **Configure environment variables:**

```env
VECTOR_DATABASE_URL=postgresql://username:password@localhost:5432/vector_db
VECTOR_DATABASE_DIRECT_URL=postgresql://username:password@localhost:5432/vector_db
```

### 4. Redis Setup (Caching Layer)

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

### Anthropic (Claude AI)

1. **Get API key:** https://console.anthropic.com/
2. **Configure environment:**

```env
ANTHROPIC_API_KEY=sk-ant-your-api-key
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

## Development Workflow

### Initialize Databases

```bash
# Initialize vector database tables
pnpm db:vector:init

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
  "mongodb": { "healthy": true, "message": "Connected", "timestamp": "..." },
  "vector": { "healthy": true, "message": "Connected", "timestamp": "..." },
  "redis": { "healthy": true, "message": "Connected", "timestamp": "..." },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Production Deployment

### Environment Setup

1. **Set up production databases:**
   - Supabase: Upgrade to Pro plan for production usage
   - MongoDB Atlas: Configure production cluster with appropriate scaling
   - Vector DB: Use managed PostgreSQL with pgvector support
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

### Multi-Database Strategy

This framework uses separate databases for different concerns to optimize performance and scalability:

1. **User Database (Supabase):** High-frequency, low-latency operations
2. **Content Database (MongoDB):** Complex queries and document storage
3. **Vector Database (PostgreSQL + pgvector):** Computationally expensive AI operations
4. **Cache Layer (Redis):** Fast access to frequently used data

### Data Flow

1. **User Authentication:** Supabase handles all auth operations
2. **Content Management:** MongoDB stores and retrieves content
3. **AI Operations:** Vector database provides semantic search and RAG
4. **Cross-Database Sync:** Event-driven updates maintain consistency
5. **Performance:** Redis caching reduces database load

This architecture ensures that expensive AI operations don't impact user authentication speed, and content operations don't slow down real-time chat functionality.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test all database integrations
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
