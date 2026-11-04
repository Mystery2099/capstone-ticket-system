<!--
	The ticket's subject, as the reading pane's heading. Staff who may edit tickets can rewrite
	it in place: Enter or Ctrl/Cmd+Enter saves, and Escape puts the old subject back.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { afterNavigate } from '$app/navigation';
	import UnsavedChangesNotice from '$lib/components/UnsavedChangesNotice.svelte';
	import { UnsavedChangesGuard } from '$lib/unsaved-changes.svelte';
	import { Pencil } from '@lucide/svelte';
	import { matchesKeyboardEvent } from '@tanstack/svelte-hotkeys';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { AppHotkeys } from '$lib/hotkeys';
	import { TicketEventType } from '$lib/status';

	const SUBJECT_MAX_LENGTH = 180;

	type TicketSubjectHeadingProps = {
		subject: string;
		canEdit: boolean;
	};
	let { subject, canEdit }: TicketSubjectHeadingProps = $props();

	let isEditing = $state(false);
	// The pane stays mounted between tickets, so opening another one ends the edit.
	afterNavigate(() => (isEditing = false));
	let isSaving = $state(false);
	let editedSubject = $state('');
	const unsavedChangesGuard = new UnsavedChangesGuard(
		() => isEditing && editedSubject.trim() !== subject
	);

	function startEditing(): void {
		editedSubject = subject;
		isEditing = true;
	}

	function handleKeydown(event: KeyboardEvent, formElement: HTMLFormElement): void {
		if (matchesKeyboardEvent(event, AppHotkeys.CLOSE_FORM.hotkey)) {
			event.preventDefault();
			isEditing = false;
		} else if (matchesKeyboardEvent(event, AppHotkeys.SUBMIT_FORM.hotkey)) {
			event.preventDefault();
			formElement.requestSubmit();
		}
	}
</script>

{#if isEditing}<form
		method="POST"
		action="?/editContent"
		class="flex min-w-0 flex-wrap items-center gap-2"
		use:enhance={({ cancel }) => {
			// Nothing changed, so there's nothing to save.
			if (editedSubject.trim() === subject) {
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
		<input type="hidden" name="field" value={TicketEventType.SUBJECT} />
		<input
			name="value"
			aria-label="Subject"
			class="min-h-9 min-w-0 flex-1 rounded-[8px] border border-input bg-transparent px-2.5 text-[20px] leading-7 font-[650] focus:outline-none focus-visible:border-ring"
			bind:value={editedSubject}
			required
			maxlength={SUBJECT_MAX_LENGTH}
			readonly={isSaving}
			onkeydown={(event) => handleKeydown(event, event.currentTarget.form!)}
			{@attach (input) => input.select()}
		/>
		<Button type="submit" size="pill" disabled={isSaving || !editedSubject.trim()}
			>{isSaving ? 'Saving…' : 'Save'}</Button
		><Button
			type="button"
			variant="outline"
			size="pill"
			disabled={isSaving}
			onclick={() => (isEditing = false)}>Cancel</Button
		>
		{#if unsavedChangesGuard.isNoticeVisible}<div class="basis-full">
				<UnsavedChangesNotice guard={unsavedChangesGuard} unsavedChangeLabel="subject" />
			</div>{/if}
	</form>{:else}<div class="flex min-w-0 items-start gap-1">
		<h1>{subject}</h1>
		{#if canEdit}<TooltipIconButton
				label="Edit subject"
				class="icon-button shrink-0"
				onclick={startEditing}><Pencil size={16} /></TooltipIconButton
			>{/if}
	</div>{/if}
