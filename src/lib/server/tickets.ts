import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, or, ilike, lt, sql, type SQL } from 'drizzle-orm';
import { OPEN_STATUSES, TicketEventType } from '../status';
import { db } from './db';
import { ticket, category, user, ticketComment, ticketEvent } from './schema';
import {
	createTicketSchema,
	parseForm,
	parseTicketNumber,
	parseTicketUpdateField,
	parseTicketUpdateValue,
	commentSchema
} from './validation';

/** Longest search text sent to the database. */
const MAX_SEARCH_LENGTH = 200;
const TICKET_PAGE_SIZE = 50;

export type Person = typeof user.$inferSelect;
type Ticket = typeof ticket.$inferSelect;
type Category = typeof category.$inferSelect;
type Comment = typeof ticketComment.$inferSelect;
type TicketEvent = typeof ticketEvent.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function isStaff(person: Person): boolean {
	return person.role === 'agent' || person.role === 'admin';
}

/**
 * Returns the signed-in person, or rejects the request.
 *
 * @throws 401 when nobody is signed in or the account is disabled
 */
export function requireUser(person: Person | null): Person {
	if (!person || person.banned) error(401, 'Please sign in.');
	return person;
}

/**
 * Checks that a person may see a ticket.
 *
 * @throws 404 rather than 403, so requesters can't tell which ticket numbers exist
 */
export function requireTicketAccess(actor: Person, record: Ticket): void {
	if (!isStaff(actor) && record.requesterId !== actor.id) error(404, 'Ticket not found.');
}

/** Builds the WHERE conditions for a view, its filters and the search box. */
function buildListConditions(
	actor: Person,
	url: URL,
	view: string,
	categories: Category[],
	people: Pick<Person, 'id' | 'name'>[]
): (SQL | undefined)[] {
	const conditions: (SQL | undefined)[] = [];
	if (!isStaff(actor)) conditions.push(eq(ticket.requesterId, actor.id));
	if (view === 'mine') conditions.push(eq(ticket.requesterId, actor.id));
	if (view === 'queue') conditions.push(eq(ticket.assignedToUserId, actor.id));
	if (view === 'unassigned') conditions.push(sql`${ticket.assignedToUserId} is null`);
	if (['open', 'queue', 'unassigned'].includes(view))
		conditions.push(inArray(ticket.statusCode, [...OPEN_STATUSES]));

	const filters = [
		['status', ticket.statusCode],
		['priority', ticket.priority],
		['category', ticket.categoryId]
	] as const;
	for (const [parameter, column] of filters) {
		const value = url.searchParams.get(parameter);
		if (!value) continue;
		if (parameter === 'category' && !categories.some((item) => item.id === value)) continue;
		conditions.push(eq(column, value));
	}

	const search = url.searchParams.get('q')?.slice(0, MAX_SEARCH_LENGTH);
	if (search) {
		const lowerSearch = search.toLowerCase();
		const matchingPeople = people
			.filter((person) => person.name.toLowerCase().includes(lowerSearch))
			.map((person) => person.id);
		conditions.push(
			or(
				ilike(ticket.subject, `%${search}%`),
				ilike(ticket.description, `%${search}%`),
				sql`cast(${ticket.ticketNumber} as text) = ${search.replace('#', '')}`,
				matchingPeople.length ? inArray(ticket.requesterId, matchingPeople) : sql`false`
			)
		);
	}
	return conditions;
}

/** Loads one ticket's conversation, leaving out private content for requesters. */
async function loadConversation(
	actor: Person,
	ticketNumber: string
): Promise<{ record: Ticket; comments: Comment[]; events: TicketEvent[] }> {
	const number = parseTicketNumber(Number(ticketNumber));
	const [record] = await db.select().from(ticket).where(eq(ticket.ticketNumber, number));
	if (!record) error(404, 'Ticket not found.');
	requireTicketAccess(actor, record);

	const staffOnly = isStaff(actor);
	const comments = await db
		.select()
		.from(ticketComment)
		.where(
			and(
				eq(ticketComment.ticketId, record.id),
				...(staffOnly ? [] : [eq(ticketComment.isInternal, false)])
			)
		)
		.orderBy(asc(ticketComment.createdAt));
	const events = await db
		.select()
		.from(ticketEvent)
		.where(
			and(
				eq(ticketEvent.ticketId, record.id),
				...(staffOnly ? [] : [sql`${ticketEvent.eventType} <> ${TicketEventType.INTERNAL_NOTE}`])
			)
		)
		.orderBy(asc(ticketEvent.createdAt));
	return { record, comments, events };
}

/**
 * Loads everything the ticket screen needs: the filtered list, plus the open ticket if any.
 *
 * @param id the ticket number from the URL, or `new` for the compose pane
 * @throws 404 when the ticket doesn't exist or the actor may not see it
 */
export async function loadTicketWorkspace(actor: Person, url: URL, id?: string) {
	const categories = await db.select().from(category).orderBy(asc(category.name));
	const people = await db
		.select({ id: user.id, name: user.name, role: user.role, banned: user.banned })
		.from(user);
	const view = url.searchParams.get('view') || (isStaff(actor) ? 'open' : 'mine');
	const conditions = buildListConditions(actor, url, view, categories, people);

	const before = url.searchParams.get('before');
	if (before) conditions.push(lt(ticket.ticketNumber, parseTicketNumber(Number(before))));
	// Drafts live in the browser, so that view has no tickets to fetch.
	const matchingTickets =
		view === 'drafts'
			? []
			: await db
					.select()
					.from(ticket)
					.where(and(...conditions))
					.orderBy(desc(ticket.ticketNumber))
					.limit(TICKET_PAGE_SIZE + 1);
	const hasMoreTickets = matchingTickets.length > TICKET_PAGE_SIZE;
	const tickets = matchingTickets.slice(0, TICKET_PAGE_SIZE);
	const nextPage = new URL(url);
	nextPage.pathname = '/app/tickets';
	if (tickets.length)
		nextPage.searchParams.set('before', String(tickets[tickets.length - 1].ticketNumber));
	const firstPage = new URL(url);
	firstPage.pathname = '/app/tickets';
	firstPage.searchParams.delete('before');
	const publicComments = tickets.length
		? await db
				.selectDistinctOn([ticketComment.ticketId])
				.from(ticketComment)
				.where(
					and(
						inArray(
							ticketComment.ticketId,
							tickets.map((item) => item.id)
						),
						eq(ticketComment.isInternal, false)
					)
				)
				.orderBy(ticketComment.ticketId, desc(ticketComment.createdAt), desc(ticketComment.id))
		: [];
	const rows = tickets.map((item) => {
		const latest = publicComments.find((comment) => comment.ticketId === item.id);
		const author = people.find((person) => person.id === latest?.authorId);
		return {
			...item,
			preview: latest?.body || item.description,
			previewAuthor: latest ? author?.name.split(' ')[0] || 'Support team' : null
		};
	});

	let selected: Ticket | null = null;
	let comments: Comment[] = [];
	let events: TicketEvent[] = [];
	if (id && id !== 'new') {
		const conversation = await loadConversation(actor, id);
		selected = conversation.record;
		comments = conversation.comments;
		events = conversation.events;
	}

	const assigneeId = selected?.assignedToUserId;
	const visiblePeople = isStaff(actor)
		? people
		: people.filter(
				(person) =>
					person.id === actor.id ||
					comments.some((comment) => comment.authorId === person.id) ||
					person.id === assigneeId
			);
	return {
		tickets: rows,
		nextPageHref: hasMoreTickets ? nextPage.pathname + nextPage.search : null,
		firstPageHref: before ? firstPage.pathname + firstPage.search : null,
		categories,
		people: visiblePeople,
		selected,
		comments,
		events,
		view,
		isNew: id === 'new'
	};
}

/**
 * Creates a ticket. Staff may open it for someone else and assign it straight away.
 *
 * @throws 403 when a requester sets a priority, requester or assignee
 * @throws 400 when the category, requester or assignee isn't valid
 */
export async function createTicket(actor: Person, formData: FormData): Promise<Ticket> {
	// Permission first: requesters may only create tickets at Normal priority.
	if (!isStaff(actor) && formData.has('priority') && formData.get('priority') !== 'normal')
		error(403, 'Requesters create tickets at Normal priority.');
	// Staff can open tickets for someone else. Everyone else is always their own requester.
	const requesterId = String(formData.get('requesterId') || actor.id);
	if (requesterId !== actor.id && !isStaff(actor))
		error(403, 'Only support staff can open tickets for someone else.');
	const assignedToUserId = String(formData.get('assignedToUserId') || '') || null;
	if (assignedToUserId && !isStaff(actor)) error(403, 'Only support staff can assign tickets.');

	const { subject, description, categoryId } = parseForm(createTicketSchema, {
		subject: formData.get('subject'),
		description: formData.get('description'),
		categoryId: formData.get('categoryId')
	});
	const [activeCategory] = await db
		.select()
		.from(category)
		.where(and(eq(category.id, categoryId), eq(category.active, true)));
	if (!activeCategory) error(400, 'Choose an active category.');
	if (requesterId !== actor.id) {
		const [requester] = await db
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.id, requesterId), eq(user.banned, false)));
		if (!requester) error(400, 'Choose an enabled requester.');
	}
	if (assignedToUserId) {
		const [assignee] = await db.select().from(user).where(eq(user.id, assignedToUserId));
		requireAssignable(assignee);
	}

	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(ticket)
			.values({ subject, description, categoryId, requesterId, assignedToUserId })
			.returning();
		await tx.insert(ticketEvent).values([
			{ ticketId: created.id, actorId: actor.id, eventType: TicketEventType.CREATED, details: {} },
			// Logged like a later assignment, so it shows up in the ticket's activity.
			...(assignedToUserId
				? [
						{
							ticketId: created.id,
							actorId: actor.id,
							eventType: 'assignedToUserId',
							details: { from: null, to: assignedToUserId }
						}
					]
				: [])
		]);
		return created;
	});
}

/** @throws 400 unless the person is an enabled agent or administrator */
function requireAssignable(person: Person | undefined): void {
	if (!person || person.banned || !isStaff(person))
		error(400, 'Choose an enabled agent or administrator.');
}

/** Writes a comment and its activity event, once the ticket is locked. */
async function insertComment(
	tx: Transaction,
	actor: Person,
	record: Ticket,
	formData: FormData
): Promise<void> {
	if (record.statusCode === 'closed') error(403, 'Closed tickets are read-only.');
	const isInternal = formData.get('internal') === 'true';
	if (isInternal && !isStaff(actor)) error(403, 'Internal notes are for the support team.');
	const { body } = parseForm(commentSchema, { body: formData.get('body') });

	await tx
		.insert(ticketComment)
		.values({ ticketId: record.id, authorId: actor.id, body, isInternal });
	await tx.insert(ticketEvent).values({
		ticketId: record.id,
		actorId: actor.id,
		eventType: isInternal ? TicketEventType.INTERNAL_NOTE : TicketEventType.REPLY,
		details: {}
	});
	await tx.update(ticket).set({ updatedAt: new Date() }).where(eq(ticket.id, record.id));
}

/** Validates and writes a field change and its activity event, once the ticket is locked. */
async function applyFieldChange(
	tx: Transaction,
	actor: Person,
	record: Ticket,
	formData: FormData
): Promise<void> {
	const field = parseTicketUpdateField(String(formData.get('field')));
	const value = String(formData.get('value') || '');

	// Permission checks keep precedence over value validation.
	const isReopening =
		field === 'statusCode' &&
		value === 'open' &&
		(record.statusCode === 'resolved' || record.statusCode === 'closed');
	if (record.statusCode === 'closed' && !(actor.role === 'admin' && isReopening))
		error(403, 'Only an administrator can reopen a Closed ticket.');
	const isOwnResolvedReopen =
		isReopening && record.statusCode === 'resolved' && record.requesterId === actor.id;
	if (!isStaff(actor) && !isOwnResolvedReopen) error(403, 'You cannot change this ticket.');

	const validatedValue = parseTicketUpdateValue(field, value);
	if (field === 'categoryId') {
		const [activeCategory] = await tx
			.select()
			.from(category)
			.where(and(eq(category.id, validatedValue), eq(category.active, true)));
		if (!activeCategory) error(400, 'Choose an active category.');
	}
	if (field === 'assignedToUserId' && value) {
		const [assignee] = await tx.select().from(user).where(eq(user.id, value));
		requireAssignable(assignee);
	}

	const previous = record[field];
	const next = validatedValue || null;
	if (previous === next) return;
	const statusDates =
		field === 'statusCode'
			? {
					resolvedAt: value === 'resolved' ? new Date() : null,
					closedAt: value === 'closed' ? new Date() : null
				}
			: {};
	await tx
		.update(ticket)
		.set({ [field]: next, updatedAt: new Date(), ...statusDates })
		.where(eq(ticket.id, record.id));
	await tx.insert(ticketEvent).values({
		ticketId: record.id,
		actorId: actor.id,
		eventType: field === 'statusCode' ? TicketEventType.STATUS : field,
		details: { from: previous, to: next }
	});
}

/**
 * Runs a change against a ticket with its row locked for the whole transaction.
 *
 * @throws 404 when the ticket doesn't exist or the actor may not see it
 */
async function withLockedTicket(
	actor: Person,
	ticketNumber: number,
	applyChange: (tx: Transaction, record: Ticket) => Promise<void>
): Promise<void> {
	// Malformed or out-of-range numbers simply mean the ticket does not exist.
	parseTicketNumber(ticketNumber);
	return db.transaction(async (tx) => {
		const [record] = await tx
			.select()
			.from(ticket)
			.where(eq(ticket.ticketNumber, ticketNumber))
			.for('update');
		if (!record) error(404, 'Ticket not found.');
		requireTicketAccess(actor, record);
		return applyChange(tx, record);
	});
}

/**
 * Adds a public comment or an internal note to a ticket.
 *
 * @throws 403 when the ticket is closed, or a requester posts an internal note
 */
export async function addTicketComment(
	actor: Person,
	ticketNumber: number,
	formData: FormData
): Promise<void> {
	return withLockedTicket(actor, ticketNumber, (tx, record) =>
		insertComment(tx, actor, record, formData)
	);
}

/**
 * Changes one metadata field on a ticket.
 *
 * @throws 403 when the actor isn't allowed to make this change
 * @throws 400 when the new value isn't valid
 */
export async function updateTicketField(
	actor: Person,
	ticketNumber: number,
	formData: FormData
): Promise<void> {
	return withLockedTicket(actor, ticketNumber, (tx, record) =>
		applyFieldChange(tx, actor, record, formData)
	);
}
