/**
 * Ticket changes: creating tickets, replying, and updating fields. Each change checks
 * permissions first, and changes to an existing ticket run while holding a lock on it.
 */
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { TicketEventType } from '../status';
import {
	TicketContentFormat,
	convertPlainTextToMarkdown
} from '../ticket-content/ticket-content-format';
import { requireTicketAccess, type Person } from './access';
import { hasPermission, type Permission } from '../permissions';
import { db } from './db';
import { applyRolePermissions, loadRoles } from './roles';
import { ticket, category, user, ticketComment, ticketEvent } from './schema';
import {
	createTicketSchema,
	parseFormInput,
	parseTicketNumber,
	parseTicketUpdateField,
	parseTicketUpdateValue,
	commentSchema
} from './validation';

type Ticket = typeof ticket.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Creates a ticket. Staff may open it for someone else and assign it straight away.
 *
 * @throws 403 when a requester sets a priority, requester or assignee
 * @throws 400 when the category, requester or assignee isn't valid
 */
export async function createTicket(actor: Person, formData: FormData): Promise<Ticket> {
	// Permission first: requesters may only create tickets at Normal priority.
	if (
		!hasPermission(actor, 'setTicketPriority') &&
		formData.has('priority') &&
		formData.get('priority') !== 'normal'
	)
		error(403, 'Requesters create tickets at Normal priority.');
	// Staff can open tickets for someone else. Everyone else is always their own requester.
	const requesterId = String(formData.get('requesterId') || actor.id);
	if (requesterId !== actor.id && !hasPermission(actor, 'createTicketsForOthers'))
		error(403, 'Only support staff can open tickets for someone else.');
	const assignedToUserId = String(formData.get('assignedToUserId') || '') || null;
	if (assignedToUserId && !hasPermission(actor, 'assignTickets'))
		error(403, 'Only support staff can assign tickets.');

	const requestedStatus = String(formData.get('statusCode') ?? 'open');
	if (requestedStatus !== 'open' && !hasPermission(actor, 'setTicketStatus'))
		error(403, 'You cannot choose the initial ticket status.');
	const statusCode = parseTicketUpdateValue('statusCode', requestedStatus);
	const priority = parseTicketUpdateValue('priority', String(formData.get('priority') ?? 'normal'));
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
		requireEligibleTicketAssignee(
			assignee ? applyRolePermissions(assignee, await loadRoles()) : undefined
		);
	}

	return db.transaction(async (transaction) => {
		const [createdTicket] = await transaction
			.insert(ticket)
			.values({
				subject,
				description,
				categoryId,
				priority,
				requesterId,
				assignedToUserId,
				statusCode,
				resolvedAt: statusCode === 'resolved' ? new Date() : null,
				closedAt: statusCode === 'closed' ? new Date() : null
			})
			.returning();
		await transaction.insert(ticketEvent).values([
			{
				ticketId: createdTicket.id,
				actorId: actor.id,
				eventType: TicketEventType.CREATED,
				details: { statusCode, priority }
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
function requireEligibleTicketAssignee(person: Person | undefined): void {
	if (!person || person.banned || !hasPermission(person, 'receiveAssignments'))
		error(400, 'Choose an enabled agent or administrator.');
}

/** Writes a comment and its activity event, once the ticket is locked. */
async function insertTicketCommentAndActivity(
	transaction: Transaction,
	actor: Person,
	ticketRecord: Ticket,
	formData: FormData
): Promise<void> {
	if (ticketRecord.statusCode === 'closed') error(403, 'Closed tickets are read-only.');
	const isInternal = formData.get('internal') === 'true';
	if (isInternal && !hasPermission(actor, 'useInternalNotes'))
		error(403, 'Internal notes are for the support team.');
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
async function applyTicketFieldChange(
	transaction: Transaction,
	actor: Person,
	ticketRecord: Ticket,
	formData: FormData
): Promise<void> {
	const ticketField = parseTicketUpdateField(String(formData.get('field')));
	const requestedFieldValue = String(formData.get('value') || '');

	// Permission checks keep precedence over value validation.
	const isReopeningTicket =
		ticketField === 'statusCode' &&
		requestedFieldValue === 'open' &&
		(ticketRecord.statusCode === 'resolved' || ticketRecord.statusCode === 'closed');
	if (
		ticketRecord.statusCode === 'closed' &&
		!(hasPermission(actor, 'reopenClosedTickets') && isReopeningTicket)
	)
		error(403, 'You do not have permission to reopen a Closed ticket.');
	const isReopeningOwnResolvedTicket =
		isReopeningTicket &&
		ticketRecord.statusCode === 'resolved' &&
		ticketRecord.requesterId === actor.id &&
		hasPermission(actor, 'reopenOwnResolvedTickets');
	const requiredPermissionByTicketField: Record<typeof ticketField, Permission> = {
		statusCode: 'setTicketStatus',
		priority: 'setTicketPriority',
		categoryId: 'setTicketCategory',
		assignedToUserId: 'assignTickets'
	};
	const canReopenClosedTicket =
		isReopeningTicket &&
		ticketRecord.statusCode === 'closed' &&
		hasPermission(actor, 'reopenClosedTickets');
	if (
		!hasPermission(actor, requiredPermissionByTicketField[ticketField]) &&
		!isReopeningOwnResolvedTicket &&
		!canReopenClosedTicket
	)
		error(403, 'You cannot change this ticket.');

	const validatedFieldValue = parseTicketUpdateValue(ticketField, requestedFieldValue);
	if (ticketField === 'categoryId') {
		const [activeCategory] = await transaction
			.select()
			.from(category)
			.where(and(eq(category.id, validatedFieldValue), eq(category.active, true)));
		if (!activeCategory) error(400, 'Choose an active category.');
	}
	if (ticketField === 'assignedToUserId' && requestedFieldValue) {
		const [assignee] = await transaction
			.select()
			.from(user)
			.where(eq(user.id, requestedFieldValue));
		requireEligibleTicketAssignee(
			assignee ? applyRolePermissions(assignee, await loadRoles(transaction)) : undefined
		);
	}

	const previousFieldValue = ticketRecord[ticketField];
	const nextFieldValue = validatedFieldValue || null;
	if (previousFieldValue === nextFieldValue) return;
	const statusTimestamps =
		ticketField === 'statusCode'
			? {
					resolvedAt: requestedFieldValue === 'resolved' ? new Date() : null,
					closedAt: requestedFieldValue === 'closed' ? new Date() : null
				}
			: {};
	await transaction
		.update(ticket)
		.set({ [ticketField]: nextFieldValue, updatedAt: new Date(), ...statusTimestamps })
		.where(eq(ticket.id, ticketRecord.id));
	await transaction.insert(ticketEvent).values({
		ticketId: ticketRecord.id,
		actorId: actor.id,
		eventType: ticketField === 'statusCode' ? TicketEventType.STATUS : ticketField,
		details: { from: previousFieldValue, to: nextFieldValue }
	});
}

/**
 * Rewrites a ticket's subject or description, once the ticket is locked. The new subject is
 * kept in the event, as subjects are short and public. A description edit only records that
 * it happened, so the event never holds a copy of a long message.
 */
async function applyTicketContentEdit(
	transaction: Transaction,
	actor: Person,
	ticketRecord: Ticket,
	formData: FormData
): Promise<void> {
	// Permission checks keep precedence over value validation.
	if (!hasPermission(actor, 'editTicketContent')) error(403, 'You cannot edit this ticket.');
	if (ticketRecord.statusCode === 'closed') error(403, 'Closed tickets are read-only.');
	const contentField = String(formData.get('field'));
	if (contentField === TicketEventType.SUBJECT) {
		const { subject } = parseFormInput(createTicketSchema.pick({ subject: true }), {
			subject: formData.get('value')
		});
		if (subject === ticketRecord.subject) return;
		await transaction
			.update(ticket)
			.set({ subject, updatedAt: new Date() })
			.where(eq(ticket.id, ticketRecord.id));
		await transaction.insert(ticketEvent).values({
			ticketId: ticketRecord.id,
			actorId: actor.id,
			eventType: TicketEventType.SUBJECT,
			details: { from: ticketRecord.subject, to: subject }
		});
	} else if (contentField === TicketEventType.DESCRIPTION) {
		const { description } = parseFormInput(createTicketSchema.pick({ description: true }), {
			description: formData.get('value')
		});
		// A plain-text description opens in the editor as Markdown, so compare it that way too.
		// Saving it untouched then changes nothing and adds no "edited" event.
		const storedDescriptionAsMarkdown =
			ticketRecord.descriptionFormat === TicketContentFormat.PLAIN
				? convertPlainTextToMarkdown(ticketRecord.description).trim()
				: ticketRecord.description;
		if (description === storedDescriptionAsMarkdown) return;
		// The editor always writes Markdown, so an edited plain-text description becomes Markdown.
		await transaction
			.update(ticket)
			.set({ description, descriptionFormat: TicketContentFormat.MARKDOWN, updatedAt: new Date() })
			.where(eq(ticket.id, ticketRecord.id));
		await transaction.insert(ticketEvent).values({
			ticketId: ticketRecord.id,
			actorId: actor.id,
			eventType: TicketEventType.DESCRIPTION,
			details: {}
		});
	} else error(400, 'Invalid field.');
}

/**
 * Runs a change against a ticket with its row locked for the whole transaction.
 *
 * @throws 404 when the ticket doesn't exist or the actor may not see it
 */
async function executeWithLockedTicket(
	actor: Person,
	ticketNumber: number,
	applyTicketChange: (transaction: Transaction, ticketRecord: Ticket) => Promise<void>
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
		return applyTicketChange(transaction, ticketRecord);
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
	return executeWithLockedTicket(actor, ticketNumber, (transaction, ticketRecord) =>
		insertTicketCommentAndActivity(transaction, actor, ticketRecord, formData)
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
	return executeWithLockedTicket(actor, ticketNumber, (transaction, ticketRecord) =>
		applyTicketFieldChange(transaction, actor, ticketRecord, formData)
	);
}

/**
 * Edits a ticket's subject or description.
 *
 * @throws 403 when the actor may not edit tickets, or the ticket is closed
 * @throws 400 when the field or new text isn't valid
 */
export async function editTicketContent(
	actor: Person,
	ticketNumber: number,
	formData: FormData
): Promise<void> {
	return executeWithLockedTicket(actor, ticketNumber, (transaction, ticketRecord) =>
		applyTicketContentEdit(transaction, actor, ticketRecord, formData)
	);
}
