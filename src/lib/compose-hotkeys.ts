import { goto } from '$app/navigation';
import { createHotkeysAttachment } from '@tanstack/svelte-hotkeys';
import { AppHotkeys, formatHotkeyHint } from '$lib/hotkeys';

export const CREATE_FORM_HINT = `${formatHotkeyHint(AppHotkeys.CLOSE_FORM.hotkey)} to close · ${formatHotkeyHint(AppHotkeys.SUBMIT_FORM.hotkey)} to create`;

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
			{
				hotkey: AppHotkeys.SUBMIT_FORM.hotkey,
				callback: () => getFormElement()?.requestSubmit()
			},
			{
				hotkey: AppHotkeys.CLOSE_FORM.hotkey,
				callback: () => {
					void goto(getCloseHref());
				}
			}
		],
		() => ({ enabled: isEnabled(), ignoreInputs: false })
	);
}
