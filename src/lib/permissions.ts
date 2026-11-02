import type { PersonRole } from './person';

/** Shared by the UI and server. Change a role's capabilities here, never in browser state. */
export type Permission =
	| 'viewAllTickets'
	| 'createTicketsForOthers'
	| 'assignTickets'
	| 'receiveAssignments'
	| 'setTicketPriority'
	| 'setTicketStatus'
	| 'setTicketCategory'
	| 'useInternalNotes'
	| 'reopenOwnResolvedTickets'
	| 'reopenClosedTickets'
	| 'manageAdministration';

const SUPPORT_PERMISSIONS: readonly Permission[] = [
	'viewAllTickets',
	'createTicketsForOthers',
	'assignTickets',
	'receiveAssignments',
	'setTicketPriority',
	'setTicketStatus',
	'setTicketCategory',
	'useInternalNotes',
	'reopenOwnResolvedTickets'
];

export const ROLE_PERMISSIONS: Readonly<Record<PersonRole, readonly Permission[]>> = {
	requester: ['reopenOwnResolvedTickets'],
	agent: SUPPORT_PERMISSIONS,
	admin: [...SUPPORT_PERMISSIONS, 'reopenClosedTickets', 'manageAdministration']
};

/** Unknown or missing roles have no permissions. */
export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
	if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
	return ROLE_PERMISSIONS[role as PersonRole].includes(permission);
}
