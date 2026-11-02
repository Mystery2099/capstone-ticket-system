/**
 * Ticket reads: the workspace's list and open conversation, and search. Every read applies
 * the actor's access, so requesters only ever see their own tickets.
 */
import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { OPEN_STATUSES, TicketEventType } from '../status';
import { requireTicketAccess, type Person } from './access';
import { hasPermission } from '../permissions';
import { applyRolePermissions, loadRoles } from './roles';
import { db } from './db';
import { ticket, category, user, ticketComment, ticketEvent } from './schema';
import { TicketSearchQuery, type TicketSearchHighlight } from './ticket-search';
import { parseTicketNumber } from './validation';

const TICKET_PAGE_SIZE = 50;
/** List rows show the preview on one line, so longer comment text is never sent. */
const PREVIEW_MAX_LENGTH = 200;

type Ticket = typeof ticket.$inferSelect;
type Category = typeof category.$inferSelect;
type TicketComment = typeof ticketComment.$inferSelect;
type TicketEvent = typeof ticketEvent.$inferSelect;

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
	if (!hasPermission(actor, 'viewAllTickets') && ticketRecord.requesterId !== actor.id) return null;
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
	const ticketListConditions: (SQL | undefined)[] = [];
	if (!hasPermission(actor, 'viewAllTickets'))
		ticketListConditions.push(eq(ticket.requesterId, actor.id));
	if (view === 'mine') ticketListConditions.push(eq(ticket.requesterId, actor.id));
	if (view === 'queue') ticketListConditions.push(eq(ticket.assignedToUserId, actor.id));
	if (view === 'unassigned') ticketListConditions.push(sql`${ticket.assignedToUserId} is null`);
	// A search also finds resolved and closed tickets, unless a status filter says otherwise.
	if (!searchQuery && ['open', 'queue', 'unassigned'].includes(view))
		ticketListConditions.push(inArray(ticket.statusCode, [...OPEN_STATUSES]));

	for (const parameterName of ['requester', 'assignee']) {
		const parameterValue = url.searchParams.get(parameterName);
		if (parameterValue === 'none' && parameterName === 'assignee')
			ticketListConditions.push(sql`${ticket.assignedToUserId} is null`);
		else if (parameterValue)
			ticketListConditions.push(
				eq(
					parameterName === 'requester' ? ticket.requesterId : ticket.assignedToUserId,
					parameterValue
				)
			);
	}
	for (const parameterName of ['after', 'beforeDate']) {
		const parameterValue = url.searchParams.get(parameterName);
		if (
			!parameterValue ||
			!/^\d{4}-\d{2}-\d{2}$/.test(parameterValue) ||
			!Number.isFinite(Date.parse(parameterValue)) ||
			new Date(parameterValue).toISOString().slice(0, 10) !== parameterValue
		)
			continue;
		ticketListConditions.push(
			parameterName === 'after'
				? sql`${ticket.createdAt} >= ${parameterValue}::date`
				: sql`${ticket.createdAt} < ${parameterValue}::date + interval '1 day'`
		);
	}
	if (url.searchParams.get('hasComments') === 'true')
		ticketListConditions.push(sql`exists (
		select 1 from ${ticketComment} where ${ticketComment.ticketId} = ${ticket.id}
		and ${hasPermission(actor, 'useInternalNotes') ? sql`true` : sql`${ticketComment.isInternal} = false`}
	)`);
	const ticketColumnFilters = [
		['status', ticket.statusCode],
		['priority', ticket.priority],
		['category', ticket.categoryId]
	] as const;
	for (const [parameterName, ticketColumn] of ticketColumnFilters) {
		const parameterValue = url.searchParams.get(parameterName);
		if (!parameterValue) continue;
		if (
			parameterName === 'category' &&
			!categories.some((candidate) => candidate.id === parameterValue)
		)
			continue;
		ticketListConditions.push(eq(ticketColumn, parameterValue));
	}

	if (searchQuery)
		ticketListConditions.push(
			searchQuery.buildMatchCondition(hasPermission(actor, 'useInternalNotes'))
		);
	return ticketListConditions;
}

/** Loads one ticket's conversation, leaving out private content for requesters. */
async function loadAccessibleTicketConversation(
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

	const canViewInternalContent = hasPermission(actor, 'useInternalNotes');
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
 * Every search parameter that shapes the ticket list. Anything else in the URL, such as the
 * open ticket or a draft, belongs to the reading pane.
 */
const TICKET_LIST_PARAMETERS = [
	'view',
	'q',
	'sort',
	'status',
	'priority',
	'category',
	'requester',
	'assignee',
	'after',
	'beforeDate',
	'hasComments'
] as const;

/**
 * Builds a list href from the list's own parameters, plus an optional paging parameter.
 * Parameters are read one at a time, so SvelteKit reruns a load that calls this only when
 * one of them changes, not when another ticket is opened.
 */
function buildTicketListHref(
	url: URL,
	pagingParameter?: [name: string, parameterValue: string]
): string {
	const searchParams = new URLSearchParams();
	for (const parameterName of TICKET_LIST_PARAMETERS) {
		const parameterValue = url.searchParams.get(parameterName);
		if (parameterValue !== null) searchParams.set(parameterName, parameterValue);
	}
	if (pagingParameter) searchParams.set(...pagingParameter);
	const queryString = searchParams.toString();
	return '/app/tickets' + (queryString ? '?' + queryString : '');
}

/** Loads every person with their role's permissions, for names and assignment checks. */
async function loadPeopleWithRolePermissions() {
	const roles = await loadRoles();
	return (
		await db
			.select({ id: user.id, name: user.name, role: user.role, banned: user.banned })
			.from(user)
	).map((person) => applyRolePermissions(person, roles));
}
type PersonSummary = Awaited<ReturnType<typeof loadPeopleWithRolePermissions>>[number];

/**
 * Loads one batch of the ticket list for a view, its filters and the search box.
 *
 * Only reads `url.searchParams.get`, never the path or the whole query string, so the list
 * load is not rerun when someone opens another ticket. Keep it that way.
 *
 * @throws 404 when the `before` paging parameter isn't a ticket number
 */
export async function loadTicketList(actor: Person, url: URL) {
	const [categories, people] = await Promise.all([
		db.select().from(category).orderBy(asc(category.name)),
		loadPeopleWithRolePermissions()
	]);
	const view =
		url.searchParams.get('view') || (hasPermission(actor, 'viewAllTickets') ? 'open' : 'mine');
	const searchQuery = TicketSearchQuery.fromUrl(url);
	const canViewInternalContent = hasPermission(actor, 'useInternalNotes');
	const ticketListConditions = buildTicketListConditions(actor, url, view, categories, searchQuery);
	const searchSort = searchQuery && url.searchParams.get('sort') !== 'newest' ? 'relevance' : null;

	// Newest-first lists page from the last ticket number shown. Relevance order pages by page number.
	const beforeTicketNumber = searchSort ? null : url.searchParams.get('before');
	if (beforeTicketNumber)
		ticketListConditions.push(
			lt(ticket.ticketNumber, parseTicketNumber(Number(beforeTicketNumber)))
		);
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
					.where(and(...ticketListConditions))
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
	let nextPageHref: string | null = null;
	if (hasMoreTickets)
		nextPageHref = searchSort
			? buildTicketListHref(url, ['page', String(pageNumber + 1)])
			: buildTicketListHref(url, ['before', String(tickets[tickets.length - 1].ticketNumber)]);
	const searchHighlights = searchQuery
		? await searchQuery.loadHighlights(
				tickets.map((ticketRecord) => ticketRecord.id),
				canViewInternalContent
			)
		: new Map<string, TicketSearchHighlight>();
	const latestPublicComments = tickets.length
		? await db
				.selectDistinctOn([ticketComment.ticketId], {
					ticketId: ticketComment.ticketId,
					authorId: ticketComment.authorId,
					body: sql<string>`left(${ticketComment.body}, ${PREVIEW_MAX_LENGTH})`
				})
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

	return {
		tickets: ticketRows,
		nextPageHref,
		firstPageHref: beforeTicketNumber || pageNumber > 1 ? buildTicketListHref(url) : null,
		searchText: searchQuery?.searchText ?? null,
		searchSort,
		categories,
		view
	};
}

/**
 * Loads the reading pane: the open ticket and its conversation, if any, and the people the
 * actor may see by name.
 *
 * @param routeTicketId the ticket number from the URL, or `new` for the compose pane
 * @throws 404 when the ticket doesn't exist or the actor may not see it
 */
export async function loadTicketConversation(actor: Person, routeTicketId?: string) {
	const people = await loadPeopleWithRolePermissions();
	let selectedTicket: Ticket | null = null;
	let comments: TicketComment[] = [];
	let events: TicketEvent[] = [];
	if (routeTicketId && routeTicketId !== 'new') {
		const conversation = await loadAccessibleTicketConversation(actor, routeTicketId);
		selectedTicket = conversation.ticketRecord;
		comments = conversation.comments;
		events = conversation.events;
	}

	const assigneeId = selectedTicket?.assignedToUserId;
	const visiblePeople: PersonSummary[] =
		hasPermission(actor, 'viewAllTickets') ||
		hasPermission(actor, 'createTicketsForOthers') ||
		hasPermission(actor, 'assignTickets')
			? people
			: people.filter(
					(person) =>
						person.id === actor.id ||
						comments.some((comment) => comment.authorId === person.id) ||
						person.id === assigneeId
				);
	return {
		people: visiblePeople,
		selectedTicket,
		comments,
		events,
		isNewTicket: routeTicketId === 'new'
	};
}

/**
 * Loads everything the ticket screen needs: the filtered list, plus the open ticket if any.
 * The page loads the two halves separately; this joins them for callers that want both.
 *
 * @param routeTicketId the ticket number from the URL, or `new` for the compose pane
 * @throws 404 when the ticket doesn't exist or the actor may not see it
 */
export async function loadTicketWorkspace(actor: Person, url: URL, routeTicketId?: string) {
	const [ticketList, conversation] = await Promise.all([
		loadTicketList(actor, url),
		loadTicketConversation(actor, routeTicketId)
	]);
	return { ...ticketList, ...conversation };
}

/** Returns only ticket content the actor may open, shared by the suggestion endpoint. */
export async function loadTicketSuggestions(actor: Person, query: TicketSearchQuery) {
	const includeInternalNotes = hasPermission(actor, 'useInternalNotes');
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
