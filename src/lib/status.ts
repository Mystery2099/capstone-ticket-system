export const statuses = {
	open: { label: 'Open', symbol: '○' },
	in_progress: { label: 'In progress', symbol: '◐' },
	on_hold: { label: 'On hold', symbol: 'Ⅱ' },
	resolved: { label: 'Resolved', symbol: '✓' },
	closed: { label: 'Closed', symbol: '●' }
} as const;
export type Status = keyof typeof statuses;
export const initials = (name: string) =>
	name
		.split(' ')
		.map((n) => n[0])
		.slice(0, 2)
		.join('');
