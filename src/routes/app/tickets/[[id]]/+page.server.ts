import { fail, isHttpError, redirect } from '@sveltejs/kit';
import { workspace, requireUser, createTicket, mutateTicket } from '$lib/server/tickets';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals, url, params }) =>
	workspace(requireUser(locals.user), url, params.id);
export const actions: Actions = {
	create: async ({ locals, request }) => {
		let t;
		try {
			t = await createTicket(requireUser(locals.user), await request.formData());
		} catch (e) {
			if (isHttpError(e)) return fail(e.status, { error: e.body.message });
			throw e;
		}
		redirect(303, `/app/tickets/${t.ticketNumber}?view=mine`);
	},
	reply: async ({ locals, request, params }) => {
		try {
			await mutateTicket(
				requireUser(locals.user),
				Number(params.id),
				await request.formData(),
				'reply'
			);
			return { success: 'Message sent.' };
		} catch (e) {
			if (isHttpError(e)) return fail(e.status, { error: e.body.message });
			throw e;
		}
	},
	update: async ({ locals, request, params }) => {
		try {
			await mutateTicket(
				requireUser(locals.user),
				Number(params.id),
				await request.formData(),
				'update'
			);
			return { success: 'Ticket updated.' };
		} catch (e) {
			if (isHttpError(e)) return fail(e.status, { error: e.body.message });
			throw e;
		}
	}
};
