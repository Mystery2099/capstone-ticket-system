<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Search, ArrowLeft, X } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { motionMs } from '$lib/motion';
	import { initials } from '$lib/status';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	let { data, form } = $props();
	let filter = $state(''),
		selectedId = $state(''),
		adding = $state(false),
		revision = $state(0),
		busy = $state('');
	onMount(() => {
		if (matchMedia('(min-width: 768px)').matches)
			selectedId = data.users.some((u) => u.id === 'jordan') ? 'jordan' : data.users[0]?.id || '';
	});
	let users = $derived(
		data.users.filter((u) => (u.name + ' ' + u.email).toLowerCase().includes(filter.toLowerCase()))
	);
	let selected = $derived(data.users.find((u) => u.id === selectedId));

	/**
	 * Marks `key` busy while a form submits. Edit forms keep their submitted values:
	 * the default reset restores HTML defaults, not saved data, so selects and
	 * checkboxes would show the wrong role and state, and the next save would write them.
	 */
	const submit =
		(key: string, reset = false): SubmitFunction =>
		() => {
			busy = key;
			return async ({ update }) => {
				await update({ reset });
				busy = '';
			};
		};
</script>

<div class="admin-workspace">
	<header class="admin-header">
		<h1>
			{data.section === 'users' ? 'Users' : 'Categories'}
			<span class="muted small"
				>{data.section === 'users' ? data.users.length : data.categories.length}</span
			>
		</h1>
		{#if data.section === 'users'}<div class="admin-filter">
				<Search size={17} />
				<Input
					aria-label="Filter users"
					placeholder="Filter users"
					bind:value={filter}
					class="h-9 w-[180px] border-0 bg-transparent font-normal max-[1199px]:w-[120px]"
				/>
			</div>
			<Button class="rounded-full h-9 px-4" onclick={() => (adding = true)}>
				<Plus size={17} /> Add user
			</Button>{/if}
	</header>
	{#if form?.error}<p class="error admin-feedback" role="alert">
			{form.error}
		</p>{/if}{#if form?.success}<p class="success admin-feedback" role="status">
			{form.success}
		</p>{/if}
	{#if data.section === 'users'}<div class="user-workspace" class:editing={!!selected}>
			<div class="user-table-scroll">
				<table class="users-table">
					<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Account</th></tr></thead><tbody
						>{#each users as u}<tr class:selected={selectedId === u.id}
								><td
									><button class="user-name" onclick={() => (selectedId = u.id)}
										><span class="avatar">{initials(u.name)}</span><span>{u.name}</span></button
									></td
								><td><button onclick={() => (selectedId = u.id)}>{u.email}</button></td><td
									><span class="role-tag" class:admin-role={u.role === 'admin'}
										>{u.role === 'admin'
											? 'Administrator'
											: u.role === 'agent'
												? 'Agent'
												: 'Requester'}</span
									></td
								><td
									><span class="account-state"
										><span class:disabled={!u.enabled}>●</span>{u.enabled
											? 'Enabled'
											: 'Disabled'}</span
									></td
								></tr
							>{/each}</tbody
					>
				</table>
			</div>
			{#if selected}<section class="user-editor">
					<header>
						<button
							class="icon-button editor-back"
							aria-label="Back to users"
							onclick={() => (selectedId = '')}><ArrowLeft size={20} /></button
						><span class="avatar">{initials(selected.name)}</span>
						<div>
							<h2>{selected.name}</h2>
							<p class="muted small">Account details</p>
						</div>
					</header>
					{#key `${selected.id}:${revision}`}<form
							method="POST"
							action="?/user"
							use:enhance={submit('user')}
						>
							<input type="hidden" name="id" value={selected.id} />
							<div class="editor-fields">
								<Label class="flex-col items-start gap-2 mb-5 text-[13px] text-muted-foreground">
									Display name<Input
										name="name"
										value={selected.name}
										required
										maxlength={100}
										class="h-9 font-normal"
									/>
								</Label>
								<Label class="flex-col items-start gap-2 mb-5 text-[13px] text-muted-foreground">
									Email<Input
										name="email"
										type="email"
										value={selected.email}
										required
										maxlength={254}
										class="h-9 font-normal"
									/>
								</Label>
								<Label class="flex-col items-start gap-2 mb-5 text-[13px] text-muted-foreground">
									Role<select name="role" value={selected.role}
										><option value="requester">Requester</option><option value="agent">Agent</option
										><option value="admin">Administrator</option></select
									><small>One role per user</small></Label
								>
								<Label class="checkbox-label mb-1">
									<input type="checkbox" name="enabled" value="true" checked={selected.enabled} /> Account
									enabled</Label
								>
								<p class="muted small">
									Disabled accounts can’t sign in. Their tickets and replies are kept.
								</p>
							</div>
							<footer>
								<Button variant="outline" class="rounded-full h-9 px-5" onclick={() => revision++}
									>Revert</Button
								>
								<Button type="submit" class="rounded-full h-9 px-5" disabled={busy === 'user'}>
									{busy === 'user' ? 'Saving…' : 'Save'}
								</Button>
							</footer>
						</form>{/key}
				</section>{/if}
		</div>{:else}<div class="categories-content">
			<form
				method="POST"
				action="?/category"
				use:enhance={submit('new-category', true)}
				class="category-form"
			>
				<Input
					placeholder="New category name"
					name="name"
					class="w-[260px] max-w-[60%] h-9 font-normal"
				/><Button type="submit" class="rounded-full h-9 px-4" disabled={busy === 'new-category'}
					><Plus size={16} /> {busy === 'new-category' ? 'Adding…' : 'Add category'}</Button
				>
			</form>
			<p class="muted small">
				Inactive categories stay on existing tickets but cannot be selected for new tickets.
			</p>
			<div class="table-wrapper">
				<table>
					<thead><tr><th>Category name</th><th>State</th><th></th></tr></thead><tbody
						>{#each data.categories as c}<tr
								><td colspan="3"
									><form
										method="POST"
										action="?/category"
										use:enhance={submit(c.id)}
										class="table-actions"
									>
										<input type="hidden" name="id" value={c.id} /><Input
											aria-label={'Name for ' + c.name}
											name="name"
											value={c.name}
											required
											maxlength={80}
											class="w-auto max-sm:w-[170px] h-9 font-normal"
										/><select
											aria-label={'State for ' + c.name}
											name="active"
											value={String(c.active)}
											><option value="true">Active</option><option value="false">Inactive</option
											></select
										><button class="text-link" disabled={busy === c.id}
											>{busy === c.id ? 'Saving…' : 'Save'}</button
										>
									</form></td
								></tr
							>{/each}</tbody
					>
				</table>
			</div>
		</div>{/if}
</div>
{#if adding}<div class="modal-overlay" transition:fade={{ duration: motionMs(120) }}>
		<section class="new-card">
			<div class="section-heading">
				<h1>Add user</h1>
				<button class="icon-button" aria-label="Cancel add user" onclick={() => (adding = false)}
					><X /></button
				>
			</div>
			<form
				method="POST"
				action="?/createUser"
				use:enhance={() => {
					busy = 'create-user';
					return async ({ result, update }) => {
						if (result.type === 'success') {
							adding = false;
							selectedId = String(result.data?.createdId);
						}
						await update();
						busy = '';
					};
				}}
			>
				<label>Display name<input name="name" required maxlength={100} /></label><label
					>Email<input name="email" type="email" required maxlength={254} /></label
				><label
					>Initial password<input
						name="password"
						type="password"
						required
						minlength={12}
						maxlength={128}
						autocomplete="new-password"
					/><small>At least 12 characters. Share directly with the account holder.</small></label
				><label
					>Role<select name="role"
						><option value="requester">Requester</option><option value="agent">Agent</option><option
							value="admin">Administrator</option
						></select
					></label
				>{#if form?.error}<p class="error">{form.error}</p>{/if}
				<div class="form-footer">
					<button type="button" class="outline" onclick={() => (adding = false)}>Cancel</button
					><button class="primary" disabled={busy === 'create-user'}
						>{busy === 'create-user' ? 'Creating…' : 'Create account'}</button
					>
				</div>
			</form>
		</section>
	</div>{/if}
