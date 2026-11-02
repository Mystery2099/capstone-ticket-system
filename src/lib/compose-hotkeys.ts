import { goto } from '$app/navigation';
import { createHotkeysAttachment } from '@tanstack/svelte-hotkeys';

/**
 * Keyboard shortcuts for a new-record form: Ctrl/Cmd+Enter submits it and Escape closes it.
 * Attach the result to the form element with {@attach}.
 */
export function createComposeFormHotkeys(
	getFormElement: () => HTMLFormElement | undefined,
	getCloseHref: () => string,
	isEnabled: () => boolean
) {
	return createHotkeysAttachment(
		[
			{ hotkey: 'Mod+Enter', callback: () => getFormElement()?.requestSubmit() },
			{
				hotkey: 'Escape',
				callback: () => {
					void goto(getCloseHref());
				}
			}
		],
		() => ({ enabled: isEnabled(), ignoreInputs: false })
	);
}
