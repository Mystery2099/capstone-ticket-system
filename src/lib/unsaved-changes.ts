/**
 * Warns before unsaved text is lost, without a modal. Closing or reloading the tab gets the
 * browser's own warning, the only way a page can ask then. Moving elsewhere in the app is held
 * back once, and a notice offers to discard the text and continue.
 */
import { beforeNavigate, goto } from '$app/navigation';
import { toast } from 'svelte-sonner';

/** Every guard shares one notice, so two unsaved boxes don't stack two warnings. */
const UNSAVED_CHANGES_TOAST_ID = 'unsaved-changes';

/** The page the person chose to leave for anyway, which every guard then lets through. */
let discardedNavigationHref: string | null = null;

/**
 * Call while a component starts up, like any SvelteKit navigation hook.
 *
 * @param hasUnsavedChanges read on every navigation
 * @param unsavedChangeLabel what would be lost, such as "description" or "comment"
 */
export function guardUnsavedChanges(
	hasUnsavedChanges: () => boolean,
	unsavedChangeLabel: string
): void {
	beforeNavigate(({ cancel, to, type }) => {
		if (!hasUnsavedChanges()) return;
		// Closing or reloading the tab: cancelling asks the browser to show its own warning.
		if (type === 'leave') {
			cancel();
			return;
		}
		const targetHref = to?.url.href;
		if (!targetHref || targetHref === discardedNavigationHref) return;
		cancel();
		toast.warning(`Your ${unsavedChangeLabel} isn’t saved`, {
			id: UNSAVED_CHANGES_TOAST_ID,
			description: 'Save it first, or discard it to keep going.',
			duration: Infinity,
			action: {
				label: 'Discard and leave',
				onClick: () => {
					discardedNavigationHref = targetHref;
					void goto(targetHref).finally(() => (discardedNavigationHref = null));
				}
			}
		});
	});
}
