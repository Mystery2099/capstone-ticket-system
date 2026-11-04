import { test, beforeAll, afterAll, vi } from 'vitest';
import * as permissions from '../src/lib/permissions';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let db: typeof import('../src/lib/server/db').db;
let schema: typeof import('../src/lib/server/schema');
let service: typeof import('../src/lib/server/tickets');
let people: Record<string, import('../src/lib/server/access').Person>;
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
	const { migrateDatabase } = await import('../src/lib/server/migrations');
	await migrateDatabase();
	const { seedTestData } = await import('./fixtures/database');
	await seedTestData();
	const { loadRoles, applyRolePermissions } = await import('../src/lib/server/roles');
	const roles = await loadRoles();
	people = Object.fromEntries(
		(await db.select().from(schema.user)).map((person) => [
			person.id,
			applyRolePermissions(person, roles)
		])
	);
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
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 404
	);
});
const searchTicketNumbers = async (personId: string, searchText: string) => {
	const url = new URL('http://localhost/app/tickets');
	url.searchParams.set('q', searchText);
	const r = await service.loadTicketWorkspace(people[personId], url);
	return r.tickets.map((t) => t.ticketNumber);
};
test('search keeps internal notes and other requesters tickets private', async () => {
	assert.deepEqual(await searchTicketNumbers('priya', 'escalating'), [1046]);
	assert.deepEqual(await searchTicketNumbers('marcus', 'escalating'), []);
	const url = new URL('http://localhost/app/tickets?q=%231046');
	assert.equal(await service.findTicketSearchRedirect(people.rosa, url), null);
	assert.equal(await service.findTicketSearchRedirect(people.marcus, url), '/app/tickets/1046');
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
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 400
	);
	await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, 'rosa'));
	try {
		await assert.rejects(
			() => service.createTicket(people.priya, form({ ...fields, requesterId: 'rosa' })),
			(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 400
		);
	} finally {
		await db.update(schema.user).set({ banned: false }).where(eq(schema.user.id, 'rosa'));
	}
});
test('staff can assign a ticket and choose priority when creating it', async () => {
	const [cat] = await db.select().from(schema.category);
	const fields = { subject: 'Assigned', description: 'Needs an owner', categoryId: cat.id };
	const t = await service.createTicket(
		people.priya,
		form({ ...fields, assignedToUserId: 'priya', priority: 'high' })
	);
	assert.equal(t.assignedToUserId, 'priya');
	assert.equal(t.priority, 'high');
	await assert.rejects(
		() => service.createTicket(people.priya, form({ ...fields, priority: 'urgent' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 400
	);
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
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 400
	);
	await assert.rejects(
		() => service.createTicket(people.marcus, form({ ...fields, assignedToUserId: 'priya' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
	);
});
test('agents and administrators can create every status with matching timestamps', async () => {
	const [selectedCategory] = await db.select().from(schema.category);
	for (const actor of [people.priya, people.jordan]) {
		for (const statusCode of ['open', 'in_progress', 'on_hold', 'resolved', 'closed']) {
			const createdTicket = await service.createTicket(
				actor,
				form({
					subject: 'Initial status',
					description: 'Logged by support',
					categoryId: selectedCategory.id,
					statusCode
				})
			);
			assert.equal(createdTicket.statusCode, statusCode);
			assert.equal(createdTicket.resolvedAt !== null, statusCode === 'resolved');
			assert.equal(createdTicket.closedAt !== null, statusCode === 'closed');
		}
	}
	const fields = {
		subject: 'Status validation',
		description: 'Test',
		categoryId: selectedCategory.id
	};
	await assert.rejects(
		() => service.createTicket(people.priya, form({ ...fields, statusCode: 'invalid' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 400
	);
	await assert.rejects(
		() => service.createTicket(people.marcus, form({ ...fields, statusCode: 'closed' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
	);
});
test('capability checks deny unknown roles and keep ticket visibility separate from internal notes', async () => {
	assert.equal(permissions.hasPermission({ role: 'unknown' }, 'viewAllTickets'), false);
	assert.equal(permissions.hasPermission({ role: 'toString' }, 'manageAdministration'), false);
	assert.equal(permissions.hasPermission(null, 'setTicketStatus'), false);
	assert.equal(permissions.hasPermission({ role: 'agent' }, 'manageAdministration'), false);
	const originalPermissionCheck = permissions.hasPermission;
	const permissionCheck = vi
		.spyOn(permissions, 'hasPermission')
		.mockImplementation(
			(role, permission) =>
				permission !== 'useInternalNotes' && originalPermissionCheck(role, permission)
		);
	try {
		const workspace = await service.loadTicketWorkspace(
			people.priya,
			new URL('http://localhost/app/tickets'),
			'1046'
		);
		assert(workspace.tickets.some((ticket) => ticket.requesterId !== people.priya.id));
		assert(!workspace.comments.some((comment) => comment.isInternal));
		await assert.rejects(
			() =>
				service.addTicketComment(people.priya, 1046, form({ body: 'Private', internal: 'true' })),
			(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
		);
	} finally {
		permissionCheck.mockRestore();
	}
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
test('requester forgery is rejected: priority, another requester, and private notes', async () => {
	const cats = await db.select().from(schema.category);
	await assert.rejects(
		() =>
			service.createTicket(
				people.marcus,
				form({
					subject: 'Spoofed',
					description: 'Not mine',
					categoryId: cats[0].id,
					requesterId: 'rosa'
				})
			),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
	);
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
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
	);
	await assert.rejects(
		() => service.addTicketComment(people.marcus, 1046, form({ body: 'secret', internal: 'true' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
	);
	await assert.rejects(
		() =>
			service.updateTicketField(people.marcus, 1046, form({ field: 'priority', value: 'high' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
	);
});
test('closed tickets reject replies and edits; only admin reopens', async () => {
	await assert.rejects(
		() => service.addTicketComment(people.priya, 1039, form({ body: 'not allowed' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
	);
	await assert.rejects(
		() =>
			service.updateTicketField(people.priya, 1039, form({ field: 'statusCode', value: 'open' })),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 403
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
	assert.equal(r.selectedTicket?.statusCode, 'open');
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
	assert.equal(r.selectedTicket?.statusCode, 'open');
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
test('malformed input fails with a controlled 400 and leaves the ticket unchanged', async () => {
	const isBadRequest = (e: unknown) =>
		typeof e === 'object' && e !== null && 'status' in e && e.status === 400;
	const [cat] = await db.select().from(schema.category);
	for (const fields of [
		{ subject: '   ', description: 'Valid description', categoryId: cat.id },
		{ subject: 'x'.repeat(181), description: 'Valid description', categoryId: cat.id },
		{ subject: 'Test', description: 'Test', categoryId: 'invalid' }
	])
		await assert.rejects(() => service.createTicket(people.marcus, form(fields)), isBadRequest);
	await assert.rejects(
		() => service.addTicketComment(people.priya, 1046, form({ body: '  ' })),
		isBadRequest
	);
	const url = new URL('http://localhost/app/tickets');
	const before = (await service.loadTicketWorkspace(people.priya, url, '1046')).selectedTicket;
	for (const values of [
		{ field: 'priority', value: 'urgent' },
		{ field: 'categoryId', value: 'not-a-uuid' },
		{ field: 'statusCode', value: 'unknown' }
	])
		await assert.rejects(
			() => service.updateTicketField(people.priya, 1046, form(values)),
			isBadRequest
		);
	const after = (await service.loadTicketWorkspace(people.priya, url, '1046')).selectedTicket;
	assert.equal(after?.priority, before?.priority);
	assert.equal(after?.statusCode, before?.statusCode);
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
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 400
	);
	await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, 'priya'));
	await assert.rejects(
		() =>
			service.updateTicketField(
				people.jordan,
				1046,
				form({ field: 'assignedToUserId', value: 'priya' })
			),
		(e: unknown) => typeof e === 'object' && e !== null && 'status' in e && e.status === 400
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
	assert.equal(r.selectedTicket?.assignedToUserId, 'jordan');
	assert(r.events.some((e) => e.eventType === 'assignedToUserId' && e.details.to === 'jordan'));
});
test('status mutation rolls back if its activity insert fails', async () => {
	const { sql } = await import('drizzle-orm');
	const before = (
		await service.loadTicketWorkspace(people.priya, new URL('http://localhost/app/tickets'), '1046')
	).selectedTicket!.statusCode;
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
			).selectedTicket!.statusCode,
			before
		);
	} finally {
		await db.execute(sql`DROP TRIGGER reject_test_event ON ticket_event`);
		await db.execute(sql`DROP FUNCTION reject_test_event()`);
	}
});
test('ticket pages use a cursor and previews exclude newer private notes', async () => {
	const { eq, inArray } = await import('drizzle-orm');
	const [category] = await db.select().from(schema.category);
	const records = await db
		.insert(schema.ticket)
		.values(
			Array.from({ length: 51 }, (_, index) => ({
				subject: `Pagination ${index}`,
				description: 'Page boundary check',
				requesterId: people.marcus.id,
				categoryId: category.id
			}))
		)
		.returning();
	try {
		const latest = records[records.length - 1];
		await db.insert(schema.ticketComment).values([
			{
				ticketId: latest.id,
				authorId: people.priya.id,
				body: 'Public preview',
				createdAt: new Date('2026-01-01')
			},
			{
				ticketId: latest.id,
				authorId: people.priya.id,
				body: 'Private preview',
				isInternal: true,
				createdAt: new Date('2026-01-02')
			}
		]);
		const first = await service.loadTicketWorkspace(
			people.marcus,
			new URL('http://localhost/app/tickets?view=mine')
		);
		assert.equal(first.tickets.length, 50);
		assert.equal(first.tickets[0].preview, 'Public preview');
		assert(first.nextPageHref);
		const second = await service.loadTicketWorkspace(
			people.marcus,
			new URL(first.nextPageHref, 'http://localhost')
		);
		assert(second.tickets.some((row) => row.id === records[0].id));
		assert(!second.tickets.some((row) => first.tickets.some((previous) => previous.id === row.id)));
		assert(second.firstPageHref);
	} finally {
		await db
			.delete(schema.ticketComment)
			.where(eq(schema.ticketComment.ticketId, records[records.length - 1].id));
		await db.delete(schema.ticket).where(
			inArray(
				schema.ticket.id,
				records.map((row) => row.id)
			)
		);
	}
});

test('live suggestions protect private content and options only count visible comments', async () => {
	const { TicketSearchQuery } = await import('../src/lib/server/ticket-search');
	const privateQuery = new TicketSearchQuery('escalating');
	assert.equal(
		(await service.loadTicketSuggestions(people.priya, privateQuery))[0].ticketNumber,
		1046
	);
	assert.deepEqual(await service.loadTicketSuggestions(people.marcus, privateQuery), []);
	assert.deepEqual(
		await service.loadTicketSuggestions(people.rosa, new TicketSearchQuery('1046')),
		[]
	);
	const optionsUrl = new URL(
		'http://localhost/app/tickets?view=all&requester=marcus&hasComments=true'
	);
	const result = await service.loadTicketWorkspace(people.priya, optionsUrl);
	assert(result.tickets.length > 0);
	assert(result.tickets.every((record) => record.requesterId === 'marcus'));
	optionsUrl.searchParams.set('after', '2099-01-01');
	assert.deepEqual((await service.loadTicketWorkspace(people.priya, optionsUrl)).tickets, []);
});

test('managed roles persist permissions, protect administration, and reassign users atomically', async () => {
	const { saveRole, deleteRole, loadRoles, applyRolePermissions } =
		await import('../src/lib/server/roles');
	const { updateManagedUser } = await import('../src/lib/server/administration');
	const { eq } = await import('drizzle-orm');
	const roleId = await saveRole('jordan', {
		id: '',
		name: 'Technician',
		permissions: ['viewAllTickets', 'setTicketStatus']
	});
	await updateManagedUser('jordan', {
		id: 'rosa',
		name: people.rosa.name,
		email: people.rosa.email,
		role: roleId,
		enabled: true
	});
	const [assignedPerson] = await db.select().from(schema.user).where(eq(schema.user.id, 'rosa'));
	let actor = applyRolePermissions(assignedPerson, await loadRoles());
	assert(permissions.hasPermission(actor, 'setTicketStatus'));
	assert(!permissions.hasPermission(actor, 'useInternalNotes'));
	await saveRole('jordan', { id: roleId, name: 'Service Desk', permissions: [] });
	actor = applyRolePermissions(assignedPerson, await loadRoles());
	assert.equal(actor.roleName, 'Service Desk');
	assert(!permissions.hasPermission(actor, 'setTicketStatus'));
	await assert.rejects(() =>
		service.updateTicketField(actor, 1046, form({ field: 'statusCode', value: 'resolved' }))
	);
	await assert.rejects(() => saveRole('jordan', { id: 'admin', name: 'Changed', permissions: [] }));
	await assert.rejects(() =>
		saveRole('jordan', { id: '', name: 'Escalated', permissions: ['manageAdministration'] })
	);
	await assert.rejects(() =>
		saveRole('jordan', { id: '', name: 'Invalid', permissions: ['forged'] })
	);
	await assert.rejects(() => deleteRole('jordan', 'admin', 'requester'));
	await assert.rejects(() => deleteRole('jordan', roleId, ''));
	assert((await loadRoles()).some((role) => role.id === roleId));
	await db.insert(schema.session).values({
		id: 'role-test-session',
		token: 'role-test-token',
		userId: 'rosa',
		expiresAt: new Date(Date.now() + 60000)
	});
	await deleteRole('jordan', roleId, 'requester');
	const [reassigned] = await db.select().from(schema.user).where(eq(schema.user.id, 'rosa'));
	assert.equal(reassigned.role, 'requester');
	assert.equal(
		(await db.select().from(schema.session).where(eq(schema.session.userId, 'rosa'))).length,
		0
	);
	assert(!(await loadRoles()).some((role) => role.id === roleId));
});
test('staff edit a ticket subject and description with timeline events; requesters cannot', async () => {
	const isForbidden = (e: unknown) =>
		typeof e === 'object' && e !== null && 'status' in e && e.status === 403;
	await assert.rejects(
		() =>
			service.editTicketContent(
				people.marcus,
				1046,
				form({ field: 'subject', value: 'Requester rewrite' })
			),
		isForbidden
	);
	// An earlier test reopens 1039, so it's closed again here.
	await service.updateTicketField(
		people.priya,
		1039,
		form({ field: 'statusCode', value: 'closed' })
	);
	await assert.rejects(
		() =>
			service.editTicketContent(people.priya, 1039, form({ field: 'subject', value: 'Closed' })),
		isForbidden
	);

	const url = new URL('http://localhost/app/tickets');
	const before = (await service.loadTicketWorkspace(people.priya, url, '1046')).selectedTicket!;
	await service.editTicketContent(
		people.priya,
		1046,
		form({ field: 'subject', value: 'Laptop drops Wi-Fi after sleep' })
	);
	await service.editTicketContent(
		people.priya,
		1046,
		form({ field: 'description', value: 'Drops **every** time the lid closes.' })
	);
	const after = await service.loadTicketWorkspace(people.marcus, url, '1046');
	assert.equal(after.selectedTicket!.subject, 'Laptop drops Wi-Fi after sleep');
	assert.equal(after.selectedTicket!.description, 'Drops **every** time the lid closes.');
	assert.equal(after.selectedTicket!.descriptionFormat, 'markdown');
	const subjectEvent = after.events.find((e) => e.eventType === 'subject');
	assert.deepEqual(subjectEvent?.details, {
		from: before.subject,
		to: 'Laptop drops Wi-Fi after sleep'
	});
	// The requester sees that the description changed, without a copy of the old text.
	const descriptionEvent = after.events.find((e) => e.eventType === 'description');
	assert.deepEqual(descriptionEvent?.details, {});
	// Saving an untouched plain-text description, which the editor shows as Markdown, is a no-op.
	const { eq } = await import('drizzle-orm');
	const { convertPlainTextToMarkdown } =
		await import('../src/lib/ticket-content/ticket-content-format');
	await db
		.update(schema.ticket)
		.set({ description: 'Plain text * kept as typed', descriptionFormat: 'plain' })
		.where(eq(schema.ticket.ticketNumber, 1046));
	await service.editTicketContent(
		people.priya,
		1046,
		form({
			field: 'description',
			value: convertPlainTextToMarkdown('Plain text * kept as typed')
		})
	);
	const untouched = await service.loadTicketWorkspace(people.priya, url, '1046');
	assert.equal(untouched.selectedTicket!.descriptionFormat, 'plain');
	assert.equal(untouched.events.filter((e) => e.eventType === 'description').length, 1);
});
test('notifications reach followers and chosen people only, and respect note privacy', async () => {
	const notifications = await import('../src/lib/server/notifications');
	const [cat] = await db.select().from(schema.category);
	const created = await service.createTicket(
		people.priya,
		form({
			subject: 'Projector flickers',
			description: 'Room 204',
			categoryId: cat.id,
			requesterId: 'marcus',
			assignedToUserId: 'jordan'
		})
	);
	const inboxKinds = async (personId: string) =>
		(await notifications.loadInbox(people[personId], false)).map((item) => item.kind);
	assert.deepEqual(await inboxKinds('jordan'), ['assigned']);

	// The requester's comment goes to the followers: here the assignee, never the commenter.
	await service.addTicketComment(
		people.marcus,
		created.ticketNumber,
		form({ body: 'Still flickering' })
	);
	assert.deepEqual(await inboxKinds('jordan'), ['comment', 'assigned']);
	assert.deepEqual(await inboxKinds('priya'), []);

	// A chosen list keeps only connected people; an internal note never reaches the requester.
	const noteForm = form({ body: 'Swap the HDMI cable', internal: 'true', follow: 'true' });
	noteForm.set('notifySelection', 'custom');
	for (const recipientId of ['marcus', 'jordan', 'rosa'])
		noteForm.append('notifyRecipientId', recipientId);
	await service.addTicketComment(people.priya, created.ticketNumber, noteForm);
	assert.deepEqual(await inboxKinds('jordan'), ['internal_note', 'comment', 'assigned']);
	assert.deepEqual(await inboxKinds('rosa'), []);
	assert.deepEqual(await inboxKinds('marcus'), []);
	const followerIds = await notifications.loadFollowerIds(db, created.id);
	assert(followerIds.includes('priya'));

	// Resolving tells the requester; marking read clears the unread count.
	await service.updateTicketField(
		people.priya,
		created.ticketNumber,
		form({ field: 'statusCode', value: 'resolved' })
	);
	assert.deepEqual(await inboxKinds('marcus'), ['status']);
	assert.equal(await notifications.countUnreadNotifications(people.marcus), 1);
	await notifications.markNotificationsRead(people.marcus);
	assert.equal(await notifications.countUnreadNotifications(people.marcus), 0);
});
