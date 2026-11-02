import { migrateDatabase } from '../../src/lib/server/migrations';
import { closeDatabase } from '../../src/lib/server/db';
import { seedTestData } from './database';
try {
	await migrateDatabase();
	await seedTestData();
} finally {
	await closeDatabase();
}
