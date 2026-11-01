import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, or, ilike, sql } from 'drizzle-orm';
import { db } from './db';
import { ticket, category, user, ticketComment, ticketEvent } from './schema';
import {
	createTicketSchema,
	parseForm,
	parseTicketNumber,
	parseTicketUpdateField,
	parseTicketUpdateValue,
	replySchema
} from './validation';
export type Person = typeof user.$inferSelect;
export const staff = (u: Person) => u.role === 'agent' || u.role === 'admin';
export function requireUser(u: Person | null): Person {
	if (!u?.enabled) error(401, 'Please sign in.');
	return u;
}
export function authorize(u: Person, t: typeof ticket.$inferSelect) {
	if (!staff(u) && t.requesterId !== u.id) error(404, 'Ticket not found.');
}
export async function workspace(u: Person, url: URL, id?: string) {
	const cats = await db.select().from(category).orderBy(asc(category.name));
	const people = await db
		.select({ id: user.id, name: user.name, role: user.role, enabled: user.enabled })
		.from(user);
	const conditions = [];
	if (!staff(u)) conditions.push(eq(ticket.requesterId, u.id));
	const view = url.searchParams.get('view') || (staff(u) ? 'open' : 'mine');
	if (view === 'mine') conditions.push(eq(ticket.requesterId, u.id));
	if (view === 'queue') conditions.push(eq(ticket.assignedToUserId, u.id));
	if (view === 'unassigned') conditions.push(sql`${ticket.assignedToUserId} is null`);
	if (['open', 'queue', 'unassigned'].includes(view))
		conditions.push(inArray(ticket.statusCode, ['open', 'in_progress', 'on_hold']));
	for (const [key, col] of [
		['status', ticket.statusCode],
		['priority', ticket.priority],
		['category', ticket.categoryId]
	] as const) {
		const v = url.searchParams.get(key);
		if (v && (key !== 'category' || cats.some((c) => c.id === v))) conditions.push(eq(col, v));
	}
	const q = url.searchParams.get('q')?.slice(0, 200);
	if (q) {
		const personIds = people
			.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
			.map((p) => p.id);
		conditions.push(
			or(
				ilike(ticket.subject, `%${q}%`),
				ilike(ticket.description, `%${q}%`),
				sql`cast(${ticket.ticketNumber} as text) = ${q.replace('#', '')}`,
				personIds.length ? inArray(ticket.requesterId, personIds) : sql`false`
			)!
		);
	}
	// Drafts live in the browser, so that view has no tickets to fetch.
	const tickets =
		view === 'drafts'
			? []
			: await db
					.select()
					.from(ticket)
					.where(and(...conditions))
					.orderBy(desc(ticket.ticketNumber));
	const publicComments = tickets.length
		? await db
				.select()
				.from(ticketComment)
				.where(
					and(
						inArray(
							ticketComment.ticketId,
							tickets.map((t) => t.id)
						),
						eq(ticketComment.isInternal, false)
					)
				)
				.orderBy(desc(ticketComment.createdAt))
		: [];
	const rows = tickets.map((t) => {
		const latest = publicComments.find((c) => c.ticketId === t.id);
		return {
			...t,
			preview: latest?.body || t.description,
			previewAuthor: latest
				? people.find((p) => p.id === latest.authorId)?.name.split(' ')[0] || 'Support team'
				: null
		};
	});
	let selected = null;
	let comments: (typeof ticketComment.$inferSelect)[] = [];
	let events: (typeof ticketEvent.$inferSelect)[] = [];
	if (id && id !== 'new') {
		const number = parseTicketNumber(Number(id));
		const [t] = await db.select().from(ticket).where(eq(ticket.ticketNumber, number));
		if (!t) error(404, 'Ticket not found.');
		authorize(u, t);
		selected = t;
		comments = await db
			.select()
			.from(ticketComment)
			.where(
				and(
					eq(ticketComment.ticketId, t.id),
					...(!staff(u) ? [eq(ticketComment.isInternal, false)] : [])
				)
			)
			.orderBy(asc(ticketComment.createdAt));
		events = await db
			.select()
			.from(ticketEvent)
			.where(
				and(
					eq(ticketEvent.ticketId, t.id),
					...(!staff(u) ? [sql`${ticketEvent.eventType} <> 'internal_note'`] : [])
				)
			)
			.orderBy(asc(ticketEvent.createdAt));
	}
	return {
		tickets: rows,
		categories: cats,
		people: staff(u)
			? people
			: people.filter(
					(p) =>
						p.id === u.id ||
						comments.some((c) => c.authorId === p.id) ||
						p.id === selected?.assignedToUserId
				),
		selected,
		comments,
		events,
		view,
		isNew: id === 'new'
	};
}
export async function createTicket(u: Person, f: FormData) {
	// Permission first: requesters may only create tickets at Normal priority.
	if (!staff(u) && f.has('priority') && f.get('priority') !== 'normal')
		error(403, 'Requesters create tickets at Normal priority.');
	// Staff can open tickets for someone else. Everyone else is always their own requester.
	const requesterId = String(f.get('requesterId') || u.id);
	if (requesterId !== u.id && !staff(u))
		error(403, 'Only support staff can open tickets for someone else.');
	const assignedToUserId = String(f.get('assignedToUserId') || '') || null;
	if (assignedToUserId && !staff(u)) error(403, 'Only support staff can assign tickets.');
	const { subject, description, categoryId } = parseForm(createTicketSchema, {
		subject: f.get('subject'),
		description: f.get('description'),
		categoryId: f.get('categoryId')
	});
	const [cat] = await db
		.select()
		.from(category)
		.where(and(eq(category.id, categoryId), eq(category.active, true)));
	if (!cat) error(400, 'Choose an active category.');
	if (requesterId !== u.id) {
		const [requester] = await db
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.id, requesterId), eq(user.enabled, true)));
		if (!requester) error(400, 'Choose an enabled requester.');
	}
	if (assignedToUserId) {
		const [assignee] = await db.select().from(user).where(eq(user.id, assignedToUserId));
		if (!assignee?.enabled || !staff(assignee))
			error(400, 'Choose an enabled agent or administrator.');
	}
	return db.transaction(async (tx) => {
		const [t] = await tx
			.insert(ticket)
			.values({ subject, description, categoryId, requesterId, assignedToUserId })
			.returning();
		await tx.insert(ticketEvent).values([
			{ ticketId: t.id, actorId: u.id, eventType: 'created', details: {} },
			// Logged like a later assignment, so it shows up in the ticket's activity.
			...(assignedToUserId
				? [
						{
							ticketId: t.id,
							actorId: u.id,
							eventType: 'assignedToUserId',
							details: { from: null, to: assignedToUserId }
						}
					]
				: [])
		]);
		return t;
	});
}
export async function mutateTicket(
	u: Person,
	number: number,
	f: FormData,
	kind: 'reply' | 'update'
) {
	// Malformed or out-of-range numbers simply mean the ticket does not exist.
	parseTicketNumber(number);
	return db.transaction(async (tx) => {
		const [t] = await tx.select().from(ticket).where(eq(ticket.ticketNumber, number)).for('update');
		if (!t) error(404, 'Ticket not found.');
		authorize(u, t);
		if (kind === 'reply') {
			if (t.statusCode === 'closed') error(403, 'Closed tickets are read-only.');
			const internal = f.get('internal') === 'true';
			if (internal && !staff(u)) error(403, 'Internal notes are for the support team.');
			const { body } = parseForm(replySchema, { body: f.get('body') });
			await tx
				.insert(ticketComment)
				.values({ ticketId: t.id, authorId: u.id, body, isInternal: internal });
			await tx.insert(ticketEvent).values({
				ticketId: t.id,
				actorId: u.id,
				eventType: internal ? 'internal_note' : 'reply',
				details: {}
			});
			await tx.update(ticket).set({ updatedAt: new Date() }).where(eq(ticket.id, t.id));
			return;
		}
		const field = parseTicketUpdateField(String(f.get('field')));
		const value = String(f.get('value') || '');
		// Permission checks keep the original precedence over value validation;
		// reopen is derived from the raw value exactly as before.
		const reopen =
			field === 'statusCode' &&
			value === 'open' &&
			(t.statusCode === 'resolved' || t.statusCode === 'closed');
		if (t.statusCode === 'closed' && !(u.role === 'admin' && reopen))
			error(403, 'Only an administrator can reopen a Closed ticket.');
		if (!staff(u) && !(reopen && t.statusCode === 'resolved' && t.requesterId === u.id))
			error(403, 'You cannot change this ticket.');
		const validatedValue = parseTicketUpdateValue(field, value);
		if (field === 'categoryId') {
			const [c] = await tx
				.select()
				.from(category)
				.where(and(eq(category.id, validatedValue), eq(category.active, true)));
			if (!c) error(400, 'Choose an active category.');
		}
		if (field === 'assignedToUserId' && value) {
			const [p] = await tx.select().from(user).where(eq(user.id, value));
			if (!p?.enabled || !staff(p)) error(400, 'Choose an enabled agent or administrator.');
		}
		const old = t[field];
		const next = validatedValue || null;
		if (old === next) return;
		await tx
			.update(ticket)
			.set({
				[field]: next,
				updatedAt: new Date(),
				...(field === 'statusCode'
					? {
							resolvedAt: value === 'resolved' ? new Date() : null,
							closedAt: value === 'closed' ? new Date() : null
						}
					: {})
			})
			.where(eq(ticket.id, t.id));
		await tx.insert(ticketEvent).values({
			ticketId: t.id,
			actorId: u.id,
			eventType: field === 'statusCode' ? 'status' : field,
			details: { from: old, to: next }
		});
	});
}
