/**
 * Ticket followers and inbox notifications. Notifications are written in the same transaction
 * as the change they describe, and only to people who may see that change. The inbox checks
 * access again when it's read, so losing access to a ticket also hides its notifications.
 */
import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { NotificationKind } from '../notifications';
import { hasPermission, type PermissionSubject } from '../permissions';
import type { Person } from './access';
import { db } from './db';
import { applyRolePermissions, loadRoles } from './roles';
import { notification, ticket, ticketComment, ticketFollower, user } from './schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ticket = typeof ticket.$inferSelect;

/** How many inbox items one page shows. */
export const INBOX_PAGE_SIZE = 50;
/** An inbox page cursor: the exact creation time and id of the last item already shown. */
const INBOX_CURSOR_PATTERN =
	/^(.+)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

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
 * Everyone connected to a ticket whom the viewer may know about. Anyone commenting may choose
 * who to notify from these people.
 *
 * The support team sees the followers, requester, assignee and every commenter. Anyone who
 * can't read internal notes only sees who the conversation already shows them: the requester,
 * the assignee and public commenters. Otherwise the list would reveal staff who only left
 * internal notes or follow quietly.
 */
export async function loadConnectedPersonIds(
	connection: Pick<Transaction, 'select' | 'selectDistinct'>,
	ticketRecord: Ticket,
	viewer: PermissionSubject
): Promise<Set<string>> {
	const canSeeSupportTeamActivity = hasPermission(viewer, 'useInternalNotes');
	const [followers, commenters] = await Promise.all([
		canSeeSupportTeamActivity
			? connection
					.select({ userId: ticketFollower.userId })
					.from(ticketFollower)
					.where(eq(ticketFollower.ticketId, ticketRecord.id))
			: [],
		connection
			.selectDistinct({ userId: ticketComment.authorId })
			.from(ticketComment)
			.where(
				and(
					eq(ticketComment.ticketId, ticketRecord.id),
					...(canSeeSupportTeamActivity ? [] : [eq(ticketComment.isInternal, false)])
				)
			)
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
 * Loads a page of a person's notifications, newest first, with the ticket and who made the
 * change. Each item carries a `pageCursor`; passing the last one loads the page after it.
 *
 * @param isUnreadOnly leave out notifications already read
 * @param olderThanCursor a `pageCursor` from an earlier page; a malformed one is ignored
 */
export async function loadInbox(actor: Person, isUnreadOnly: boolean, olderThanCursor?: string) {
	const cursorMatch = olderThanCursor ? INBOX_CURSOR_PATTERN.exec(olderThanCursor) : null;
	return db
		.select({
			id: notification.id,
			// The database's own text for the time keeps every digit, so paging never skips a row.
			pageCursor: sql<string>`${notification.createdAt}::text || '|' || ${notification.id}::text`,
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
				...(isUnreadOnly ? [isNull(notification.readAt)] : []),
				...(cursorMatch
					? [
							sql`(${notification.createdAt}, ${notification.id}) < (${cursorMatch[1]}::timestamptz, ${cursorMatch[2]}::uuid)`
						]
					: [])
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

/** Whether a person has unread notifications about one ticket. Reads only, never marks. */
export async function hasUnreadTicketNotifications(
	actor: Person,
	ticketId: string
): Promise<boolean> {
	const [unreadNotification] = await db
		.select({ id: notification.id })
		.from(notification)
		.where(
			and(
				eq(notification.recipientId, actor.id),
				eq(notification.ticketId, ticketId),
				isNull(notification.readAt)
			)
		)
		.limit(1);
	return !!unreadNotification;
}

/**
 * Reads a ticket's notifications once the person has actually been shown the ticket, so they
 * leave the inbox without a separate step. The page calls this after it displays the
 * conversation; loading alone never does, since a load can run for a page never shown.
 *
 * Only notifications up to the newest activity the person was shown are read: one about a
 * comment posted while the page loaded stays unread. A notification and its activity event
 * are written in one transaction, so they share a timestamp.
 *
 * @param latestShownActivityAt when the newest activity event the person was shown happened
 * @return how many notifications this marked read
 */
export async function markTicketNotificationsRead(
	actor: Person,
	ticketNumber: number,
	latestShownActivityAt: Date
): Promise<number> {
	const readNotifications = await db
		.update(notification)
		.set({ readAt: new Date() })
		.where(
			and(
				eq(notification.recipientId, actor.id),
				sql`${notification.ticketId} = (select ${ticket.id} from ${ticket} where ${ticket.ticketNumber} = ${ticketNumber})`,
				isNull(notification.readAt),
				// The shown time came through JavaScript, which keeps milliseconds only.
				sql`date_trunc('milliseconds', ${notification.createdAt}) <= ${latestShownActivityAt.toISOString()}::timestamptz`
			)
		)
		.returning({ id: notification.id });
	return readNotifications.length;
}

/**
 * The people a commenter may notify on a ticket, with what they may read. The composer shows
 * these as choices; the server checks the choice again when the comment is posted.
 *
 * @return the people, and whether some followers are left out because the viewer may not
 *         know about them; a comment still notifies those followers unless people are chosen
 */
export async function loadNotificationAudience(viewer: Person, ticketRecord: Ticket) {
	const connectedPersonIds = await loadConnectedPersonIds(db, ticketRecord, viewer);
	const [roles, people, followerIds] = await Promise.all([
		loadRoles(),
		db
			.select({ id: user.id, name: user.name, role: user.role, banned: user.banned })
			.from(user)
			.where(inArray(user.id, [...connectedPersonIds])),
		loadFollowerIds(db, ticketRecord.id)
	]);
	const followerIdSet = new Set(followerIds);
	const hasHiddenFollowers = followerIds.some(
		(followerId) => followerId !== viewer.id && !connectedPersonIds.has(followerId)
	);
	const members = people
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
	return { members, hasHiddenFollowers };
}
