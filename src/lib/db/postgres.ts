// Enhanced PostgreSQL connection and operations
// Replaces the previous mongodb.ts with unified PostgreSQL approach
import { checkPostgresHealth, db, postgresPool } from './vector';

// Re-export the main database instance and utilities
export { db, postgresPool };

// Re-export health check with new name
export { checkPostgresHealth as checkBusinessDBHealth };

// Transaction helper for complex operations
export const withTransaction = async <T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> => {
  return await db.transaction(callback);
};

// Batch operation helper (replacement for MongoDB batchContentOperations)
export const batchOperations = async <T>(
  operations: Array<(db: typeof db) => Promise<T>>
): Promise<T[]> => {
  return await db.transaction(async (tx) => {
    const results: T[] = [];
    for (const operation of operations) {
      const result = await operation(tx);
      results.push(result);
    }
    return results;
  });
};

// Connection management
export const closeConnections = async () => {
  await postgresPool.end();
};

// Database initialization
export { initializePostgresDB as initializeDatabase } from './vector';

// Default export for main database instance
export default db;
