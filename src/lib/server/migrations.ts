import { migrate as migrateLocal } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import type { Sql } from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { db } from './db';
import { databaseConfig } from './database-config';

/** Explicit deployment operation. Never called by the web server. */
export async function migrateDatabase(): Promise<void> {
	const options = { migrationsFolder: './drizzle' };
	if (databaseConfig(process.env).kind === 'local') {
		await migrateLocal(db, options);
	} else {
		await migratePostgres(drizzle(db.$client as unknown as Sql), options);
	}
}
