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
export type PermissionSubject = { role: string | null; permissions?: readonly Permission[] };

export function hasPermission(
	subject: string | PermissionSubject | null | undefined,
	permission: Permission
): boolean {
	if (subject && typeof subject === 'object')
		return subject.permissions?.includes(permission) ?? hasPermission(subject.role, permission);
	const role = subject;
	if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
	return ROLE_PERMISSIONS[role as PersonRole].includes(permission);
}

/** Human-readable labels for the role editor. Administration stays reserved for Administrator. */
export const PERMISSION_LABELS: Record<Permission, string> = {
	viewAllTickets: 'View all tickets',
	createTicketsForOthers: 'Create tickets for other users',
	assignTickets: 'Assign and unassign tickets',
	receiveAssignments: 'Receive ticket assignments',
	setTicketPriority: 'Set ticket priority',
	setTicketStatus: 'Set ticket status',
	setTicketCategory: 'Change ticket category',
	useInternalNotes: 'Read and write internal notes',
	reopenOwnResolvedTickets: 'Reopen own resolved tickets',
	reopenClosedTickets: 'Reopen closed tickets',
	manageAdministration: 'Manage administration'
};
