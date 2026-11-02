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

<div class="composer-footer admin-actions">
	{#if hint}
		<span class="muted small compose-hint">{hint}</span>
	{/if}
	<Button variant="ghost" size="pill-sm" onclick={onSecondaryAction}>{secondaryLabel}</Button>
	<Button type="submit" size="pill-sm" disabled={isSubmitting}
		>{isSubmitting ? submittingLabel : submitLabel}</Button
	>
</div>
