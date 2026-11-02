import { toast } from 'svelte-sonner';
import { superForm, type SuperForm } from 'sveltekit-superforms';
import type { PageData } from './$types';

export type TicketCreateSuperForm = SuperForm<PageData['createForm']['data']>;
export type TicketReplySuperForm = SuperForm<PageData['replyForm']['data']>;

/**
 * The new-ticket form. Its values live in a browser draft, so Superforms only handles
 * submitting it. Create it in a component that outlives the form's markup, so a creation
 * that finishes after the form has closed still discards its draft.
 *
 * @param readActiveDraftId the draft being submitted, read when the form is submitted
 * @param onCreated runs with that draft's id once the server has created the ticket
 */
export function createTicketCreateForm(
	formData: PageData['createForm'],
	readActiveDraftId: () => string,
	onCreated: (submittedDraftId: string) => void
): TicketCreateSuperForm {
	let submittedDraftId: string | null = null;
	return superForm(formData, {
		resetForm: false,
		taintedMessage: false,
		applyAction: 'never',
		multipleSubmits: 'prevent',
		onSubmit() {
			submittedDraftId = readActiveDraftId();
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
}

/**
 * The comment and internal-note form. Text stays until the server confirms it, since
 * Superforms resets only successful replies. Create it in a component that outlives the
 * editor, so text survives the editor being hidden, such as when the ticket is closed.
 */
export function createTicketReplyForm(formData: PageData['replyForm']): TicketReplySuperForm {
	return superForm(formData, {
		taintedMessage: false,
		applyAction: 'never',
		multipleSubmits: 'prevent',
		onUpdated({ form }) {
			if (!form.message) return;
			if (form.message.failed) toast.error(form.message.text, { duration: Infinity });
			else toast.success(form.message.text);
		},
		onError() {
			toast.error('Couldn’t send. Your comment is still in the box below.', { duration: Infinity });
		}
	});
}
