<!--
	Stands in for a whole page while navigating between sections of the app.
	Each kind reuses that page's layout and real title, so the swap is seamless.
-->
<script lang="ts" module>
	export type RouteSkeletonKind = 'tickets' | 'ticket' | 'users' | 'categories' | 'settings';
</script>

<script lang="ts">
	import SettingRow from '$lib/components/settings/SettingRow.svelte';
	import SettingsLayout from '$lib/components/settings/SettingsLayout.svelte';
	import ConversationSkeleton from './ConversationSkeleton.svelte';
	import TicketRowsSkeleton from './TicketRowsSkeleton.svelte';
	let { kind }: { kind: RouteSkeletonKind } = $props();
</script>

{#if kind === 'tickets' || kind === 'ticket'}
	<div class="workspace" class:has-ticket={kind === 'ticket'}>
		<section class="list-pane" aria-label="Ticket list">
			<div class="list-top" aria-hidden="true"><span class="skeleton h-4 w-28"></span></div>
			<div class="filters" aria-hidden="true">
				<span class="skeleton h-8 w-20 rounded-lg"></span>
				<span class="skeleton h-8 w-20 rounded-lg"></span>
				<span class="skeleton h-8 w-24 rounded-lg"></span>
			</div>
			<TicketRowsSkeleton />
		</section>
		<section class="reading-pane" aria-label="Ticket conversation">
			{#if kind === 'ticket'}
				<div class="conversation-scroll"><ConversationSkeleton showHeading /></div>
			{/if}
		</section>
	</div>
{:else if kind === 'settings'}
	<p class="sr-only" role="status">Loading settings</p>
	<SettingsLayout title="Settings" contentClass="skeleton-fade">
		{#each [3, 2] as lines (lines)}
			<SettingRow>
				{#snippet heading()}
					<span class="skeleton mb-2 h-4 w-24"></span>
					<span class="skeleton h-3 w-40"></span>
				{/snippet}
				<div>
					{#each { length: lines }}
						<span class="skeleton mb-3 h-4 w-44"></span>
					{/each}
				</div>
			</SettingRow>
		{/each}
	</SettingsLayout>
{:else}
	<div class="workspace">
		<section class="list-pane" aria-label={kind === 'users' ? 'User list' : 'Category list'}>
			<div class="list-top"><h1>{kind === 'users' ? 'Users' : 'Categories'}</h1></div>
			<div class="filters" aria-hidden="true">
				<span class="skeleton h-8 flex-1 rounded-lg"></span>
				<span class="skeleton h-8 w-24 rounded-lg"></span>
			</div>
			<TicketRowsSkeleton />
		</section>
		<section class="reading-pane" aria-label="Details"></section>
	</div>
{/if}
