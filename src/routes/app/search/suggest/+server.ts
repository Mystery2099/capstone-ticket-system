import { json } from '@sveltejs/kit';
import { requireUser, loadTicketSuggestions } from '$lib/server/tickets';
import { TicketSearchQuery } from '$lib/server/ticket-search';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const actor = requireUser(locals.user);
	const query = TicketSearchQuery.fromUrl(url);
	const tickets =
		query && query.searchText.length >= 2 ? await loadTicketSuggestions(actor, query) : [];
	return json({ tickets }, { headers: { 'Cache-Control': 'private, no-store' } });
};
