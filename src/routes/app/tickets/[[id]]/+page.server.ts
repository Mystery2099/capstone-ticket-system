import { fail, isHttpError, redirect } from '@sveltejs/kit';
import { message, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createTicketSchema, commentSchema } from '$lib/server/validation';
import {
	addTicketComment,
	createTicket,
	loadTicketWorkspace,
	requireUser,
	updateTicketField
} from '$lib/server/tickets';
import type { Actions, PageServerLoad } from './$types';

const createSchema = zod4(createTicketSchema);
const replySchema = zod4(commentSchema);

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const actor = requireUser(locals.user);
	const [workspace, createForm, replyForm] = await Promise.all([
		loadTicketWorkspace(actor, url, params.id),
		superValidate(createSchema, { id: 'ticket-create' }),
		superValidate(replySchema, { id: 'ticket-reply' })
	]);
	return { ...workspace, createForm, replyForm };
};

/** Keep field errors and domain failures in the same Superforms response. */
function formFailure<T extends Record<string, unknown>>(form: SuperValidated<T>, e: unknown) {
	if (!isHttpError(e)) throw e;
	form.message = { text: e.body.message, failed: true };
	return fail(e.status, { form });
}

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const actor = requireUser(locals.user);
		const data = await request.formData();
		const form = await superValidate(data, createSchema, { id: 'ticket-create' });
		let created;
		try {
			// The service checks permissions before input errors, including forged
			// requester/assignee fields that do not belong to the public input schema.
			created = await createTicket(actor, data);
		} catch (e) {
			return formFailure(form, e);
		}
		const view = created.requesterId === actor.id ? 'mine' : 'open';
		redirect(303, `/app/tickets/${created.ticketNumber}?view=${view}`);
	},
	reply: async ({ locals, request, params }) => {
		const actor = requireUser(locals.user);
		const data = await request.formData();
		const form = await superValidate(data, replySchema, { id: 'ticket-reply' });
		try {
			await addTicketComment(actor, Number(params.id), data);
			return message(form, { text: 'Comment posted.' });
		} catch (e) {
			return formFailure(form, e);
		}
	},
	update: async ({ locals, request, params }) => {
		try {
			await updateTicketField(
				requireUser(locals.user),
				Number(params.id),
				await request.formData()
			);
			return { success: 'Ticket updated.' };
		} catch (e) {
			if (isHttpError(e)) return fail(e.status, { error: e.body.message });
			throw e;
		}
	}
};
