<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { PERMISSION_LABELS } from '$lib/permissions';
	import Combobox from '$lib/components/Combobox.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import AdminWorkspace from './AdminWorkspace.svelte';
	import AdminDetailsToolbar from './AdminDetailsToolbar.svelte';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	let filterText = $state('');
	let copyRoleId = $state('');
	let selectedRole = $derived(
		data.roles.find((role) => role.id === page.url.searchParams.get('id'))
	);
	let isCreating = $derived(page.url.searchParams.has('new'));
	let isProtected = $derived(selectedRole?.id === 'admin');
	let sourceRole = $derived(
		isCreating ? data.roles.find((role) => role.id === copyRoleId) : selectedRole
	);
	let members = $derived(data.users.filter((person) => person.role === selectedRole?.id));
	let replacements = $derived(
		data.roles.filter((role) => role.id !== selectedRole?.id && role.id !== 'admin')
	);
	const editablePermissions = Object.entries(PERMISSION_LABELS).filter(
		([permission]) => permission !== 'manageAdministration'
	);
</script>

<AdminWorkspace
	title="Roles"
	recordNoun="role"
	recordCount={data.roles.length}
	isPaneOpen={isCreating || !!selectedRole}
	bind:filterText
>
	{#snippet filters()}{/snippet}
	{#snippet rows()}
		{#each data.roles.filter((role) => role.name
				.toLowerCase()
				.includes(filterText.trim().toLowerCase())) as role (role.id)}
			<a class="ticket-row" class:selected={selectedRole?.id === role.id} href={'?id=' + role.id}>
				<strong>{role.name}</strong>
				<span class="muted small"
					>{data.users.filter((person) => person.role === role.id).length} users · {role.id ===
					'admin'
						? 'Protected'
						: role.permissions.length + ' permissions'}</span
				>
			</a>
		{/each}
	{/snippet}
	{#snippet pane()}
		<AdminDetailsToolbar
			title={isCreating ? 'Add role' : (selectedRole?.name ?? 'Role')}
			subtitle={isProtected
				? 'Administrator permissions are protected'
				: 'Choose what users with this role can do'}
			recordNoun="role"
			listHref="/app/admin/roles"
		/>
		<div class="conversation-scroll flex flex-col gap-5 p-5">
			{#if form?.roleError}<p class="error" role="alert">{form.roleError}</p>{/if}
			{#if isCreating}
				<label class="flex flex-col gap-2"
					>Copy permissions from
					<Combobox
						label="Copy permissions from"
						bind:value={copyRoleId}
						options={[
							{ value: '', label: 'Start with no permissions' },
							...data.roles.map((role) => ({ value: role.id, label: role.name }))
						]}
					/>
				</label>
			{/if}
			{#key (selectedRole?.id ?? 'new') + copyRoleId}
				<form method="POST" action="?/saveRole" use:enhance class="flex flex-col gap-5">
					<input type="hidden" name="id" value={isCreating ? '' : (selectedRole?.id ?? '')} />
					<label class="flex flex-col gap-2"
						>Role name
						<input
							name="name"
							value={isCreating ? '' : (selectedRole?.name ?? '')}
							required
							maxlength={80}
							disabled={isProtected}
						/>
					</label>
					<fieldset disabled={isProtected} class="flex flex-col gap-3">
						<legend class="mb-3 font-semibold">Permissions</legend>
						{#each editablePermissions as [permission, label] (permission)}
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									name="permissions"
									value={permission}
									checked={sourceRole?.permissions.some((selected) => selected === permission) ??
										false}
								/>
								{label}
							</label>
						{/each}
						{#if isProtected}<p class="muted small">
								Administrator also manages users, categories, and roles.
							</p>{/if}
					</fieldset>
					{#if !isProtected}<Button type="submit" size="pill-sm"
							>{isCreating ? 'Create role' : 'Save role'}</Button
						>{/if}
				</form>
			{/key}
			{#if selectedRole && !isCreating && !isProtected}
				<form
					method="POST"
					action="?/deleteRole"
					use:enhance
					class="flex flex-col gap-3 border-t border-border pt-5"
				>
					<input type="hidden" name="id" value={selectedRole.id} />
					<strong>Delete role</strong>
					<p class="muted small">
						{members.length} users have this role. Reassigned users will need to sign in again.
					</p>
					{#if members.length}
						<label class="flex flex-col gap-2"
							>Reassign users to
							<select name="replacementRoleId" required>
								<option value="">Choose a replacement role</option>
								{#each replacements as role (role.id)}<option value={role.id}>{role.name}</option
									>{/each}
							</select>
						</label>
					{/if}
					<Button
						type="submit"
						variant="outline"
						size="pill-sm"
						disabled={members.length > 0 && !replacements.length}>Delete role</Button
					>
				</form>
			{/if}
		</div>
	{/snippet}
</AdminWorkspace>
