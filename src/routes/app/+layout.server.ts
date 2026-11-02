import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { asc, eq, sql } from 'drizzle-orm';
import { SIDEBAR_COOKIE_NAME } from '$lib/components/ui/sidebar/constants';
import { hasPermission } from '$lib/permissions';
import { db } from '$lib/server/db';
import { category, ticket, user } from '$lib/server/schema';
import { OPEN_STATUSES } from '$lib/status';

export const load = async ({ locals, cookies }: ServerLoadEvent) => {
	const currentUser = locals.user;
	if (!currentUser) redirect(303, '/login');

	const isStaffUser = hasPermission(currentUser, 'viewAllTickets');
	const [ticketCountGroups, categories] = await Promise.all([
		db
			.select({
				requesterId: ticket.requesterId,
				assignedToUserId: ticket.assignedToUserId,
				categoryId: ticket.categoryId,
				statusCode: ticket.statusCode,
				count: sql<number>`count(*)::int`
			})
			.from(ticket)
			.where(isStaffUser ? undefined : eq(ticket.requesterId, currentUser.id))
			.groupBy(ticket.requesterId, ticket.assignedToUserId, ticket.categoryId, ticket.statusCode),
		db.select().from(category).orderBy(asc(category.name))
	]);
	const openTicketGroups = ticketCountGroups.filter((row) =>
		OPEN_STATUSES.some((status) => status === row.statusCode)
	);
	const sumTicketCounts = (rows: typeof ticketCountGroups): number =>
		rows.reduce((total, row) => total + row.count, 0);

	// Sidebar counts for staff. Open means not resolved or closed, the same as All open.
	// Inactive categories stay listed while they still hold open tickets.
	const openTicketCountsByCategory = isStaffUser
		? categories
				.map(({ id, name, active }) => ({
					id,
					name,
					active,
					count: sumTicketCounts(openTicketGroups.filter((row) => row.categoryId === id))
				}))
				.filter((categorySummary) => categorySummary.active || categorySummary.count > 0)
		: [];

	return {
		user: currentUser,
		searchCategories: categories.map(({ id, name }) => ({ id, name })),
		searchPeople: isStaffUser
			? await db.select({ id: user.id, name: user.name }).from(user).orderBy(asc(user.name))
			: [],
		isSidebarOpen: cookies.get(SIDEBAR_COOKIE_NAME) !== 'false',
		openTicketCountsByCategory,
		ticketCounts: {
			mine: sumTicketCounts(ticketCountGroups.filter((row) => row.requesterId === currentUser.id)),
			queue: sumTicketCounts(
				openTicketGroups.filter((row) => row.assignedToUserId === currentUser.id)
			),
			unassigned: sumTicketCounts(openTicketGroups.filter((row) => !row.assignedToUserId)),
			open: sumTicketCounts(openTicketGroups),
			all: sumTicketCounts(ticketCountGroups)
		}
	};
};
