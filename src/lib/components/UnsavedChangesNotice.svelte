<!--
	Shown beside an editor when someone tries to leave with unsaved text. It scrolls itself into
	view, so the warning is right where the text is instead of tucked in a corner.
-->
<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { UnsavedChangesGuard } from '$lib/unsaved-changes.svelte';

	type UnsavedChangesNoticeProps = {
		guard: UnsavedChangesGuard;
		/** What would be lost, such as "description" or "comment". */
		unsavedChangeLabel: string;
	};
	let { guard, unsavedChangeLabel }: UnsavedChangesNoticeProps = $props();
</script>

<div
	class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-note-border bg-note px-3.5 py-2.5 text-[13px]"
	role="alert"
	{@attach (notice) => notice.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
>
	<TriangleAlert size={16} class="shrink-0" />
	<p class="min-w-0 flex-1">
		<strong>Your {unsavedChangeLabel} isn’t saved.</strong> Save it, or discard it to keep going.
	</p>
	<div class="ml-auto flex gap-2">
		<Button type="button" variant="outline" size="pill-sm" onclick={() => guard.keepEditing()}
			>Keep editing</Button
		><Button type="button" size="pill-sm" onclick={() => guard.discardAndLeave()}
			>Discard and leave</Button
		>
	</div>
</div>
