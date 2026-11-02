<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<div style="min-height:70dvh;display:grid;place-items:center;padding:24px">
	<div style="text-align:center;max-width:420px">
		<p class="muted small">{page.status}</p>
		<h1 style="margin:12px 0">
			{page.status === 404
				? 'We couldn’t find that page'
				: page.status === 403
					? 'You don’t have access to this page'
					: 'Something went wrong'}
		</h1>
		<p class="muted" style="line-height:1.6">{page.error?.message}</p>
		<Button href="/app/tickets" variant="outline" size="pill" class="mt-6 text-foreground">
			<ArrowLeft size={16} /> Back to tickets
		</Button>
	</div>
</div>
