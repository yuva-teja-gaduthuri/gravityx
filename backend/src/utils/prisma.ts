import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

/**
 * Connect to Database with exponential backoff retries.
 * Prevents container startup crashes when DB container is momentarily spinning up.
 */
export async function connectWithRetry(retries = 5, delay = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      console.log('✅ [DATABASE]: Successfully connected to database.');
      return true;
    } catch (err: any) {
      console.warn(`⚠️ [DATABASE]: Connection attempt ${attempt}/${retries} failed: ${err.message?.split('\n')[0] || err.message}`);
      if (attempt === retries) {
        console.error('❌ [DATABASE ERROR]: Max database connection retries reached.');
        return false;
      }
      console.log(`🔄 [DATABASE]: Retrying connection in ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  return false;
}

export default prisma;
