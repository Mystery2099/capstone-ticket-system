/**
 * Ticket followers and inbox notifications. Notifications are written in the same transaction
 * as the change they describe, and only to people who may see that change. The inbox checks
 * access again when it's read, so losing access to a ticket also hides its notifications.
 */
import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { NotificationKind } from '../notifications';
import { hasPermission } from '../permissions';
import type { Person } from './access';
import { db } from './db';
import { applyRolePermissions, loadRoles } from './roles';
import { notification, ticket, ticketComment, ticketFollower, user } from './schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ticket = typeof ticket.$inferSelect;

/** How many inbox items one page shows. */
const INBOX_PAGE_SIZE = 50;

export type TicketNotification = {
	recipientIds: readonly string[];
	ticketRecord: Ticket;
	actorId: string;
	kind: NotificationKind;
	commentId?: string;
	details?: Record<string, unknown>;
};

/** Adds someone to a ticket's followers. Following twice changes nothing. */
export async function followTicket(
	transaction: Transaction,
	ticketId: string,
	userId: string
): Promise<void> {
	await transaction.insert(ticketFollower).values({ ticketId, userId }).onConflictDoNothing();
}

/**
 * Everyone connected to a ticket: its followers, requester, assignee and past commenters.
 * Anyone commenting may choose who to notify from these people.
 */
export async function loadConnectedPersonIds(
	connection: Pick<Transaction, 'select'>,
	ticketRecord: Ticket
): Promise<Set<string>> {
	const [followers, commenters] = await Promise.all([
		connection
			.select({ userId: ticketFollower.userId })
			.from(ticketFollower)
			.where(eq(ticketFollower.ticketId, ticketRecord.id)),
		connection
			.selectDistinct({ userId: ticketComment.authorId })
			.from(ticketComment)
			.where(eq(ticketComment.ticketId, ticketRecord.id))
	]);
	const connectedPersonIds = new Set<string>([ticketRecord.requesterId]);
	if (ticketRecord.assignedToUserId) connectedPersonIds.add(ticketRecord.assignedToUserId);
	for (const { userId } of [...followers, ...commenters]) connectedPersonIds.add(userId);
	return connectedPersonIds;
}

/** The ticket's followers, who are notified when nobody chooses otherwise. */
export async function loadFollowerIds(
	connection: Pick<Transaction, 'select'>,
	ticketId: string
): Promise<string[]> {
	const followers = await connection
		.select({ userId: ticketFollower.userId })
		.from(ticketFollower)
		.where(eq(ticketFollower.ticketId, ticketId));
	return followers.map(({ userId }) => userId);
}

/**
 * Whether a person may read what a notification of this kind points at: the ticket itself,
 * and for internal notes, the support team's private notes too.
 */
export function canReceiveNotification(
	person: Pick<Person, 'id' | 'role' | 'banned' | 'permissions'>,
	ticketRecord: Pick<Ticket, 'requesterId'>,
	kind: NotificationKind
): boolean {
	if (person.banned) return false;
	if (!hasPermission(person, 'viewAllTickets') && ticketRecord.requesterId !== person.id)
		return false;
	return kind !== NotificationKind.INTERNAL_NOTE || hasPermission(person, 'useInternalNotes');
}

/**
 * Writes a notification for each recipient who may see it. The person who made the change is
 * never notified about their own change.
 */
export async function notifyPeople(
	transaction: Transaction,
	ticketNotification: TicketNotification
): Promise<void> {
	const candidateIds = [...new Set(ticketNotification.recipientIds)].filter(
		(recipientId) => recipientId !== ticketNotification.actorId
	);
	if (!candidateIds.length) return;
	const [roles, candidates] = await Promise.all([
		loadRoles(transaction),
		transaction
			.select({ id: user.id, role: user.role, banned: user.banned })
			.from(user)
			.where(inArray(user.id, candidateIds))
	]);
	const recipients = candidates
		.map((candidate) => applyRolePermissions(candidate, roles))
		.filter((candidate) =>
			canReceiveNotification(candidate, ticketNotification.ticketRecord, ticketNotification.kind)
		);
	if (!recipients.length) return;
	await transaction.insert(notification).values(
		recipients.map((recipient) => ({
			recipientId: recipient.id,
			ticketId: ticketNotification.ticketRecord.id,
			actorId: ticketNotification.actorId,
			kind: ticketNotification.kind,
			commentId: ticketNotification.commentId ?? null,
			details: ticketNotification.details ?? {}
		}))
	);
}

/** The conditions that keep a person's inbox to notifications they may still see. */
function buildVisibleNotificationConditions(actor: Person): SQL[] {
	const visibleNotificationConditions: SQL[] = [eq(notification.recipientId, actor.id)];
	if (!hasPermission(actor, 'viewAllTickets'))
		visibleNotificationConditions.push(eq(ticket.requesterId, actor.id));
	if (!hasPermission(actor, 'useInternalNotes'))
		visibleNotificationConditions.push(
			sql`${notification.kind} <> ${NotificationKind.INTERNAL_NOTE}`
		);
	return visibleNotificationConditions;
}

/** How many unread notifications a person has, for the sidebar. */
export async function countUnreadNotifications(actor: Person): Promise<number> {
	const [{ unreadCount }] = await db
		.select({ unreadCount: sql<number>`count(*)::int` })
		.from(notification)
		.innerJoin(ticket, eq(ticket.id, notification.ticketId))
		.where(and(...buildVisibleNotificationConditions(actor), isNull(notification.readAt)));
	return unreadCount;
}

/**
 * Loads a person's newest notifications, with the ticket and who made the change.
 *
 * @param isUnreadOnly leave out notifications already read
 */
export async function loadInbox(actor: Person, isUnreadOnly: boolean) {
	return db
		.select({
			id: notification.id,
			kind: notification.kind,
			details: notification.details,
			createdAt: notification.createdAt,
			readAt: notification.readAt,
			ticketNumber: ticket.ticketNumber,
			ticketSubject: ticket.subject,
			actorName: user.name
		})
		.from(notification)
		.innerJoin(ticket, eq(ticket.id, notification.ticketId))
		.leftJoin(user, eq(user.id, notification.actorId))
		.where(
			and(
				...buildVisibleNotificationConditions(actor),
				...(isUnreadOnly ? [isNull(notification.readAt)] : [])
			)
		)
		.orderBy(desc(notification.createdAt), desc(notification.id))
		.limit(INBOX_PAGE_SIZE);
}

/**
 * Marks notifications read: one, or all of them when no id is given. A person can only mark
 * their own notifications.
 */
export async function markNotificationsRead(actor: Person, notificationId?: string): Promise<void> {
	await db
		.update(notification)
		.set({ readAt: new Date() })
		.where(
			and(
				eq(notification.recipientId, actor.id),
				isNull(notification.readAt),
				...(notificationId ? [eq(notification.id, notificationId)] : [])
			)
		);
}

/** Opening a ticket reads its notifications, so they leave the inbox without a separate step. */
export async function markTicketNotificationsRead(actor: Person, ticketId: string): Promise<void> {
	await db
		.update(notification)
		.set({ readAt: new Date() })
		.where(
			and(
				eq(notification.recipientId, actor.id),
				eq(notification.ticketId, ticketId),
				isNull(notification.readAt)
			)
		);
}

/**
 * The people a commenter may notify on a ticket, with what they may read. The composer shows
 * these as choices; the server checks the choice again when the comment is posted.
 */
export async function loadNotificationAudience(ticketRecord: Ticket) {
	const connectedPersonIds = await loadConnectedPersonIds(db, ticketRecord);
	const [roles, people, followerIds] = await Promise.all([
		loadRoles(),
		db
			.select({ id: user.id, name: user.name, role: user.role, banned: user.banned })
			.from(user)
			.where(inArray(user.id, [...connectedPersonIds])),
		loadFollowerIds(db, ticketRecord.id)
	]);
	const followerIdSet = new Set(followerIds);
	return people
		.map((person) => applyRolePermissions(person, roles))
		.filter((person) => canReceiveNotification(person, ticketRecord, NotificationKind.COMMENT))
		.map((person) => ({
			id: person.id,
			name: person.name,
			isFollower: followerIdSet.has(person.id),
			canReadInternalNotes: hasPermission(person, 'useInternalNotes'),
			isRequester: person.id === ticketRecord.requesterId,
			isAssignee: person.id === ticketRecord.assignedToUserId
		}))
		.sort((first, second) => first.name.localeCompare(second.name));
}
