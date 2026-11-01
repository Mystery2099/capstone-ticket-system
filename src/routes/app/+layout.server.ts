import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { category, ticket } from '$lib/server/schema';
import { asc } from 'drizzle-orm';
export const load = async ({ locals }: { locals: App.Locals }) => {
	if (!locals.user) redirect(303, '/login');
	const [allRows, categories] = await Promise.all([
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
	const u = locals.user;
	const staff = u.role !== 'requester';
	const all = staff ? allRows : allRows.filter((t) => t.requesterId === u.id);
	const open = all.filter((t) => !['resolved', 'closed'].includes(t.statusCode));
	return {
		user: u,
		// Sidebar counts for staff. Open means not resolved or closed, the same as All open.
		// Inactive categories stay listed while they still hold open tickets.
		openByCategory: staff
			? categories
					.map(({ id, name, active }) => ({
						id,
						name,
						active,
						count: open.filter((t) => t.categoryId === id).length
					}))
					.filter((c) => c.active || c.count > 0)
			: [],
		counts: {
			mine: all.filter((t) => t.requesterId === u.id).length,
			queue: open.filter((t) => t.assignedToUserId === u.id).length,
			unassigned: open.filter((t) => !t.assignedToUserId).length,
			open: open.length,
			all: all.length
		}
	};
};
