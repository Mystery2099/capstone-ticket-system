<!--
	Stands in for a whole page while navigating between sections of the app.
	Each kind reuses that page's layout classes and real title, so the swap is seamless.
-->
<script lang="ts" module>
	export type RouteSkeletonKind = 'tickets' | 'ticket' | 'users' | 'categories' | 'settings';
</script>

<script lang="ts">
	import ConversationSkeleton from './ConversationSkeleton.svelte';
	import TicketRowsSkeleton from './TicketRowsSkeleton.svelte';
	let { kind }: { kind: RouteSkeletonKind } = $props();
</script>

{#if kind === 'tickets' || kind === 'ticket'}
	<div class="workspace" class:has-ticket={kind === 'ticket'}>
		<section class="ticket-list" aria-label="Ticket list">
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
				<div class="conversation-scroll"><ConversationSkeleton heading /></div>
			{/if}
		</section>
	</div>
{:else if kind === 'settings'}
	<div class="settings-design">
		<header class="admin-header"><h1>Settings</h1></header>
		<p class="sr-only" role="status">Loading settings</p>
		<div class="settings-content skeleton-fade" aria-hidden="true">
			{#each [3, 2] as lines (lines)}
				<section class="setting-row">
					<div>
						<span class="skeleton mb-2 h-4 w-24"></span>
						<span class="skeleton h-3 w-40"></span>
					</div>
					<div>
						{#each { length: lines }}
							<span class="skeleton mb-3 h-4 w-44"></span>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>
{:else}
	<div class="workspace">
		<section class="ticket-list" aria-label={kind === 'users' ? 'User list' : 'Category list'}>
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
