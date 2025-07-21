import { Pool } from 'pg';

// Vector database connection configuration optimized for expensive computations
const vectorPool = new Pool({
  connectionString: process.env.VECTOR_DATABASE_URL!,
  max: 5, // Limit connections for expensive vector operations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 60000, // Longer timeout for vector operations
});

// Initialize pgvector extension
export const initializeVectorDB = async () => {
  const client = await vectorPool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding VECTOR(1536),
        metadata JSONB,
        user_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS embeddings_user_id_idx ON embeddings(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `);
    console.log('Vector database initialized successfully');
  } catch (error) {
    console.error('Error initializing vector database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Vector similarity search
export const vectorSearch = async (
  queryEmbedding: number[],
  limit: number = 10,
  userId?: string
) => {
  const client = await vectorPool.connect();
  try {
    let query = `
      SELECT id, content, metadata,
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

// Store embedding
export const storeEmbedding = async (
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {},
  userId?: string
) => {
  const client = await vectorPool.connect();
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
  const client = await vectorPool.connect();
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

// Health check function
export const checkVectorHealth = async () => {
  try {
    const client = await vectorPool.connect();
    await client.query('SELECT 1');
    client.release();
    return {
      healthy: true,
      message: 'Connected',
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

export { vectorPool };
