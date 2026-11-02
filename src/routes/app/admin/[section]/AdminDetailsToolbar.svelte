<script lang="ts">
	import { ArrowLeft, X } from '@lucide/svelte';
	import TooltipIconButton from '$lib/components/TooltipIconButton.svelte';

	type AdminDetailsToolbarProps = {
		title: string;
		subtitle: string;
		recordNoun: string;
		listHref: string;
	};
	let { title, subtitle, recordNoun, listHref }: AdminDetailsToolbarProps = $props();
</script>

<div class="reading-toolbar">
	<TooltipIconButton label={`Back to ${recordNoun} list`} href={listHref} class="icon-button back"
		><ArrowLeft size={21} /></TooltipIconButton
	>
	<div class="ticket-title">
		<h1>{title}</h1>
		<p class="ticket-dates">{subtitle}</p>
	</div>
	<TooltipIconButton
		label="Close"
		tooltip="Close details"
		href={listHref}
		class="icon-button compose-close"><X size={20} /></TooltipIconButton
	>
</div>
