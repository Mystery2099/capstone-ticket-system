<!-- Every kind of unsent draft in one list, each opening back in its own form. -->
<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { Drafts } from '$lib/drafts.svelte';
	import { getInitials } from '$lib/person';
	import type { TicketDirectory } from './ticket-directory';

	type DraftListProps = {
		drafts: Drafts;
		directory: TicketDirectory;
		/** The ticket draft open in the compose form, if any. */
		selectedDraftId: string | null;
	};
	let { drafts, directory, selectedDraftId }: DraftListProps = $props();

	let draftRows = $derived([
		...drafts.tickets.dirtyDrafts.map((draft) => ({
			id: draft.id,
			title: draft.subject.trim() || 'No subject',
			preview: draft.description.trim() || 'Nothing written yet',
			type: 'Ticket draft',
			avatar: getInitials(directory.getPersonName(draft.requesterId)),
			href: `/app/tickets/new?view=drafts&draft=${draft.id}`
		})),
		...drafts.users.dirtyDrafts.map((draft) => ({
			id: draft.id,
			title: draft.name.trim() || 'No name',
			preview: draft.email.trim() || 'No email yet',
			type: 'User draft',
			avatar: draft.name.trim() ? getInitials(draft.name.trim()) : '?',
			href: `/app/admin/users?new&draft=${draft.id}`
		})),
		...drafts.categories.dirtyDrafts.map((draft) => ({
			id: draft.id,
			title: draft.name.trim(),
			preview: 'New category',
			type: 'Category draft',
			avatar: '',
			href: `/app/admin/categories?new&draft=${draft.id}`
		}))
	]);
</script>

<div class="rows">
	{#each draftRows as row (row.id)}<a
			href={row.href}
			class="list-row"
			class:selected={row.id === selectedDraftId}
			>{#if row.avatar}<span class="avatar row-avatar">{row.avatar}</span>{/if}
			<div class="row-content">
				<div class="row-title">
					<strong>{row.title}</strong><time>{row.type}</time>
				</div>
				<div class="row-meta">
					<span class="row-preview">{row.preview}</span>
				</div>
			</div></a
		>{:else}<EmptyState title="No drafts">
			{#snippet description()}Anything you start but don’t finish is saved here.{/snippet}
			<a href="/app/tickets" class="text-link">Back to tickets</a>
		</EmptyState>{/each}
</div>
