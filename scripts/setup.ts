import { initialize } from '../src/lib/server/init';
import { db } from '../src/lib/server/db';
await initialize();
console.log('Migrations applied; demo data seeded if enabled and database is empty.');
const client = db.$client as unknown as { close?: () => Promise<void>; end?: () => Promise<void> };
if (client.close) await client.close();
else await client.end?.();
