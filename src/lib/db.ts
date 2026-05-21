import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache;
}

let cached: MongooseCache = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 50,           // Increased from 10 - handle concurrent requests better
      minPoolSize: 5,            // Keep a minimum pool active
      maxIdleTimeMS: 30000,      // Close idle connections after 30s
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000, // Check connection health every 10s
      retryWrites: true,
      w: 'majority' as any,      // Ensure writes are acknowledged
      readPreference: 'primaryPreferred' as const, // Read from primary, fallback to secondary
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB connected (pool: 50)');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

/**
 * Ensure all critical indexes exist in the database.
 * Run once at startup or via a migration.
 */
export async function ensureIndexes(): Promise<void> {
  await connectDB();
  
  const db = mongoose.connection.db;
  if (!db) return;
  
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  // Task collection indexes
  if (collectionNames.includes('tasks')) {
    const tasksCollection = db.collection('tasks');
    
    // Compound indexes for common queries
    await tasksCollection.createIndex(
      { department: 1, status: 1 },
      { background: true, name: 'dept_status' }
    );
    await tasksCollection.createIndex(
      { projectId: 1, department: 1, status: 1 },
      { background: true, name: 'project_dept_status' }
    );
    await tasksCollection.createIndex(
      { projectId: 1, assignedUser: 1 },
      { background: true, name: 'project_assigned' }
    );
    // Index for internal tasks (standalone, no projectId)
    await tasksCollection.createIndex(
      { projectId: 1, department: 1, sequence: 1 },
      { background: true, name: 'project_dept_seq' }
    );
    
    console.log('✅ Task indexes ensured');
  }
  
  // Project collection indexes
  if (collectionNames.includes('projects')) {
    const projectsCollection = db.collection('projects');
    
    await projectsCollection.createIndex(
      { status: 1, deadline: 1, priority: -1 },
      { background: true, name: 'status_deadline_priority' }
    );
    await projectsCollection.createIndex(
      { priority: -1, deadline: 1, createdAt: -1 },
      { background: true, name: 'list_sort' }
    );
    
    console.log('✅ Project indexes ensured');
  }
  
  // Comments collection indexes
  if (collectionNames.includes('comments')) {
    const commentsCollection = db.collection('comments');
    
    await commentsCollection.createIndex(
      { taskId: 1, createdAt: -1 },
      { background: true, name: 'task_comments' }
    );
    
    console.log('✅ Comment indexes ensured');
  }
}

export default connectDB;