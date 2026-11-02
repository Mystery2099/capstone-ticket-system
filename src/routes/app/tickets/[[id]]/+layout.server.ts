import { requireUser } from '$lib/server/access';
import { loadTicketList } from '$lib/server/tickets';
import type { LayoutServerLoad } from './$types';

/**
 * The ticket list, loaded apart from the open ticket. It reads only the list's own search
 * parameters, so opening another ticket reruns the page load but not this one.
 */
export const load: LayoutServerLoad = async ({ locals, url }) =>
	loadTicketList(requireUser(locals.user), url);
