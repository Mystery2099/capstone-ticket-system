/**
 * Warns before unsaved text is lost, without a modal. Closing or reloading the tab gets the
 * browser's own warning, the only way a page can ask then. Moving elsewhere in the app is held
 * back, and the component shows an UnsavedChangesNotice beside its editor until the person
 * keeps editing or chooses to discard the text and continue.
 */
import { beforeNavigate, goto } from '$app/navigation';

/** The page the person chose to leave for anyway, which every guard then lets through. */
let discardedNavigationHref: string | null = null;

export class UnsavedChangesGuard {
	/** Where the person tried to go while there were unsaved changes, or null. */
	blockedNavigationHref = $state<string | null>(null);

	/**
	 * Create while a component starts up, like any SvelteKit navigation hook.
	 *
	 * @param hasUnsavedChanges read on every navigation, and while the notice shows
	 */
	constructor(private readonly hasUnsavedChanges: () => boolean) {
		beforeNavigate(({ cancel, to, type }) => {
			if (!this.hasUnsavedChanges()) return;
			// Closing or reloading the tab: cancelling asks the browser to show its own warning.
			if (type === 'leave') {
				cancel();
				return;
			}
			const targetHref = to?.url.href;
			if (!targetHref || targetHref === discardedNavigationHref) return;
			cancel();
			this.blockedNavigationHref = targetHref;
		});
	}

	/** Whether the notice should show: a navigation was held back and the text is still unsaved. */
	get isNoticeVisible(): boolean {
		return this.blockedNavigationHref !== null && this.hasUnsavedChanges();
	}

	keepEditing(): void {
		this.blockedNavigationHref = null;
	}

	discardAndLeave(): void {
		const targetHref = this.blockedNavigationHref;
		this.blockedNavigationHref = null;
		if (!targetHref) return;
		discardedNavigationHref = targetHref;
		void goto(targetHref).finally(() => (discardedNavigationHref = null));
	}
}
