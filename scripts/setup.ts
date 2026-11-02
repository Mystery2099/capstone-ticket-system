import { migrateDatabase } from '../src/lib/server/migrations';
import { closeDatabase } from '../src/lib/server/db';
try {
	await migrateDatabase();
	console.log('Database migrations applied. No accounts or sample tickets were created.');
} finally {
	await closeDatabase();
}
