import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';

export type AdminFormMessage = { text: string; failed?: boolean; createdId?: string };

export const ENABLED_STATE_OPTIONS = [
	{ value: 'true', label: 'Enabled' },
	{ value: 'false', label: 'Disabled' }
];

export const ACTIVE_STATE_OPTIONS = [
	{ value: 'true', label: 'Active' },
	{ value: 'false', label: 'Inactive' }
];

export const CREATE_FORM_HINT = 'Esc to close · Ctrl/Cmd+Enter to create';

/**
 * Superforms options shared by every administration form. Values stay put after submitting,
 * and results become toasts, with failures staying until dismissed. Field errors show beside
 * their input instead. A created record is opened once it exists.
 */
export function buildAdminFormOptions(onCreated?: () => void) {
	return {
		resetForm: false,
		taintedMessage: false as const,
		onUpdated({ form }: { form: { message?: AdminFormMessage } }) {
			if (!form.message) return;
			const { text, failed, createdId } = form.message;
			if (failed) toast.error(text, { duration: Infinity });
			else toast.success(text);
			if (createdId) {
				onCreated?.();
				void goto(`?id=${createdId}`);
			}
		}
	};
}

/** Case-insensitive match for the list's filter box. An empty filter matches everything. */
export function matchesFilterText(text: string, filterText: string): boolean {
	return text.toLowerCase().includes(filterText.trim().toLowerCase());
}
