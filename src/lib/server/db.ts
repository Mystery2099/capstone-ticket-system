import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { drizzle as remoteDrizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { databaseConfig } from './database-config';
const globals = globalThis as unknown as {
	ticketDb?: ReturnType<typeof localDrizzle<typeof schema>>;
};
function connect() {
	const config = databaseConfig(process.env);
	if (config.kind !== 'local') {
		const client =
			config.kind === 'url' ? postgres(config.url, { max: 5 }) : postgres(config.options);
		return remoteDrizzle(client, { schema }) as unknown as ReturnType<
			typeof localDrizzle<typeof schema>
		>;
	}
	mkdirSync(config.directory, { recursive: true });
	return localDrizzle(new PGlite(config.directory), { schema });
}

type Database = ReturnType<typeof localDrizzle<typeof schema>>;
export const db = new Proxy({} as Database, {
	get(_target, key) {
		const connection = (globals.ticketDb ??= connect());
		const value = Reflect.get(connection, key, connection);
		return typeof value === 'function' && key !== '$client' ? value.bind(connection) : value;
	}
});

export async function closeDatabase(): Promise<void> {
	if (!globals.ticketDb) return;
	const client = globals.ticketDb.$client as unknown as {
		close?: () => Promise<void>;
		end?: () => Promise<void>;
	};
	if (client.close) await client.close();
	else await client.end?.();
	globals.ticketDb = undefined;
}
