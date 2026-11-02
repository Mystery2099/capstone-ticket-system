<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	type AdminFormFooterProps = {
		isSubmitting: boolean;
		submitLabel: string;
		submittingLabel: string;
		secondaryLabel: string;
		hint?: string;
		onSecondaryAction: () => void;
	};
	let {
		isSubmitting,
		submitLabel,
		submittingLabel,
		secondaryLabel,
		hint,
		onSecondaryAction
	}: AdminFormFooterProps = $props();
</script>

<div class="composer-footer justify-end border-t border-border px-6 py-2.5">
	{#if hint}
		<span class="muted small compose-hint">{hint}</span>
	{/if}
	<Button variant="ghost" size="pill-sm" onclick={onSecondaryAction}>{secondaryLabel}</Button>
	<Button type="submit" size="pill-sm" disabled={isSubmitting}
		>{isSubmitting ? submittingLabel : submitLabel}</Button
	>
</div>
