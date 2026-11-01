import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
export async function GET() {
	await db.execute(sql`SELECT 1`);
	return json({ status: 'ok' });
}
