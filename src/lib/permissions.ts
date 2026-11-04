import type { PersonRole } from './person';

/** Capability names shared by the UI and server. Saved role grants live in the database. */
export type Permission =
	| 'viewAllTickets'
	| 'createTicketsForOthers'
	| 'assignTickets'
	| 'receiveAssignments'
	| 'setTicketPriority'
	| 'setTicketStatus'
	| 'setTicketCategory'
	| 'editTicketContent'
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
	'editTicketContent',
	'useInternalNotes',
	'reopenOwnResolvedTickets'
];

export const ROLE_PERMISSIONS: Readonly<Record<PersonRole, readonly Permission[]>> = {
	requester: ['reopenOwnResolvedTickets'],
	agent: SUPPORT_PERMISSIONS,
	admin: [...SUPPORT_PERMISSIONS, 'reopenClosedTickets', 'manageAdministration']
};

/** Only hydrated request subjects authorize actions; missing grants fail closed. */
export type PermissionSubject = { role: string | null; permissions?: readonly Permission[] };

export function hasPermission(
	subject: PermissionSubject | null | undefined,
	permission: Permission
): boolean {
	return subject?.permissions?.includes(permission) ?? false;
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
	editTicketContent: 'Edit ticket subject and description',
	useInternalNotes: 'Read and write internal notes',
	reopenOwnResolvedTickets: 'Reopen own resolved tickets',
	reopenClosedTickets: 'Reopen closed tickets',
	manageAdministration: 'Manage administration'
};
