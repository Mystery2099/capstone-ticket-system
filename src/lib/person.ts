/** Display helpers for people: avatars and role names. */

export type PersonRole = 'requester' | 'agent' | 'admin';

export const ROLE_OPTIONS: { value: PersonRole; label: string }[] = [
	{ value: 'requester', label: 'Requester' },
	{ value: 'agent', label: 'Agent' },
	{ value: 'admin', label: 'Administrator' }
];

/** The display name of a role. Accounts without a role are requesters. */
export function getRoleLabel(role: string | null | undefined): string {
	return ROLE_OPTIONS.find((roleOption) => roleOption.value === role)?.label ?? 'Requester';
}

/** The first letters of up to two names, for avatars. */
export function getInitials(name: string): string {
	return name
		.split(' ')
		.map((word) => word[0])
		.slice(0, 2)
		.join('');
}
