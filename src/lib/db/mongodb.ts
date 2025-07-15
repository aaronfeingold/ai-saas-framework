import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGODB_URI!
const dbName = process.env.MONGODB_DB_NAME!

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local')
}

if (!dbName) {
  throw new Error('Please add your MongoDB database name to .env.local')
}

// Connection configuration optimized for complex queries and bulk operations
const mongoClient = new MongoClient(uri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,
  bufferCommands: false,
})

let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the client across module reloads
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = mongoClient.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, create a new client
  clientPromise = mongoClient.connect()
}

// Get database instance
export const getDatabase = async (): Promise<Db> => {
  const client = await clientPromise
  return client.db(dbName)
}

// Batch operation helper
export const batchContentOperations = async (operations: Array<(session: any) => Promise<void>>) => {
  const client = await clientPromise
  const session = client.startSession()
  
  try {
    await session.withTransaction(async () => {
      for (const op of operations) {
        await op(session)
      }
    })
  } finally {
    await session.endSession()
  }
}

// Health check function
export const checkMongoHealth = async () => {
  try {
    const client = await clientPromise
    await client.db(dbName).admin().ping()
    return {
      healthy: true,
      message: 'Connected',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: new Date().toISOString()
    }
  }
}

export default clientPromise