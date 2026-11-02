/**
 * Ticket changes: creating tickets, replying, and updating fields. Each change checks
 * permissions first, and changes to an existing ticket run while holding a lock on it.
 */
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { TicketEventType } from '../status';
import { isStaff, requireTicketAccess, type Person } from './access';
import { db } from './db';
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
