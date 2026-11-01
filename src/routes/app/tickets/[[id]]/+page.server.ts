import { fail, isHttpError, redirect } from '@sveltejs/kit';
import {
	addTicketComment,
	createTicket,
	loadTicketWorkspace,
	requireUser,
	updateTicketField
} from '$lib/server/tickets';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	return loadTicketWorkspace(requireUser(locals.user), url, params.id);
};

/** Turns an expected error into a form failure, and rethrows anything else. */
function toFormFailure(e: unknown) {
	if (isHttpError(e)) return fail(e.status, { error: e.body.message });
	throw e;
}

export const actions: Actions = {
	create: async ({ locals, request }) => {
		let created;
		try {
			created = await createTicket(requireUser(locals.user), await request.formData());
		} catch (e) {
			return toFormFailure(e);
		}
		// A ticket opened for someone else isn't in My requests, so stay in All open.
		const view = created.requesterId === locals.user?.id ? 'mine' : 'open';
		redirect(303, `/app/tickets/${created.ticketNumber}?view=${view}`);
	},
	reply: async ({ locals, request, params }) => {
		try {
			const actor = requireUser(locals.user);
			await addTicketComment(actor, Number(params.id), await request.formData());
			return { success: 'Comment posted.' };
		} catch (e) {
			return toFormFailure(e);
		}
	},
	update: async ({ locals, request, params }) => {
		try {
			const actor = requireUser(locals.user);
			await updateTicketField(actor, Number(params.id), await request.formData());
			return { success: 'Ticket updated.' };
		} catch (e) {
			return toFormFailure(e);
		}
	}
};
