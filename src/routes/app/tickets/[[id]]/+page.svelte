<script lang="ts">
	import { enhance } from '$app/forms';
	import { navigating, page } from '$app/state';
	import { goto, invalidateAll, beforeNavigate, afterNavigate } from '$app/navigation';
	import {
		RefreshCw,
		ChevronLeft,
		ChevronRight,
		Link,
		ChevronsUp,
		ArrowLeft,
		Send,
		LockKeyhole,
		MessageSquare,
		ArrowRightLeft,
		X,
		SquarePen,
		Inbox
	} from '@lucide/svelte';
	import PersonCombobox from '$lib/components/PersonCombobox.svelte';
	import StatusBadge from '$lib/StatusBadge.svelte';
	import { statuses, initials } from '$lib/status';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import ConversationSkeleton from '$lib/components/skeleton/ConversationSkeleton.svelte';
	import TicketRowsSkeleton from '$lib/components/skeleton/TicketRowsSkeleton.svelte';
	import { delayed } from '$lib/delayed.svelte';
	import { getTicketDraft } from '$lib/ticket-draft.svelte';
	let { data, form } = $props();
	let body = $state(''),
		internal = $state(false),
		expanded = $state(false),
		details = $state(false),
		copied = $state(''),
		sending = $state(false),
		refreshing = $state(false),
		reopening = $state(false),
		sendError = $state(''),
		// A reply awaiting the server, shown in the conversation right away.
		sendingMessage = $state<{ body: string; isInternal: boolean } | null>(null),
		// Metadata values chosen but not yet confirmed, keyed by field.
		chosen = $state<Record<string, string>>({});
	const draft = getTicketDraft();
	let creating = $state(false),
		formEl = $state<HTMLFormElement>();
	let staff = $derived(data.user.role !== 'requester');

	// The list already holds every ticket field except its replies and events, so a
	// click can paint the real heading at once and leave only the rest as a skeleton.
	let target = $derived(navigating.to?.route.id === page.route.id ? navigating.to : null);
	let targetId = $derived(target?.params?.id);
	let opening = $derived(targetId === 'new');
	// Leaving the form takes effect at once, so the pane never lags behind a click.
	let composing = $derived(opening || (data.isNew && !target));
	let listChanging = $derived(!!target && !opening && target.url.search !== page.url.search);
	let targetRow = $derived(
		targetId && !listChanging
			? data.tickets.find((row) => String(row.ticketNumber) === targetId)
			: undefined
	);
	let loading = delayed(() => !!target && !opening);
	let listLoading = $derived(loading.current && listChanging);
	let paneLoading = $derived(loading.current && !!targetId);
	let t = $derived(paneLoading ? (targetRow ?? null) : data.selected);
	let highlighted = $derived(composing ? undefined : target ? targetRow?.id : data.selected?.id);
	let hasTicket = $derived(composing || (target && !targetId ? false : !!t || paneLoading));
	let listHref = $derived('/app/tickets' + page.url.search);
	let closed = $derived(t?.statusCode === 'closed');
	let requesters = $derived(
		data.people.filter((p) => p.enabled).sort((a, b) => a.name.localeCompare(b.name))
	);
	let assignees = $derived(requesters.filter((p) => p.role !== 'requester'));
	const personOption = (p: (typeof requesters)[number]) => ({
		value: p.id,
		label: p.name + (p.id === data.user.id ? ' (you)' : '')
	});
	const person = (id: string | null) =>
		data.people.find((p) => p.id === id)?.name || 'Support team';
	const role = (id: string) => data.people.find((p) => p.id === id)?.role || 'agent';
	const cat = (id: string) => data.categories.find((c) => c.id === id)?.name || 'Category';
	const date = (d: Date | string) =>
		new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const time = (d: Date | string) =>
		new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	let view = $derived(
		listChanging ? target?.url.searchParams.get('view') || (staff ? 'open' : 'mine') : data.view
	);
	let listParams = $derived((listChanging ? target?.url : page.url)?.searchParams);
	let openCategory = $derived(
		view === 'open' ? data.categories.find((c) => c.id === listParams?.get('category')) : undefined
	);
	let title = $derived(
		(
			{
				open: 'All open',
				queue: 'Assigned to me',
				unassigned: 'Unassigned',
				all: 'All tickets',
				mine: 'My requests'
			} as Record<string, string>
		)[view] || 'All tickets'
	);
	let heading = $derived(openCategory ? `Open · ${openCategory.name}` : title);
	let index = $derived(data.tickets.findIndex((x) => x.id === t?.id));
	let timeline = $derived(
		[
			...data.comments.map((c) => ({ ...c, kind: 'comment' as const })),
			...data.events
				.filter((e) => !['created', 'reply', 'internal_note'].includes(e.eventType))
				.map((e) => ({ ...e, kind: 'event' as const }))
		].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
	);
	let shown = $derived(expanded ? timeline : timeline.slice(-4));
	function href(n: number) {
		return `/app/tickets/${n}${page.url.search}`;
	}
	async function filter(key: string, value: string) {
		const q = new URLSearchParams(page.url.searchParams);
		value ? q.set(key, value) : q.delete(key);
		await goto('/app/tickets?' + q);
	}
	async function refresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
	}
	let copiedTimer: ReturnType<typeof setTimeout>;
	async function copy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = label;
		} catch {
			copied = 'Couldn’t copy';
		}
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = ''), 2000);
	}
	afterNavigate(() => {
		body = '';
		internal = false;
		expanded = false;
		details = false;
		sendError = '';
		creating = false;
	});
	beforeNavigate(({ cancel }) => {
		// New-ticket drafts need no warning here, because they stay in the list.
		if (body.trim() && !confirm('Discard your unsent text and leave this page?')) cancel();
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (body.trim() || (draft.dirty && !creating)) {
			e.preventDefault();
			e.returnValue = '';
		}
	}}
	onkeydown={(e) => {
		if (!composing || !formEl?.contains(e.target as Node)) return;
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			formEl.requestSubmit();
		} else if (e.key === 'Escape' && !creating) {
			void goto(listHref);
		}
	}}
/>

{#snippet compose()}
	<form
		bind:this={formEl}
		class="compose"
		method="POST"
		action="?/create"
		use:enhance={() => {
			creating = true;
			return async ({ result, update }) => {
				if (result.type === 'redirect') draft.reset();
				await update({ reset: false });
				creating = false;
			};
		}}
	>
		<div class="reading-toolbar">
			<a href={listHref} class="icon-button back" aria-label="Back to tickets"
				><ArrowLeft size={21} /></a
			>
			<div class="ticket-title">
				<input
					{@attach (input) => input.focus()}
					class="compose-subject"
					name="subject"
					aria-label="Subject"
					placeholder="Subject"
					bind:value={draft.subject}
					required
					maxlength={180}
					readonly={creating}
				/>
				<p class="ticket-dates">
					New ticket{draft.subject.length > 160 ? ` · ${draft.subject.length} / 180` : ''}
				</p>
			</div>
			<a href={listHref} class="icon-button compose-close" aria-label="Close new ticket"
				><X size={20} /></a
			>
		</div>
		<div class="conversation-scroll compose-body">
			<div class="ticket-heading">
				<div class="ticket-metadata">
					{#if staff}
						<div class="metadata-control">
							<span>Requester</span><PersonCombobox
								name="requesterId"
								label="Requester"
								bind:value={draft.requesterId}
								options={requesters.map(personOption)}
								disabled={creating}
							/>
						</div>
						<div class="metadata-control">
							<span>Assignee</span><PersonCombobox
								name="assignedToUserId"
								label="Assignee"
								bind:value={draft.assignedToUserId}
								options={[{ value: '', label: 'Unassigned' }, ...assignees.map(personOption)]}
								disabled={creating}
							/>
						</div>
					{/if}
					<label class="metadata-control">
						<span>Category</span><select
							aria-label="Category"
							name="categoryId"
							bind:value={draft.categoryId}
							required
							disabled={creating}
							><option value="">Choose</option
							>{#each data.categories.filter((c) => c.active) as c}<option value={c.id}
									>{c.name}</option
								>{/each}</select
						>
					</label>
				</div>
			</div>
			{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
			<div class="composer">
				<textarea
					name="description"
					aria-label="Description"
					placeholder="What happened? Include when it started and what you’ve tried."
					bind:value={draft.description}
					required
					maxlength={4000}
					rows={8}
					readonly={creating}></textarea>
				<div class="composer-footer">
					<span
						class="muted small"
						class:compose-hint={!creating && draft.description.length <= 3600}
						>{creating
							? 'Creating ticket…'
							: draft.description.length > 3600
								? `${draft.description.length} / 4000`
								: 'Esc to close · Ctrl+Enter to create'}</span
					>
					<span class="compose-actions">
						<Button
							variant="ghost"
							size="sm"
							class="rounded-full px-4"
							disabled={creating}
							onclick={() => {
								draft.reset();
								void goto(listHref);
							}}>Discard</Button
						>
						<Button
							type="submit"
							size="sm"
							class="rounded-full px-4 whitespace-nowrap"
							disabled={creating}
							><Send size={15} />{creating ? 'Creating…' : 'Create ticket'}</Button
						>
					</span>
				</div>
			</div>
		</div>
	</form>
{/snippet}
{#snippet commentMessage(
	authorId: string,
	isInternal: boolean,
	when: string,
	text: string,
	isSending = false
)}
	<article class="message" class:internal-note={isInternal} class:sending={isSending}>
		<span class="avatar">{initials(person(authorId))}</span>
		<div class="message-content">
			<div class="message-heading">
				<strong>{person(authorId)}</strong><span class="role-tag"
					>{role(authorId) === 'requester'
						? 'Requester'
						: role(authorId) === 'admin'
							? 'Administrator'
							: 'Agent'}</span
				><time>{when}</time>
			</div>
			{#if isInternal}<p class="private-label">
					<LockKeyhole size={13} /> Internal note · only visible to support team
				</p>{/if}
			<p class="message-body">{text}</p>
		</div>
	</article>
{/snippet}
{#snippet updateSelect(
	field: string,
	label: string,
	value: string,
	options: { value: string; label: string }[]
)}
	<form
		method="POST"
		action="?/update"
		use:enhance={({ formData, formElement }) => {
			chosen[field] = String(formData.get('value'));
			return async ({ result, update }) => {
				await update({ reset: false });
				delete chosen[field];
				const control = formElement.elements.namedItem('value') as HTMLSelectElement;
				if (result.type !== 'success') control.value = value;
			};
		}}
		class="metadata-control"
	>
		<input type="hidden" name="field" value={field} /><span>{label}</span>
		{#if field === 'assignedToUserId'}
			<PersonCombobox
				name="value"
				{label}
				{options}
				value={chosen[field] ?? value}
				disabled={closed || paneLoading}
				submitOnSelect
			/>
		{:else}
			<select
				name="value"
				aria-label={label}
				class={field === 'statusCode' ? 'status ' + (chosen[field] ?? value) : ''}
				{value}
				disabled={closed || paneLoading}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
				>{#each options as o}<option value={o.value}>{o.label}</option>{/each}</select
			>
		{/if}
	</form>
{/snippet}
<div class="workspace" class:has-ticket={hasTicket}>
	<section class="ticket-list" aria-label="Ticket list">
		<div class="list-top">
			<h1>
				{heading}{#if !listLoading}
					<span>{data.tickets.length}</span>{/if}
			</h1>
			<button
				class="icon-button"
				aria-label="Refresh tickets"
				disabled={refreshing}
				onclick={refresh}><RefreshCw size={20} /></button
			>
		</div>
		<div class="filters">
			<select
				aria-label="Filter by status"
				value={page.url.searchParams.get('status') || ''}
				onchange={(e) => filter('status', e.currentTarget.value)}
				><option value="">Status</option>{#each Object.entries(statuses) as [code, s]}<option
						value={code}>{s.label}</option
					>{/each}</select
			><select
				aria-label="Filter by priority"
				value={page.url.searchParams.get('priority') || ''}
				onchange={(e) => filter('priority', e.currentTarget.value)}
				><option value="">Priority</option><option value="high">High</option><option value="normal"
					>Normal</option
				><option value="low">Low</option></select
			><select
				aria-label="Filter by category"
				value={page.url.searchParams.get('category') || ''}
				onchange={(e) => filter('category', e.currentTarget.value)}
				><option value="">Category</option>{#each data.categories as c}<option value={c.id}
						>{c.name}</option
					>{/each}</select
			>
		</div>
		{#if listLoading}<TicketRowsSkeleton />{:else}<div class="rows" aria-busy={refreshing}>
				{#if composing || draft.dirty}<a
						href={'/app/tickets/new' + page.url.search}
						class="ticket-row"
						class:selected={composing}
						><span class="avatar row-avatar">{initials(person(draft.requesterId))}</span>
						<div class="row-content">
							<div class="row-title">
								<strong>{draft.subject.trim() || 'New ticket'}</strong><time>Draft</time>
							</div>
							<div class="row-meta">
								<span class="row-preview">{draft.description.trim() || 'Nothing written yet'}</span>
							</div>
						</div></a
					>{/if}
				{#each data.tickets as row}<a
						href={href(row.ticketNumber)}
						class="ticket-row"
						class:selected={highlighted === row.id}
						><span class="avatar row-avatar">{initials(person(row.requesterId))}</span>
						<div class="row-content">
							<div class="row-title">
								{#if row.priority === 'high'}<ChevronsUp class="high" size={17} />{/if}<strong
									>{row.subject}</strong
								><time
									>{new Date(row.updatedAt).toDateString() === new Date().toDateString()
										? time(row.updatedAt)
										: date(row.updatedAt)}</time
								>
							</div>
							<div class="row-meta">
								<StatusBadge status={row.statusCode} /><span class="row-requester"
									>{person(row.requesterId)} · #{row.ticketNumber}</span
								><span class="row-preview"
									>— {row.previewAuthor ? row.previewAuthor + ': ' : ''}{row.preview}</span
								>
							</div>
						</div></a
					>{:else}<div class="empty">
						<Inbox size={36} />
						<h2>No tickets here</h2>
						<p>Try another view or change your filters.</p>
						<a href="/app/tickets" class="text-link">Clear filters</a>
					</div>{/each}
			</div>{/if}
	</section>
	<section class="reading-pane" aria-label="Ticket conversation">
		{#if composing}{@render compose()}{:else if paneLoading && !t}<div class="conversation-scroll">
				<ConversationSkeleton heading />
			</div>{:else if t}<div class="reading-toolbar">
				<a
					href={'/app/tickets' + page.url.search}
					class="icon-button back"
					aria-label="Back to tickets"><ArrowLeft size={21} /></a
				>
				<div class="ticket-title">
					<h1>{t.subject}</h1>
					<p class="ticket-dates">
						<Tooltip.Root>
							<Tooltip.Trigger
								class="ticket-number"
								aria-label={`Copy ticket number #${t.ticketNumber}`}
								onclick={() => copy(`#${t?.ticketNumber}`, 'Ticket number copied')}
								>#{t.ticketNumber}</Tooltip.Trigger
							>
							<Tooltip.Content side="bottom" sideOffset={6}>Copy ticket number</Tooltip.Content>
						</Tooltip.Root>
						· Opened by {person(t.requesterId)} · {date(t.createdAt)}, {time(t.createdAt)} · Updated
						{date(t.updatedAt)}, {time(t.updatedAt)}
					</p>
				</div>
				{#if index >= 0}<span class="toolbar-position muted small"
						>{index + 1} of {data.tickets.length}</span
					>{/if}<a
					class="icon-button"
					aria-label="Previous ticket"
					aria-disabled={index <= 0}
					href={index > 0 ? href(data.tickets[index - 1].ticketNumber) : undefined}
					><ChevronLeft size={20} /></a
				><a
					class="icon-button"
					aria-label="Next ticket"
					aria-disabled={index < 0 || index >= data.tickets.length - 1}
					href={index >= 0 && index < data.tickets.length - 1
						? href(data.tickets[index + 1].ticketNumber)
						: undefined}><ChevronRight size={20} /></a
				><button
					class="icon-button"
					aria-label="Copy ticket link"
					onclick={() => copy(window.location.href, 'Link copied')}><Link size={20} /></button
				>{#if copied}<span class="copy-feedback" role="status">{copied}</span>{/if}
			</div>
			<div class="conversation-scroll">
				<div class="ticket-heading">
					<button class="mobile-details text-link" onclick={() => (details = !details)}
						>{details ? 'Hide details' : 'Show details'} <span>⌄</span></button
					>
					<div class="ticket-metadata" class:expanded={details}>
						{#if staff && !closed}{@render updateSelect(
								'statusCode',
								'Status',
								t.statusCode,
								Object.entries(statuses).map(([value, s]) => ({
									value,
									label: s.symbol + ' ' + s.label
								}))
							)}{@render updateSelect(
								'priority',
								'Priority',
								t.priority,
								['low', 'normal', 'high'].map((value) => ({
									value,
									label: (value === 'high' ? '⌃ ' : '') + value[0].toUpperCase() + value.slice(1)
								}))
							)}{@render updateSelect('assignedToUserId', 'Assignee', t.assignedToUserId || '', [
								{ value: '', label: 'Unassigned' },
								...assignees.map((p) => ({ value: p.id, label: p.name }))
							])}{@render updateSelect(
								'categoryId',
								'Category',
								t.categoryId,
								data.categories
									.filter((c) => c.active || c.id === t.categoryId)
									.map((c) => ({ value: c.id, label: c.name }))
							)}{:else}<StatusBadge status={t.statusCode} /><span class="metadata-pill"
								>Priority <strong>{t.priority}</strong></span
							><span class="metadata-pill"
								>Assignee <strong
									>{paneLoading
										? '…'
										: t.assignedToUserId
											? person(t.assignedToUserId)
											: 'Unassigned'}</strong
								></span
							><span class="metadata-pill">Category <strong>{cat(t.categoryId)}</strong></span>{/if}
					</div>
				</div>
				{#if form?.error && !paneLoading}<p role="alert" class="error feedback">
						{form.error}
					</p>{/if}{#if form?.success && !paneLoading}<p role="status" class="success feedback">
						{form.success}
					</p>{/if}
				<article class="message">
					<span class="avatar">{initials(person(t.requesterId))}</span>
					<div class="message-content">
						<div class="message-heading">
							<strong>{person(t.requesterId)}</strong><span class="role-tag">Requester</span><time
								>{date(t.createdAt)}, {time(t.createdAt)}</time
							>
						</div>
						<p class="message-caption">Opened this ticket</p>
						<p class="message-body">{t.description}</p>
					</div>
				</article>
				{#if paneLoading}<ConversationSkeleton />{:else}
					{#if timeline.length > 4 && !expanded}<div class="hidden-messages">
							<span class="count-pill">{timeline.length - 4}</span><span
								>Earlier replies and activity hidden</span
							><button class="text-link" onclick={() => (expanded = true)}>Show all</button>
						</div>{/if}
					{#each shown as item}{#if item.kind === 'comment'}{@render commentMessage(
								item.authorId,
								item.isInternal,
								`${date(item.createdAt)}, ${time(item.createdAt)}`,
								item.body
							)}{:else}<div class="activity">
								<span class="activity-icon"><ArrowRightLeft size={15} /></span>
								<p>
									<strong>{person(item.actorId)}</strong>
									{item.eventType === 'status'
										? 'changed status'
										: `changed ${{ assignedToUserId: 'assignee', categoryId: 'category', priority: 'priority' }[item.eventType] || item.eventType}`}
									from
									<span
										>{item.eventType === 'status'
											? statuses[item.details.from as keyof typeof statuses]?.label ||
												item.details.from
											: item.eventType === 'assignedToUserId'
												? item.details.from
													? person(item.details.from as string)
													: 'Unassigned'
												: item.eventType === 'categoryId'
													? cat(item.details.from as string)
													: item.details.from || 'Unassigned'}</span
									>
									to {#if item.eventType === 'status'}<StatusBadge
											status={String(item.details.to)}
										/>{:else}<strong
											>{item.eventType === 'assignedToUserId'
												? item.details.to
													? person(item.details.to as string)
													: 'Unassigned'
												: item.eventType === 'categoryId'
													? cat(item.details.to as string)
													: item.details.to || 'Unassigned'}</strong
										>{/if}
									<span class="muted">· {date(item.createdAt)}, {time(item.createdAt)}</span>
								</p>
							</div>{/if}{/each}
					{#if sendingMessage}{@render commentMessage(
							data.user.id,
							sendingMessage.isInternal,
							'Sending…',
							sendingMessage.body,
							true
						)}{/if}
					{#if sendError}<p role="alert" class="error feedback">{sendError}</p>{/if}
					{#if !closed}<form
							class="composer"
							class:note-mode={internal}
							method="POST"
							action="?/reply"
							use:enhance={() => {
								const text = body;
								sendingMessage = { body: text, isInternal: internal };
								sending = true;
								sendError = '';
								body = '';
								return async ({ result, update }) => {
									// A transport error would otherwise replace the page and lose the text.
									if (result.type === 'error')
										sendError = 'Couldn’t send. Your message is back in the box below.';
									else await update({ reset: false });
									sendingMessage = null;
									sending = false;
									if (result.type !== 'success') body = text;
								};
							}}
						>
							<div class="composer-tabs">
								<button type="button" class:chosen={!internal} onclick={() => (internal = false)}
									><MessageSquare size={16} /> Reply</button
								>{#if staff}<button
										type="button"
										class:chosen={internal}
										onclick={() => (internal = true)}
										><LockKeyhole size={16} /> Internal note</button
									>{/if}
							</div>
							<input type="hidden" name="internal" value={internal} /><textarea
								name="body"
								aria-label={internal ? 'Internal note' : 'Reply'}
								placeholder={internal
									? 'Add a private note for the support team…'
									: 'Write a reply…'}
								bind:value={body}
								required
								maxlength={10000}
								rows={4}></textarea>
							<div class="composer-footer">
								<span class="muted small"
									>{internal
										? 'Only visible to agents and administrators'
										: 'Visible to the requester and support team'}</span
								><Button
									type="submit"
									size="sm"
									class="rounded-full px-4 whitespace-nowrap"
									disabled={sending || !body.trim()}
									><Send size={15} />{sending
										? 'Sending…'
										: internal
											? 'Add note'
											: 'Send reply'}</Button
								>
							</div>
						</form>{:else}<div class="closed-banner">
							<LockKeyhole size={18} />
							<div>
								<strong>This ticket is closed</strong>
								<p>
									Closed tickets are read-only.{data.user.role === 'admin'
										? ' You can reopen this ticket below.'
										: ''}
								</p>
							</div>
						</div>{/if}
					{#if (t.statusCode === 'resolved' && (staff || t.requesterId === data.user.id)) || (closed && data.user.role === 'admin')}<form
							method="POST"
							action="?/update"
							use:enhance={() => {
								reopening = true;
								return async ({ update }) => {
									await update({ reset: false });
									reopening = false;
								};
							}}
							class="reopen"
						>
							<input type="hidden" name="field" value="statusCode" /><input
								type="hidden"
								name="value"
								value="open"
							/><Button
								type="submit"
								variant="outline"
								class="rounded-full h-9 px-5"
								disabled={reopening}>{reopening ? 'Reopening…' : 'Reopen ticket'}</Button
							>
						</form>{/if}
				{/if}
			</div>{:else}<div class="reading-empty">
				<span class="empty-icon"><Inbox size={35} /></span>
				<h2>Your workspace, in order.</h2>
				<p>Select a ticket to read the conversation<br />and keep things moving.</p>
				{#if !listLoading}<span class="small muted"
						>{openCategory
							? `${data.tickets.length} open ${openCategory.name} tickets`
							: `${data.tickets.length} tickets · ${title}`}</span
					>{/if}
			</div>{/if}
	</section>
</div>
<a class="mobile-new new-ticket" href="/app/tickets/new"><SquarePen size={23} /> New ticket</a>
