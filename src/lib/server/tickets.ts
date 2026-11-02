import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { OPEN_STATUSES, TicketEventType } from '../status';
import { isStaff, type Person } from './access';
import { db } from './db';
import { ticket, category, user, ticketComment, ticketEvent } from './schema';
import { TicketSearchQuery, type TicketSearchHighlight } from './ticket-search';
import {
	createTicketSchema,
	parseFormInput,
	parseTicketNumber,
	parseTicketUpdateField,
	parseTicketUpdateValue,
	commentSchema
} from './validation';

const TICKET_PAGE_SIZE = 50;

type Ticket = typeof ticket.$inferSelect;
type Category = typeof category.$inferSelect;
type TicketComment = typeof ticketComment.$inferSelect;
type TicketEvent = typeof ticketEvent.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Checks that a person may see a ticket.
 *
 * @throws 404 rather than 403, so requesters can't tell which ticket numbers exist
 */
export function requireTicketAccess(actor: Person, ticketRecord: Ticket): void {
	if (!isStaff(actor) && ticketRecord.requesterId !== actor.id) error(404, 'Ticket not found.');
}

/**
 * Returns where a search should go instead of the results: the ticket itself, when the
 * search is a ticket number the actor may open. Otherwise the search runs as usual, so
 * requesters can't tell which ticket numbers exist.
 */
export async function findTicketSearchRedirect(actor: Person, url: URL): Promise<string | null> {
	const searchQuery = TicketSearchQuery.fromUrl(url);
	if (searchQuery?.ticketNumber == null) return null;
	const [ticketRecord] = await db
		.select()
		.from(ticket)
		.where(eq(ticket.ticketNumber, searchQuery.ticketNumber));
	if (!ticketRecord) return null;
	if (!isStaff(actor) && ticketRecord.requesterId !== actor.id) return null;
	const redirectUrl = new URL(url);
	redirectUrl.pathname = `/app/tickets/${ticketRecord.ticketNumber}`;
	redirectUrl.searchParams.delete('q');
	redirectUrl.searchParams.delete('before');
	redirectUrl.searchParams.delete('page');
	return redirectUrl.pathname + redirectUrl.search;
}

/** Builds the WHERE conditions for a view, its filters and the search box. */
function buildTicketListConditions(
	actor: Person,
	url: URL,
	view: string,
	categories: Category[],
	searchQuery: TicketSearchQuery | null
): (SQL | undefined)[] {
	const conditions: (SQL | undefined)[] = [];
	if (!isStaff(actor)) conditions.push(eq(ticket.requesterId, actor.id));
	if (view === 'mine') conditions.push(eq(ticket.requesterId, actor.id));
	if (view === 'queue') conditions.push(eq(ticket.assignedToUserId, actor.id));
	if (view === 'unassigned') conditions.push(sql`${ticket.assignedToUserId} is null`);
	// A search also finds resolved and closed tickets, unless a status filter says otherwise.
	if (!searchQuery && ['open', 'queue', 'unassigned'].includes(view))
		conditions.push(inArray(ticket.statusCode, [...OPEN_STATUSES]));

	for (const parameter of ['requester', 'assignee']) {
		const value = url.searchParams.get(parameter);
		if (value === 'none' && parameter === 'assignee')
			conditions.push(sql`${ticket.assignedToUserId} is null`);
		else if (value)
			conditions.push(
				eq(parameter === 'requester' ? ticket.requesterId : ticket.assignedToUserId, value)
			);
	}
	for (const parameter of ['after', 'beforeDate']) {
		const value = url.searchParams.get(parameter);
		if (
			!value ||
			!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
			!Number.isFinite(Date.parse(value)) ||
			new Date(value).toISOString().slice(0, 10) !== value
		)
			continue;
		conditions.push(
			parameter === 'after'
				? sql`${ticket.createdAt} >= ${value}::date`
				: sql`${ticket.createdAt} < ${value}::date + interval '1 day'`
		);
	}
	if (url.searchParams.get('hasComments') === 'true')
		conditions.push(sql`exists (
		select 1 from ${ticketComment} where ${ticketComment.ticketId} = ${ticket.id}
		and ${isStaff(actor) ? sql`true` : sql`${ticketComment.isInternal} = false`}
	)`);
	const filters = [
		['status', ticket.statusCode],
		['priority', ticket.priority],
		['category', ticket.categoryId]
	] as const;
	for (const [parameter, column] of filters) {
		const value = url.searchParams.get(parameter);
		if (!value) continue;
		if (parameter === 'category' && !categories.some((candidate) => candidate.id === value))
			continue;
		conditions.push(eq(column, value));
	}

	if (searchQuery) conditions.push(searchQuery.buildMatchCondition(isStaff(actor)));
	return conditions;
}

/** Loads one ticket's conversation, leaving out private content for requesters. */
async function loadConversation(
	actor: Person,
	ticketNumber: string
): Promise<{ ticketRecord: Ticket; comments: TicketComment[]; events: TicketEvent[] }> {
	const parsedTicketNumber = parseTicketNumber(Number(ticketNumber));
	const [ticketRecord] = await db
		.select()
		.from(ticket)
		.where(eq(ticket.ticketNumber, parsedTicketNumber));
	if (!ticketRecord) error(404, 'Ticket not found.');
	requireTicketAccess(actor, ticketRecord);

	const canViewInternalContent = isStaff(actor);
	const comments = await db
		.select()
		.from(ticketComment)
		.where(
			and(
				eq(ticketComment.ticketId, ticketRecord.id),
				...(canViewInternalContent ? [] : [eq(ticketComment.isInternal, false)])
			)
		)
		.orderBy(asc(ticketComment.createdAt));
	const events = await db
		.select()
		.from(ticketEvent)
		.where(
			and(
				eq(ticketEvent.ticketId, ticketRecord.id),
				...(canViewInternalContent
					? []
					: [sql`${ticketEvent.eventType} <> ${TicketEventType.INTERNAL_NOTE}`])
			)
		)
		.orderBy(asc(ticketEvent.createdAt));
	return { ticketRecord, comments, events };
}

/**
 * Loads everything the ticket screen needs: the filtered list, plus the open ticket if any.
 *
 * @param routeTicketId the ticket number from the URL, or `new` for the compose pane
 * @throws 404 when the ticket doesn't exist or the actor may not see it
 */
export async function loadTicketWorkspace(actor: Person, url: URL, routeTicketId?: string) {
	const categories = await db.select().from(category).orderBy(asc(category.name));
	const people = await db
		.select({ id: user.id, name: user.name, role: user.role, banned: user.banned })
		.from(user);
	const view = url.searchParams.get('view') || (isStaff(actor) ? 'open' : 'mine');
	const searchQuery = TicketSearchQuery.fromUrl(url);
	const canViewInternalContent = isStaff(actor);
	const conditions = buildTicketListConditions(actor, url, view, categories, searchQuery);
	const searchSort = searchQuery && url.searchParams.get('sort') !== 'newest' ? 'relevance' : null;

	// Newest-first lists page from the last ticket number shown. Relevance order pages by page number.
	const beforeTicketNumber = searchSort ? null : url.searchParams.get('before');
	if (beforeTicketNumber)
		conditions.push(lt(ticket.ticketNumber, parseTicketNumber(Number(beforeTicketNumber))));
	const requestedPageNumber = Number(url.searchParams.get('page'));
	const pageNumber =
		searchSort && Number.isSafeInteger(requestedPageNumber) && requestedPageNumber > 0
			? Math.min(requestedPageNumber, 1000000)
			: 1;
	// Drafts live in the browser, so that view has no tickets to fetch.
	const matchingTickets =
		view === 'drafts'
			? []
			: await db
					.select()
					.from(ticket)
					.where(and(...conditions))
					.orderBy(
						...(searchQuery && searchSort
							? [desc(searchQuery.buildRankExpression(canViewInternalContent))]
							: []),
						desc(ticket.ticketNumber)
					)
					.limit(TICKET_PAGE_SIZE + 1)
					.offset((pageNumber - 1) * TICKET_PAGE_SIZE);
	const hasMoreTickets = matchingTickets.length > TICKET_PAGE_SIZE;
	const tickets = matchingTickets.slice(0, TICKET_PAGE_SIZE);
	const nextPageUrl = new URL(url);
	nextPageUrl.pathname = '/app/tickets';
	if (searchSort) nextPageUrl.searchParams.set('page', String(pageNumber + 1));
	else if (tickets.length)
		nextPageUrl.searchParams.set('before', String(tickets[tickets.length - 1].ticketNumber));
	const firstPageUrl = new URL(url);
	firstPageUrl.pathname = '/app/tickets';
	firstPageUrl.searchParams.delete('before');
	firstPageUrl.searchParams.delete('page');
	const searchHighlights = searchQuery
		? await searchQuery.loadHighlights(
				tickets.map((ticketRecord) => ticketRecord.id),
				canViewInternalContent
			)
		: new Map<string, TicketSearchHighlight>();
	const latestPublicComments = tickets.length
		? await db
				.selectDistinctOn([ticketComment.ticketId])
				.from(ticketComment)
				.where(
					and(
						inArray(
							ticketComment.ticketId,
							tickets.map((ticketRecord) => ticketRecord.id)
						),
						eq(ticketComment.isInternal, false)
					)
				)
				.orderBy(ticketComment.ticketId, desc(ticketComment.createdAt), desc(ticketComment.id))
		: [];
	const ticketRows = tickets.map((ticketRecord) => {
		const latestPublicComment = latestPublicComments.find(
			(comment) => comment.ticketId === ticketRecord.id
		);
		const searchHighlight = searchHighlights.get(ticketRecord.id);
		const previewAuthorId = searchHighlight?.snippetSegments
			? searchHighlight.snippetAuthorId
			: latestPublicComment?.authorId;
		const previewAuthor = people.find((person) => person.id === previewAuthorId);
		return {
			...ticketRecord,
			preview: latestPublicComment?.body || ticketRecord.description,
			previewAuthor: previewAuthorId ? previewAuthor?.name.split(' ')[0] || 'Support team' : null,
			subjectHighlight: searchHighlight?.subjectSegments ?? null,
			previewHighlight: searchHighlight?.snippetSegments ?? null,
			searchMetadataMatches: searchHighlight?.metadataMatches ?? []
		};
	});

	let selectedTicket: Ticket | null = null;
	let comments: TicketComment[] = [];
	let events: TicketEvent[] = [];
	if (routeTicketId && routeTicketId !== 'new') {
		const conversation = await loadConversation(actor, routeTicketId);
		selectedTicket = conversation.ticketRecord;
		comments = conversation.comments;
		events = conversation.events;
	}

	const assigneeId = selectedTicket?.assignedToUserId;
	const visiblePeople = isStaff(actor)
		? people
		: people.filter(
				(person) =>
					person.id === actor.id ||
					comments.some((comment) => comment.authorId === person.id) ||
					person.id === assigneeId
			);
	return {
		tickets: ticketRows,
		nextPageHref: hasMoreTickets ? nextPageUrl.pathname + nextPageUrl.search : null,
		firstPageHref:
			beforeTicketNumber || pageNumber > 1 ? firstPageUrl.pathname + firstPageUrl.search : null,
		searchText: searchQuery?.searchText ?? null,
		searchSort,
		categories,
		people: visiblePeople,
		selectedTicket,
		comments,
		events,
		view,
		isNewTicket: routeTicketId === 'new'
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

	const { subject, description, categoryId } = parseFormInput(createTicketSchema, {
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

	return db.transaction(async (transaction) => {
		const [createdTicket] = await transaction
			.insert(ticket)
			.values({ subject, description, categoryId, requesterId, assignedToUserId })
			.returning();
		await transaction.insert(ticketEvent).values([
			{
				ticketId: createdTicket.id,
				actorId: actor.id,
				eventType: TicketEventType.CREATED,
				details: {}
			},
			// Logged like a later assignment, so it shows up in the ticket's activity.
			...(assignedToUserId
				? [
						{
							ticketId: createdTicket.id,
							actorId: actor.id,
							eventType: 'assignedToUserId',
							details: { from: null, to: assignedToUserId }
						}
					]
				: [])
		]);
		return createdTicket;
	});
}

/** @throws 400 unless the person is an enabled agent or administrator */
function requireAssignable(person: Person | undefined): void {
	if (!person || person.banned || !isStaff(person))
		error(400, 'Choose an enabled agent or administrator.');
}

/** Writes a comment and its activity event, once the ticket is locked. */
async function insertComment(
	transaction: Transaction,
	actor: Person,
	ticketRecord: Ticket,
	formData: FormData
): Promise<void> {
	if (ticketRecord.statusCode === 'closed') error(403, 'Closed tickets are read-only.');
	const isInternal = formData.get('internal') === 'true';
	if (isInternal && !isStaff(actor)) error(403, 'Internal notes are for the support team.');
	const { body } = parseFormInput(commentSchema, { body: formData.get('body') });

	await transaction
		.insert(ticketComment)
		.values({ ticketId: ticketRecord.id, authorId: actor.id, body, isInternal });
	await transaction.insert(ticketEvent).values({
		ticketId: ticketRecord.id,
		actorId: actor.id,
		eventType: isInternal ? TicketEventType.INTERNAL_NOTE : TicketEventType.REPLY,
		details: {}
	});
	await transaction
		.update(ticket)
		.set({ updatedAt: new Date() })
		.where(eq(ticket.id, ticketRecord.id));
}

/** Validates and writes a field change and its activity event, once the ticket is locked. */
async function applyFieldChange(
	transaction: Transaction,
	actor: Person,
	ticketRecord: Ticket,
	formData: FormData
): Promise<void> {
	const field = parseTicketUpdateField(String(formData.get('field')));
	const rawValue = String(formData.get('value') || '');

	// Permission checks keep precedence over value validation.
	const isReopening =
		field === 'statusCode' &&
		rawValue === 'open' &&
		(ticketRecord.statusCode === 'resolved' || ticketRecord.statusCode === 'closed');
	if (ticketRecord.statusCode === 'closed' && !(actor.role === 'admin' && isReopening))
		error(403, 'Only an administrator can reopen a Closed ticket.');
	const isReopeningOwnResolvedTicket =
		isReopening && ticketRecord.statusCode === 'resolved' && ticketRecord.requesterId === actor.id;
	if (!isStaff(actor) && !isReopeningOwnResolvedTicket)
		error(403, 'You cannot change this ticket.');

	const validatedValue = parseTicketUpdateValue(field, rawValue);
	if (field === 'categoryId') {
		const [activeCategory] = await transaction
			.select()
			.from(category)
			.where(and(eq(category.id, validatedValue), eq(category.active, true)));
		if (!activeCategory) error(400, 'Choose an active category.');
	}
	if (field === 'assignedToUserId' && rawValue) {
		const [assignee] = await transaction.select().from(user).where(eq(user.id, rawValue));
		requireAssignable(assignee);
	}

	const previousValue = ticketRecord[field];
	const nextValue = validatedValue || null;
	if (previousValue === nextValue) return;
	const statusTimestamps =
		field === 'statusCode'
			? {
					resolvedAt: rawValue === 'resolved' ? new Date() : null,
					closedAt: rawValue === 'closed' ? new Date() : null
				}
			: {};
	await transaction
		.update(ticket)
		.set({ [field]: nextValue, updatedAt: new Date(), ...statusTimestamps })
		.where(eq(ticket.id, ticketRecord.id));
	await transaction.insert(ticketEvent).values({
		ticketId: ticketRecord.id,
		actorId: actor.id,
		eventType: field === 'statusCode' ? TicketEventType.STATUS : field,
		details: { from: previousValue, to: nextValue }
	});
}

/**
 * Runs a change against a ticket with its row locked for the whole transaction.
 *
 * @throws 404 when the ticket doesn't exist or the actor may not see it
 */
async function runWithLockedTicket(
	actor: Person,
	ticketNumber: number,
	applyChange: (transaction: Transaction, ticketRecord: Ticket) => Promise<void>
): Promise<void> {
	// Malformed or out-of-range numbers simply mean the ticket does not exist.
	parseTicketNumber(ticketNumber);
	return db.transaction(async (transaction) => {
		const [ticketRecord] = await transaction
			.select()
			.from(ticket)
			.where(eq(ticket.ticketNumber, ticketNumber))
			.for('update');
		if (!ticketRecord) error(404, 'Ticket not found.');
		requireTicketAccess(actor, ticketRecord);
		return applyChange(transaction, ticketRecord);
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
	return runWithLockedTicket(actor, ticketNumber, (transaction, ticketRecord) =>
		insertComment(transaction, actor, ticketRecord, formData)
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
	return runWithLockedTicket(actor, ticketNumber, (transaction, ticketRecord) =>
		applyFieldChange(transaction, actor, ticketRecord, formData)
	);
}

/** Returns only ticket content the actor may open, shared by the suggestion endpoint. */
export async function loadTicketSuggestions(actor: Person, query: TicketSearchQuery) {
	const includeInternalNotes = isStaff(actor);
	const tickets = await db
		.select({
			id: ticket.id,
			ticketNumber: ticket.ticketNumber,
			subject: ticket.subject,
			statusCode: ticket.statusCode
		})
		.from(ticket)
		.where(
			and(
				includeInternalNotes ? undefined : eq(ticket.requesterId, actor.id),
				query.buildMatchCondition(includeInternalNotes)
			)
		)
		.orderBy(desc(query.buildRankExpression(includeInternalNotes)), desc(ticket.ticketNumber))
		.limit(6);
	const highlights = await query.loadHighlights(
		tickets.map((record) => record.id),
		includeInternalNotes
	);
	return tickets.map((record) => ({ ...record, ...highlights.get(record.id) }));
}
