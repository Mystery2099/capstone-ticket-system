import { toast } from 'svelte-sonner';
import { superForm, type SuperForm } from 'sveltekit-superforms';
import { zod4Client } from 'sveltekit-superforms/adapters';
import type { TicketDraft } from '$lib/drafts.svelte';
import { commentSchema, createTicketSchema } from '$lib/validation';
import type { PageData } from './$types';

export type TicketCreateSuperForm = SuperForm<PageData['createForm']['data']>;
export type TicketReplySuperForm = SuperForm<PageData['replyForm']['data']>;

/**
 * The new-ticket form. Its values live in a browser draft, so Superforms only handles
 * submitting it. The draft is copied into the form on submit, where it is checked before
 * anything is sent. Errors then stay until the next submit, like the server's own.
 * Create it in a component that outlives the form's markup, so a creation that finishes
 * after the form has closed still discards its draft.
 *
 * @param readActiveDraft the draft being submitted, read when the form is submitted
 * @param onCreated runs with that draft's id once the server has created the ticket
 */
export function createTicketCreateForm(
	formData: PageData['createForm'],
	readActiveDraft: () => TicketDraft,
	onCreated: (submittedDraftId: string) => void
): TicketCreateSuperForm {
	let submittedDraftId: string | null = null;
	const createForm: TicketCreateSuperForm = superForm(formData, {
		validators: zod4Client(createTicketSchema),
		validationMethod: 'submit-only',
		resetForm: false,
		taintedMessage: false,
		applyAction: 'never',
		multipleSubmits: 'prevent',
		onSubmit() {
			const activeDraft = readActiveDraft();
			submittedDraftId = activeDraft.id;
			const { subject, description, categoryId } = activeDraft;
			createForm.form.set({ subject, description, categoryId }, { taint: false });
		},
		onResult({ result }) {
			if (result.type === 'redirect' && submittedDraftId) onCreated(submittedDraftId);
		},
		onUpdated({ form }) {
			if (form.message) toast.error(form.message.text, { duration: Infinity });
		},
		onError() {
			toast.error('Couldn’t create the ticket. Your draft is still saved.', { duration: Infinity });
		}
	});
	return createForm;
}

/**
 * The comment and internal-note form. Text stays until the server confirms it, since
 * Superforms resets only successful replies. Create it in a component that outlives the
 * editor, so text survives the editor being hidden, such as when the ticket is closed.
 */
export function createTicketReplyForm(formData: PageData['replyForm']): TicketReplySuperForm {
	// One toast for the reply's outcome, so a successful retry replaces the earlier failure
	// instead of stacking under it.
	const replyToastId = 'ticket-reply-outcome';
	return superForm(formData, {
		validators: zod4Client(commentSchema),
		taintedMessage: false,
		applyAction: 'never',
		multipleSubmits: 'prevent',
		onUpdated({ form }) {
			if (!form.message) return;
			if (form.message.failed)
				toast.error(form.message.text, { id: replyToastId, duration: Infinity });
			else toast.success(form.message.text, { id: replyToastId, duration: 4000 });
		},
		onError() {
			toast.error('Couldn’t send. Your comment is still in the box below.', {
				id: replyToastId,
				duration: Infinity
			});
		}
	});
}
