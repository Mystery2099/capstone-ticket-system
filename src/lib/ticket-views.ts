/** The ticket list's views, as named in the sidebar and the list heading. */
export const TICKET_VIEW_TITLES: Record<string, string> = {
	queue: 'My queue',
	unassigned: 'Unassigned',
	open: 'All open',
	all: 'All tickets',
	mine: 'My requests',
	drafts: 'Drafts'
};

/** The view shown when the URL names none: every open ticket for staff, otherwise their own. */
export function getDefaultTicketView(isStaffUser: boolean): string {
	return isStaffUser ? 'open' : 'mine';
}
