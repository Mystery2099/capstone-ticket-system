<!--
	The ticket's description, shown on its own between the details and the conversation, so
	what the ticket is about reads at a glance instead of looking like the first reply. Staff
	who may edit tickets can rewrite it in place with the same editor used to write it.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { afterNavigate } from '$app/navigation';
	import UnsavedChangesNotice from '$lib/components/UnsavedChangesNotice.svelte';
	import { UnsavedChangesGuard } from '$lib/unsaved-changes.svelte';
	import { Pencil } from '@lucide/svelte';
	import { createHotkeysAttachment } from '@tanstack/svelte-hotkeys';
	import TicketContent from '$lib/components/tickets/TicketContent.svelte';
	import TicketContentEditor from '$lib/components/tickets/TicketContentEditor.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { AppHotkeys, formatHotkeyHint } from '$lib/hotkeys';
	import { TicketEventType } from '$lib/status';
	import {
		TicketContentFormat,
		convertPlainTextToMarkdown
	} from '$lib/ticket-content/ticket-content-format';

	const DESCRIPTION_MAX_LENGTH = 4000;
	const EDIT_FORM_HINT = `${formatHotkeyHint(AppHotkeys.CLOSE_FORM.hotkey)} to cancel · ${formatHotkeyHint(AppHotkeys.SUBMIT_FORM.hotkey)} to save`;

	type TicketDescriptionProps = {
		/** Left out while the ticket is still loading, which shows placeholder lines instead. */
		description?: string;
		descriptionFormat: TicketContentFormat;
		canEdit: boolean;
	};
	let { description, descriptionFormat, canEdit }: TicketDescriptionProps = $props();

	let isEditing = $state(false);
	// The pane stays mounted between tickets, so opening another one ends the edit.
	afterNavigate(() => (isEditing = false));
	let isSaving = $state(false);
	let editedDescription = $state('');
	/** The text the editor opened with, so an unchanged edit can be left without a warning. */
	let originalDescription = '';
	const unsavedChangesGuard = new UnsavedChangesGuard(
		() => isEditing && editedDescription.trim() !== originalDescription.trim()
	);

	function startEditing(): void {
		if (description === undefined) return;
		// The editor reads Markdown, so text written before rich text existed is converted first.
		editedDescription =
			descriptionFormat === TicketContentFormat.PLAIN
				? convertPlainTextToMarkdown(description)
				: description;
		originalDescription = editedDescription;
		isEditing = true;
	}

	let editFormElement = $state<HTMLFormElement>();
	/** Ctrl/Cmd+Enter saves and Escape cancels, while focus is anywhere in the form. */
	const editFormHotkeys = createHotkeysAttachment(
		[
			{
				hotkey: AppHotkeys.SUBMIT_FORM.hotkey,
				callback: () => editFormElement?.requestSubmit()
			},
			{ hotkey: AppHotkeys.CLOSE_FORM.hotkey, callback: () => (isEditing = false) }
		],
		() => ({ enabled: !isSaving, ignoreInputs: false })
	);
</script>

<section class="ticket-description" aria-labelledby="ticket-description-heading">
	<div class="flex items-center justify-between gap-2">
		<h2 id="ticket-description-heading" class="section-heading">Description</h2>
		{#if canEdit && !isEditing && description !== undefined}<Button
				variant="ghost"
				size="sm"
				class="-mt-2 text-muted-foreground"
				onclick={startEditing}><Pencil /> Edit</Button
			>{/if}
	</div>
	{#if isEditing}<form
			method="POST"
			action="?/editContent"
			bind:this={editFormElement}
			{@attach editFormHotkeys}
			use:enhance={({ cancel }) => {
				// Nothing changed, so there's nothing to save.
				if (editedDescription.trim() === originalDescription.trim()) {
					cancel();
					isEditing = false;
					return;
				}
				isSaving = true;
				return async ({ result, update }) => {
					if (result.type === 'error') {
						// A dropped connection, not a rejection: keep the editor and its text for a retry.
						isSaving = false;
						toast.error('Couldn’t save. Check your connection and try again.');
						return;
					}
					await update({ reset: false });
					isSaving = false;
					if (result.type === 'success') isEditing = false;
				};
			}}
		>
			<input type="hidden" name="field" value={TicketEventType.DESCRIPTION} />
			<div class="composer mt-0">
				<TicketContentEditor
					name="value"
					bind:value={editedDescription}
					label="Description"
					placeholder="What is this ticket about?"
					isRequired
					maximumLength={DESCRIPTION_MAX_LENGTH}
					isReadOnly={isSaving}
					contentClass="min-h-[140px]"
				/>
				<div class="composer-footer">
					<span class="small muted max-md:hidden">{EDIT_FORM_HINT}</span>
					<div class="ml-auto flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="pill-sm"
							disabled={isSaving}
							onclick={() => (isEditing = false)}>Cancel</Button
						><Button
							type="submit"
							size="pill-sm"
							disabled={isSaving ||
								!editedDescription.trim() ||
								editedDescription.trim().length > DESCRIPTION_MAX_LENGTH}
							>{isSaving ? 'Saving…' : 'Save'}</Button
						>
					</div>
				</div>
			</div>
			{#if unsavedChangesGuard.isNoticeVisible}<UnsavedChangesNotice
					guard={unsavedChangesGuard}
					unsavedChangeLabel="description"
				/>{/if}
		</form>{:else}<div class="ticket-description-body">
			{#if description === undefined}<p class="sr-only" role="status">Loading description</p>
				<div class="skeleton-fade grid gap-2 py-1" aria-hidden="true">
					<span class="skeleton h-3 w-[92%]"></span><span class="skeleton h-3 w-[78%]"></span><span
						class="skeleton h-3 w-[46%]"
					></span>
				</div>{:else}<TicketContent
					content={description}
					format={descriptionFormat}
					class="message-body text-[14px] leading-[1.65] wrap-anywhere wide:text-[15px]"
				/>{/if}
		</div>{/if}
</section>
