import { stringify } from 'devalue';
import { requireUser } from '$lib/server/access';
import { loadTicketList } from '$lib/server/tickets';
import type { RequestHandler } from './$types';

/** Additional list batches use the same filters and access checks as the initial page. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const ticketList = await loadTicketList(requireUser(locals.user), url, locals.requestCache);
	return new Response(
		stringify({ tickets: ticketList.tickets, nextPageHref: ticketList.nextPageHref }),
		{
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
		}
	);
};
