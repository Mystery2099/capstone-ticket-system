import { test, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let db: typeof import('../src/lib/server/db').db;
let schema: typeof import('../src/lib/server/schema');
let service: typeof import('../src/lib/server/tickets');
let people: Record<string, import('../src/lib/server/tickets').Person>;
let dir: string;
const form = (obj: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(obj)) f.set(k, v);
	return f;
};
beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'capstone-test-'));
	process.env.DATA_DIR = join(dir, 'db');
	delete process.env.DATABASE_URL;
	({ db } = await import('../src/lib/server/db'));
	schema = await import('../src/lib/server/schema');
	service = await import('../src/lib/server/tickets');
	const { initialize } = await import('../src/lib/server/init');
	await initialize();
	people = Object.fromEntries((await db.select().from(schema.user)).map((p) => [p.id, p]));
});
afterAll(async () => {
	await db.$client.close();
	await rm(dir, { recursive: true, force: true });
});
test('requester queries exclude other tickets, private notes, and note events', async () => {
	const r = await service.loadTicketWorkspace(
		people.marcus,
		new URL('http://localhost/app/tickets'),
		'1046'
	);
	assert(r.tickets.every((t) => t.requesterId === 'marcus'));
	assert(r.comments.every((c) => !c.isInternal));
	assert(!JSON.stringify(r).includes('Likely a Wi-Fi adapter'));
	assert(!r.events.some((e) => e.eventType === 'internal_note'));
});
test('guessed ticket numbers do not reveal another requester ticket', async () => {
	await assert.rejects(
		() => service.loadTicketWorkspace(people.rosa, new URL('http://localhost/app/tickets'), '1046'),
		(e: any) => e.status === 404
	);
});
test('the drafts view fetches no tickets', async () => {
	const r = await service.loadTicketWorkspace(
		people.priya,
		new URL('http://localhost/app/tickets?view=drafts')
	);
	assert.equal(r.tickets.length, 0);
});
test('agents can access unassigned tickets', async () => {
	const r = await service.loadTicketWorkspace(
		people.priya,
		new URL('http://localhost/app/tickets?view=unassigned')
	);
	assert.equal(r.tickets.length, 3);
});
test('staff can open a ticket for another enabled requester', async () => {
	const [cat] = await db.select().from(schema.category);
	const fields = { subject: 'On behalf', description: 'Phoned in', categoryId: cat.id };
	const t = await service.createTicket(people.priya, form({ ...fields, requesterId: 'marcus' }));
	assert.equal(t.requesterId, 'marcus');
	const { eq } = await import('drizzle-orm');
	const [event] = await db
		.select()
		.from(schema.ticketEvent)
		.where(eq(schema.ticketEvent.ticketId, t.id));
	assert.equal(event.actorId, 'priya');
	await assert.rejects(
		() => service.createTicket(people.priya, form({ ...fields, requesterId: 'nobody' })),
		(e: any) => e.status === 400
	);
	await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, 'rosa'));
	try {
		await assert.rejects(
			() => service.createTicket(people.priya, form({ ...fields, requesterId: 'rosa' })),
			(e: any) => e.status === 400
		);
	} finally {
		await db.update(schema.user).set({ banned: false }).where(eq(schema.user.id, 'rosa'));
	}
});
test('staff can assign a ticket when creating it', async () => {
	const [cat] = await db.select().from(schema.category);
	const fields = { subject: 'Assigned', description: 'Needs an owner', categoryId: cat.id };
	const t = await service.createTicket(
		people.priya,
		form({ ...fields, assignedToUserId: 'priya' })
	);
	assert.equal(t.assignedToUserId, 'priya');
	const { eq } = await import('drizzle-orm');
	const events = await db
		.select()
		.from(schema.ticketEvent)
		.where(eq(schema.ticketEvent.ticketId, t.id));
	assert.deepEqual(events.find((e) => e.eventType === 'assignedToUserId')?.details, {
		from: null,
		to: 'priya'
	});
	await assert.rejects(
		() => service.createTicket(people.priya, form({ ...fields, assignedToUserId: 'marcus' })),
		(e: any) => e.status === 400
	);
	await assert.rejects(
		() => service.createTicket(people.marcus, form({ ...fields, assignedToUserId: 'priya' })),
		(e: any) => e.status === 403
	);
});
test('requesters cannot open a ticket for someone else', async () => {
	const [cat] = await db.select().from(schema.category);
	await assert.rejects(
		() =>
			service.createTicket(
				people.marcus,
				form({
					subject: 'Spoofed',
					description: 'Not mine',
					categoryId: cat.id,
					requesterId: 'rosa'
				})
			),
		(e: any) => e.status === 403
	);
});
test('ticket creation persists Normal priority and audit event together', async () => {
	const cats = await db.select().from(schema.category);
	const t = await service.createTicket(
		people.marcus,
		form({ subject: 'Test request', description: 'A new request', categoryId: cats[0].id })
	);
	assert.equal(t.priority, 'normal');
	const { eq } = await import('drizzle-orm');
	const events = await db
		.select()
		.from(schema.ticketEvent)
		.where(eq(schema.ticketEvent.ticketId, t.id));
	assert.equal(events.length, 1);
	assert.equal(events[0].eventType, 'created');
});
test('requester priority injection and private notes are rejected', async () => {
	const cats = await db.select().from(schema.category);
	await assert.rejects(
		() =>
			service.createTicket(
				people.marcus,
				form({
					subject: 'Invalid request',
					description: 'Description',
					categoryId: cats[0].id,
					priority: 'high'
				})
			),
		(e: any) => e.status === 403
	);
	await assert.rejects(
		() => service.addTicketComment(people.marcus, 1046, form({ body: 'secret', internal: 'true' })),
		(e: any) => e.status === 403
	);
	await assert.rejects(
		() =>
			service.updateTicketField(people.marcus, 1046, form({ field: 'priority', value: 'high' })),
		(e: any) => e.status === 403
	);
});
test('closed tickets reject replies and edits; only admin reopens', async () => {
	await assert.rejects(
		() => service.addTicketComment(people.priya, 1039, form({ body: 'not allowed' })),
		(e: any) => e.status === 403
	);
	await assert.rejects(
		() =>
			service.updateTicketField(people.priya, 1039, form({ field: 'statusCode', value: 'open' })),
		(e: any) => e.status === 403
	);
	await service.updateTicketField(
		people.jordan,
		1039,
		form({ field: 'statusCode', value: 'open' })
	);
	const r = await service.loadTicketWorkspace(
		people.jordan,
		new URL('http://localhost/app/tickets'),
		'1039'
	);
	assert.equal(r.selected?.statusCode, 'open');
});
test('requester can reopen own resolved ticket', async () => {
	await service.updateTicketField(
		people.priya,
		1046,
		form({ field: 'statusCode', value: 'resolved' })
	);
	await service.updateTicketField(
		people.marcus,
		1046,
		form({ field: 'statusCode', value: 'open' })
	);
	const r = await service.loadTicketWorkspace(
		people.marcus,
		new URL('http://localhost/app/tickets'),
		'1046'
	);
	assert.equal(r.selected?.statusCode, 'open');
});
test('failed foreign key rolls back ticket and audit rows', async () => {
	const { sql } = await import('drizzle-orm');
	const before = (await db.select().from(schema.ticket)).length;
	await assert.rejects(() =>
		db.transaction(async (tx) => {
			const [t] = await tx
				.insert(schema.ticket)
				.values({
					subject: 'Rollback',
					description: 'Must roll back',
					requesterId: 'marcus',
					categoryId: (await tx.select().from(schema.category))[0].id
				})
				.returning();
			await tx
				.insert(schema.ticketEvent)
				.values({ ticketId: t.id, actorId: 'does-not-exist', eventType: 'created' });
		})
	);
	assert.equal((await db.select().from(schema.ticket)).length, before);
	await assert.rejects(() => db.execute(sql`UPDATE ticket SET priority = 'urgent'`));
});
test('malformed category is a validation error and blank replies fail', async () => {
	await assert.rejects(
		() =>
			service.createTicket(
				people.marcus,
				form({ subject: 'Test', description: 'Test', categoryId: 'invalid' })
			),
		(e: any) => e.status === 400
	);
	await assert.rejects(
		() => service.addTicketComment(people.priya, 1046, form({ body: '  ' })),
		(e: any) => e.status === 400
	);
});

test('assignment rejects requesters and disabled agents, and successful changes are audited', async () => {
	const { eq } = await import('drizzle-orm');
	await assert.rejects(
		() =>
			service.updateTicketField(
				people.priya,
				1046,
				form({ field: 'assignedToUserId', value: 'marcus' })
			),
		(e: any) => e.status === 400
	);
	await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, 'priya'));
	await assert.rejects(
		() =>
			service.updateTicketField(
				people.jordan,
				1046,
				form({ field: 'assignedToUserId', value: 'priya' })
			),
		(e: any) => e.status === 400
	);
	await db.update(schema.user).set({ banned: false }).where(eq(schema.user.id, 'priya'));
	await service.updateTicketField(
		people.priya,
		1046,
		form({ field: 'assignedToUserId', value: 'jordan' })
	);
	const r = await service.loadTicketWorkspace(
		people.priya,
		new URL('http://localhost/app/tickets'),
		'1046'
	);
	assert.equal(r.selected?.assignedToUserId, 'jordan');
	assert(r.events.some((e) => e.eventType === 'assignedToUserId' && e.details.to === 'jordan'));
});
test('status mutation rolls back if its activity insert fails', async () => {
	const { sql } = await import('drizzle-orm');
	const before = (
		await service.loadTicketWorkspace(people.priya, new URL('http://localhost/app/tickets'), '1046')
	).selected!.statusCode;
	await db.execute(
		sql`CREATE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`
	);
	await db.execute(
		sql`CREATE TRIGGER reject_test_event BEFORE INSERT ON ticket_event FOR EACH ROW EXECUTE FUNCTION reject_test_event()`
	);
	try {
		await assert.rejects(() =>
			service.updateTicketField(people.priya, 1046, form({ field: 'statusCode', value: 'on_hold' }))
		);
		assert.equal(
			(
				await service.loadTicketWorkspace(
					people.priya,
					new URL('http://localhost/app/tickets'),
					'1046'
				)
			).selected!.statusCode,
			before
		);
	} finally {
		await db.execute(sql`DROP TRIGGER reject_test_event ON ticket_event`);
		await db.execute(sql`DROP FUNCTION reject_test_event()`);
	}
});
test('PGlite backup restores records and relationships into a fresh instance', async () => {
	const { PGlite } = await import('@electric-sql/pglite');
	const backup = await db.$client.dumpDataDir('gzip');
	const restored = new PGlite({ loadDataDir: backup });
	try {
		const result = await restored.query<{ count: number }>(
			`SELECT count(*)::int AS count FROM ticket`
		);
		assert.equal(result.rows[0].count, (await db.select().from(schema.ticket)).length);
		const notes = await restored.query(
			`SELECT c.body FROM ticket_comment c JOIN ticket t ON c.ticket_id=t.id WHERE c.is_internal=true`
		);
		assert(notes.rows.length > 0);
	} finally {
		await restored.close();
	}
});

test('oversized and whitespace-only ticket inputs fail with controlled validation errors', async () => {
	const categories = await db.select().from(schema.category);
	for (const subject of ['   ', 'x'.repeat(181)]) {
		await assert.rejects(
			() =>
				service.createTicket(
					people.marcus,
					form({ subject, description: 'Valid description', categoryId: categories[0].id })
				),
			(e: any) => e.status === 400
		);
	}
});
test('invalid metadata enum and malformed category references fail without changing the ticket', async () => {
	const before = await service.loadTicketWorkspace(
		people.priya,
		new URL('http://localhost/app/tickets'),
		'1046'
	);
	for (const values of [
		{ field: 'priority', value: 'urgent' },
		{ field: 'categoryId', value: 'not-a-uuid' },
		{ field: 'statusCode', value: 'unknown' }
	]) {
		await assert.rejects(
			() => service.updateTicketField(people.priya, 1046, form(values)),
			(e: any) => e.status === 400
		);
	}
	const after = await service.loadTicketWorkspace(
		people.priya,
		new URL('http://localhost/app/tickets'),
		'1046'
	);
	assert.equal(after.selected?.priority, before.selected?.priority);
	assert.equal(after.selected?.statusCode, before.selected?.statusCode);
});
