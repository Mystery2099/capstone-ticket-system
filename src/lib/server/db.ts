import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { drizzle as remoteDrizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { resolveDatabaseConfig } from './database-config';
const databaseGlobals = globalThis as unknown as {
	ticketDatabase?: ReturnType<typeof localDrizzle<typeof schema>>;
};
function connectDatabase() {
	const config = resolveDatabaseConfig(process.env);
	if (config.kind !== 'local') {
		const client =
			config.kind === 'url' ? postgres(config.url, { max: 5 }) : postgres(config.options);
		return remoteDrizzle(client, { schema }) as unknown as ReturnType<
			typeof localDrizzle<typeof schema>
		>;
	}
	mkdirSync(config.directory, { recursive: true });
	return localDrizzle(new PGlite(config.directory, { extensions: { pg_trgm } }), { schema });
}

type Database = ReturnType<typeof localDrizzle<typeof schema>>;
export const db = new Proxy({} as Database, {
	get(_target, propertyKey) {
		const connection = (databaseGlobals.ticketDatabase ??= connectDatabase());
		const propertyValue = Reflect.get(connection, propertyKey, connection);
		return typeof propertyValue === 'function' && propertyKey !== '$client'
			? propertyValue.bind(connection)
			: propertyValue;
	}
});

export async function closeDatabase(): Promise<void> {
	if (!databaseGlobals.ticketDatabase) return;
	const client = databaseGlobals.ticketDatabase.$client as unknown as {
		close?: () => Promise<void>;
		end?: () => Promise<void>;
	};
	if (client.close) await client.close();
	else await client.end?.();
	databaseGlobals.ticketDatabase = undefined;
}
