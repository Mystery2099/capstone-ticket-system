/**
 * What a notification says happened on a ticket. Shared by the server, which writes them, and
 * the inbox, which describes them.
 */
export const NotificationKind = {
	COMMENT: 'comment',
	INTERNAL_NOTE: 'internal_note',
	ASSIGNED: 'assigned',
	STATUS: 'status'
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

/** The inbox line after the person's name, for example "commented on". */
export const NOTIFICATION_ACTION_LABELS: Record<NotificationKind, string> = {
	[NotificationKind.COMMENT]: 'commented on',
	[NotificationKind.INTERNAL_NOTE]: 'added an internal note to',
	[NotificationKind.ASSIGNED]: 'assigned you',
	[NotificationKind.STATUS]: 'changed the status of'
};
