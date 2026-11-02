import { stringify } from 'devalue';
import { loadTicketWorkspace, requireUser } from '$lib/server/tickets';
import type { RequestHandler } from './$types';

/** Additional list batches use the same filters and access checks as the initial page. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const workspace = await loadTicketWorkspace(requireUser(locals.user), url);
	return new Response(
		stringify({ tickets: workspace.tickets, nextPageHref: workspace.nextPageHref }),
		{
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
		}
	);
};
