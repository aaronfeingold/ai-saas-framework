import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

// Enhanced PostgreSQL connection pool for combined business + vector operations
const postgresPool = new Pool({
  connectionString:
    process.env.POSTGRES_URL || process.env.VECTOR_DATABASE_URL!,
  max: 20, // Increased for mixed workloads (business + vector operations)
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 60000, // Balanced timeout for both business and vector queries
});

// Drizzle instance for business data operations
export const db = drizzle(postgresPool, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

// Separate pool for raw vector operations that need direct SQL
export const vectorPool = postgresPool;

// Initialize PostgreSQL database with all required extensions and tables
export const initializePostgresDB = async () => {
  const client = await postgresPool.connect();
  try {
    // Enable required extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    console.log('PostgreSQL database initialized successfully');
    console.log('Extensions: vector, uuid-ossp');
    console.log('Tables will be created via Drizzle migrations');
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Legacy compatibility - alias for initializePostgresDB
export const initializeVectorDB = initializePostgresDB;

// Vector similarity search (enhanced with Drizzle integration)
export const vectorSearch = async (
  queryEmbedding: number[],
  limit: number = 10,
  userId?: string
) => {
  const client = await postgresPool.connect();
  try {
    let query = `
      SELECT id, content, metadata, user_id,
             1 - (embedding <=> $1::vector) as similarity
      FROM embeddings
    `;
    const params: unknown[] = [JSON.stringify(queryEmbedding)];

    if (userId) {
      query += ` WHERE user_id = $2`;
      params.push(userId);
    }

    query += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
};

// Store embedding (enhanced)
export const storeEmbedding = async (
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {},
  userId?: string
) => {
  const client = await postgresPool.connect();
  try {
    const result = await client.query(
      `INSERT INTO embeddings (content, embedding, metadata, user_id)
       VALUES ($1, $2::vector, $3, $4)
       RETURNING id`,
      [content, JSON.stringify(embedding), JSON.stringify(metadata), userId]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
};

// Delete embeddings by user
export const deleteUserEmbeddings = async (userId: string) => {
  const client = await postgresPool.connect();
  try {
    const result = await client.query(
      'DELETE FROM embeddings WHERE user_id = $1',
      [userId]
    );
    return result.rowCount;
  } finally {
    client.release();
  }
};

// Enhanced health check function for combined database
export const checkPostgresHealth = async () => {
  try {
    const client = await postgresPool.connect();

    // Test basic connection
    await client.query('SELECT 1');

    // Test vector extension
    await client.query("SELECT vector_dims('[1,2,3]'::vector)");

    // Test business tables (basic connectivity)
    await client.query('SELECT COUNT(*) FROM chats LIMIT 1');

    client.release();

    return {
      healthy: true,
      message: 'Connected - Business + Vector operations ready',
      extensions: ['vector', 'uuid-ossp'],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: new Date().toISOString(),
    };
  }
};

// Legacy compatibility - alias for checkPostgresHealth
export const checkVectorHealth = checkPostgresHealth;

// Connection pool management
export const closePostgresConnections = async () => {
  await postgresPool.end();
};

// Export the pool for direct access when needed
export { postgresPool };

// Export Drizzle database instance as default
export default db;
