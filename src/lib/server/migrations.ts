import { migrate as migrateLocal } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import type { Sql } from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { db } from './db';
import { resolveDatabaseConfig } from './database-config';

/** Explicit deployment operation. Never called by the web server. */
export async function migrateDatabase(): Promise<void> {
	const migrationOptions = { migrationsFolder: './drizzle' };
	if (resolveDatabaseConfig(process.env).kind === 'local') {
		await migrateLocal(db, migrationOptions);
	} else {
		await migratePostgres(drizzle(db.$client as unknown as Sql), migrationOptions);
	}
}
