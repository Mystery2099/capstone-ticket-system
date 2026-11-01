import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { ticket } from '$lib/server/schema';
export const load = async ({ locals }: { locals: App.Locals }) => {
	if (!locals.user) redirect(303, '/login');
	const allRows = await db
		.select({
			requesterId: ticket.requesterId,
			assignedToUserId: ticket.assignedToUserId,
			statusCode: ticket.statusCode
		})
		.from(ticket);
	const u = locals.user;
	const all = u.role === 'requester' ? allRows.filter((t) => t.requesterId === u.id) : allRows;
	return {
		user: u,
		counts: {
			mine: all.filter((t) => t.requesterId === u.id).length,
			queue: all.filter(
				(t) => t.assignedToUserId === u.id && !['resolved', 'closed'].includes(t.statusCode)
			).length,
			unassigned: all.filter(
				(t) => !t.assignedToUserId && !['resolved', 'closed'].includes(t.statusCode)
			).length,
			open: all.filter((t) => !['resolved', 'closed'].includes(t.statusCode)).length,
			all: all.length
		}
	};
};
