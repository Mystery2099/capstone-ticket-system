import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { db, closeDatabase } from '../src/lib/server/db';
import { migrateDatabase } from '../src/lib/server/migrations';
import { createFirstAdministrator } from '../src/lib/server/bootstrap';
import { createManagedUser, updateManagedUser } from '../src/lib/server/administration';
import { user, account, session, securityEvent, ticketStatus } from '../src/lib/server/schema';

let directory: string;
beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), 'capstone-provisioning-'));
	process.env.DATA_DIR = join(directory, 'db');
	delete process.env.DATABASE_URL;
	await migrateDatabase();
});
afterAll(async () => {
	await closeDatabase();
	await rm(directory, { recursive: true, force: true });
});

test('migrations create reference data, and bootstrap creates exactly one administrator', async () => {
	expect(await db.select().from(user)).toHaveLength(0);
	expect(await db.select().from(ticketStatus)).toHaveLength(5);
	await createFirstAdministrator('Administrator', 'admin@example.test', 'UniqueAdminPassword2026!');
	await expect(
		createFirstAdministrator('Another', 'another@example.test', 'AnotherPassword2026!')
	).rejects.toThrow('no accounts');
	const people = await db.select().from(user);
	expect(people).toHaveLength(1);
	expect(people[0].role).toBe('admin');
	const [credential] = await db.select().from(account);
	expect(credential.password).not.toContain('UniqueAdminPassword');
});

test('runtime privileges support audited account changes without schema or audit mutation privileges', async () => {
	await db.$client.exec(await readFile('scripts/runtime-grants.sql', 'utf8'));
	await db.execute(sql`SET ROLE capstone_runtime`);
	try {
		const [administrator] = await db.select().from(user);
		const id = await createManagedUser(administrator.id, {
			name: 'Requester',
			email: 'requester@example.test',
			role: 'requester',
			password: 'RequesterPassword2026!'
		});
		await db.insert(session).values({
			id: 'test-session',
			token: 'test-session-token',
			userId: id,
			expiresAt: new Date(Date.now() + 60000),
			updatedAt: new Date()
		});
		await updateManagedUser(administrator.id, {
			id,
			name: 'Requester',
			email: 'requester@example.test',
			role: 'agent',
			enabled: true
		});
		expect(await db.select().from(session).where(eq(session.userId, id))).toHaveLength(0);
		const events = await db.select().from(securityEvent).where(eq(securityEvent.targetId, id));
		expect(events.map((event) => event.action)).toEqual(['user.created', 'user.updated']);
		expect(JSON.stringify(events)).not.toContain('RequesterPassword');
		await expect(db.execute(sql`DELETE FROM security_event`)).rejects.toThrow();
		await expect(db.execute(sql`CREATE TABLE should_be_denied (id text)`)).rejects.toThrow();
		await expect(db.execute(sql`DROP TABLE ticket`)).rejects.toThrow();
	} finally {
		await db.execute(sql`RESET ROLE`);
	}
});
