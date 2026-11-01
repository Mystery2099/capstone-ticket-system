import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { SIDEBAR_COOKIE_NAME } from '$lib/components/ui/sidebar/constants';
import { db } from '$lib/server/db';
import { category, ticket } from '$lib/server/schema';
import { OPEN_STATUSES, type Status } from '$lib/status';

export const load = async ({ locals, cookies }: ServerLoadEvent) => {
	const currentUser = locals.user;
	if (!currentUser) redirect(303, '/login');

	const [allTickets, categories] = await Promise.all([
		db
			.select({
				requesterId: ticket.requesterId,
				assignedToUserId: ticket.assignedToUserId,
				categoryId: ticket.categoryId,
				statusCode: ticket.statusCode
			})
			.from(ticket),
		db.select().from(category).orderBy(asc(category.name))
	]);
	const isStaff = currentUser.role !== 'requester';
	const visibleTickets = isStaff
		? allTickets
		: allTickets.filter((row) => row.requesterId === currentUser.id);
	const openTickets = visibleTickets.filter((row) =>
		OPEN_STATUSES.includes(row.statusCode as Status)
	);

	// Sidebar counts for staff. Open means not resolved or closed, the same as All open.
	// Inactive categories stay listed while they still hold open tickets.
	const openByCategory = isStaff
		? categories
				.map(({ id, name, active }) => ({
					id,
					name,
					active,
					count: openTickets.filter((row) => row.categoryId === id).length
				}))
				.filter((item) => item.active || item.count > 0)
		: [];

	return {
		user: currentUser,
		sidebarOpen: cookies.get(SIDEBAR_COOKIE_NAME) !== 'false',
		openByCategory,
		counts: {
			mine: visibleTickets.filter((row) => row.requesterId === currentUser.id).length,
			queue: openTickets.filter((row) => row.assignedToUserId === currentUser.id).length,
			unassigned: openTickets.filter((row) => !row.assignedToUserId).length,
			open: openTickets.length,
			all: visibleTickets.length
		}
	};
};
