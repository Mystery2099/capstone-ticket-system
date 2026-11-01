import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { asc, eq, sql } from 'drizzle-orm';
import { SIDEBAR_COOKIE_NAME } from '$lib/components/ui/sidebar/constants';
import { db } from '$lib/server/db';
import { category, ticket } from '$lib/server/schema';
import { OPEN_STATUSES } from '$lib/status';

export const load = async ({ locals, cookies }: ServerLoadEvent) => {
	const currentUser = locals.user;
	if (!currentUser) redirect(303, '/login');

	const isStaff = currentUser.role === 'agent' || currentUser.role === 'admin';
	const [groups, categories] = await Promise.all([
		db
			.select({
				requesterId: ticket.requesterId,
				assignedToUserId: ticket.assignedToUserId,
				categoryId: ticket.categoryId,
				statusCode: ticket.statusCode,
				count: sql<number>`count(*)::int`
			})
			.from(ticket)
			.where(isStaff ? undefined : eq(ticket.requesterId, currentUser.id))
			.groupBy(ticket.requesterId, ticket.assignedToUserId, ticket.categoryId, ticket.statusCode),
		db.select().from(category).orderBy(asc(category.name))
	]);
	const openTickets = groups.filter((row) =>
		OPEN_STATUSES.some((status) => status === row.statusCode)
	);
	const countTickets = (rows: typeof groups): number =>
		rows.reduce((total, row) => total + row.count, 0);

	// Sidebar counts for staff. Open means not resolved or closed, the same as All open.
	// Inactive categories stay listed while they still hold open tickets.
	const openByCategory = isStaff
		? categories
				.map(({ id, name, active }) => ({
					id,
					name,
					active,
					count: countTickets(openTickets.filter((row) => row.categoryId === id))
				}))
				.filter((item) => item.active || item.count > 0)
		: [];

	return {
		user: currentUser,
		sidebarOpen: cookies.get(SIDEBAR_COOKIE_NAME) !== 'false',
		openByCategory,
		counts: {
			mine: countTickets(groups.filter((row) => row.requesterId === currentUser.id)),
			queue: countTickets(openTickets.filter((row) => row.assignedToUserId === currentUser.id)),
			unassigned: countTickets(openTickets.filter((row) => !row.assignedToUserId)),
			open: countTickets(openTickets),
			all: countTickets(groups)
		}
	};
};
