import { fail, isHttpError, redirect } from '@sveltejs/kit';
import { message, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createTicketSchema, commentSchema } from '$lib/server/validation';
import {
	addTicketComment,
	createTicket,
	findTicketSearchRedirect,
	loadTicketWorkspace,
	requireUser,
	updateTicketField
} from '$lib/server/tickets';
import type { Actions, PageServerLoad } from './$types';

const createTicketFormSchema = zod4(createTicketSchema);
const replyFormSchema = zod4(commentSchema);

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const actor = requireUser(locals.user);
	if (!params.id) {
		const ticketRedirect = await findTicketSearchRedirect(actor, url);
		if (ticketRedirect) redirect(303, ticketRedirect);
	}
	const [workspace, createForm, replyForm] = await Promise.all([
		loadTicketWorkspace(actor, url, params.id),
		superValidate(createTicketFormSchema, { id: 'ticket-create' }),
		superValidate(replyFormSchema, { id: 'ticket-reply' })
	]);
	return { ...workspace, createForm, replyForm };
};

/** Keep field errors and domain failures in the same Superforms response. */
function buildFormFailure<T extends Record<string, unknown>>(
	form: SuperValidated<T>,
	caughtError: unknown
) {
	if (!isHttpError(caughtError)) throw caughtError;
	form.message = { text: caughtError.body.message, failed: true };
	return fail(caughtError.status, { form });
}

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const actor = requireUser(locals.user);
		const formData = await request.formData();
		const form = await superValidate(formData, createTicketFormSchema, { id: 'ticket-create' });
		let createdTicket;
		try {
			// The service checks permissions before input errors, including forged
			// requester/assignee fields that do not belong to the public input schema.
			createdTicket = await createTicket(actor, formData);
		} catch (caughtError) {
			return buildFormFailure(form, caughtError);
		}
		const redirectView = createdTicket.requesterId === actor.id ? 'mine' : 'open';
		redirect(303, `/app/tickets/${createdTicket.ticketNumber}?view=${redirectView}`);
	},
	reply: async ({ locals, request, params }) => {
		const actor = requireUser(locals.user);
		const formData = await request.formData();
		const form = await superValidate(formData, replyFormSchema, { id: 'ticket-reply' });
		try {
			await addTicketComment(actor, Number(params.id), formData);
			return message(form, { text: 'Comment posted.' });
		} catch (caughtError) {
			return buildFormFailure(form, caughtError);
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
		} catch (caughtError) {
			if (isHttpError(caughtError))
				return fail(caughtError.status, { error: caughtError.body.message });
			throw caughtError;
		}
	}
};
