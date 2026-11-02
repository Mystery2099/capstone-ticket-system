export const TICKET_STATUSES = {
	open: { label: 'Open', symbol: '○' },
	in_progress: { label: 'In progress', symbol: '◐' },
	on_hold: { label: 'On hold', symbol: 'Ⅱ' },
	resolved: { label: 'Resolved', symbol: '✓' },
	closed: { label: 'Closed', symbol: '●' }
} as const;
export type Status = keyof typeof TICKET_STATUSES;

/** Statuses that count as open: anything not resolved or closed. */
export const OPEN_STATUSES: readonly Status[] = ['open', 'in_progress', 'on_hold'];

/** Activity recorded on a ticket. Field changes use the field's own name instead. */
export const TicketEventType = {
	CREATED: 'created',
	REPLY: 'reply',
	INTERNAL_NOTE: 'internal_note',
	STATUS: 'status'
} as const;

/** The first letters of up to two names, for avatars. */
export function getInitials(name: string): string {
	return name
		.split(' ')
		.map((word) => word[0])
		.slice(0, 2)
		.join('');
}
