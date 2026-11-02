<!-- A numbered step heading in the authenticator setup. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type SetupStepHeadingProps = { stepNumber: number; id?: string; children: Snippet };
	let { stepNumber, id, children }: SetupStepHeadingProps = $props();
</script>

<h2 {id}><span class="step-number">{stepNumber}</span>{@render children()}</h2>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 9px;
		font-weight: 600;
		font-size: 14px;
		margin: 0;
	}
	.step-number {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--muted);
		font-size: 12px;
		flex-shrink: 0;
	}
</style>
