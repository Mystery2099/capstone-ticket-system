<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	let { data } = $props();
	let password = $state('');
	let code = $state('');
	let recovery = $state(false);
	let secret = $state('');
	let backupCodes = $state<string[]>([]);
	let savedCodes = $state(false);
	let busy = $state(false);
	let problem = $state('');

	function verificationError(status: number): string {
		if (status === 429) return 'Too many attempts. Please wait and try again.';
		if (status === 0) return 'Could not connect. Please try again.';
		if (status >= 500) return 'Verification is temporarily unavailable. Please try again.';
		return 'Verification failed. Check your password or code and try again.';
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		busy = true;
		problem = '';
		try {
			if (data.enrollment && !secret) {
				const result = await authClient.twoFactor.enable({ password });
				if (result.error) {
					problem = verificationError(result.error.status);
					return;
				}
				if (result.data.method !== 'totp') {
					problem = 'Authenticator setup is temporarily unavailable. Please try again.';
					return;
				}
				password = '';
				secret = new URL(result.data.totpURI).searchParams.get('secret') || '';
				backupCodes = result.data.backupCodes;
				return;
			}
			const result = recovery
				? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: false })
				: await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
			if (result.error) {
				problem = verificationError(result.error.status);
				return;
			}
			code = '';
			secret = '';
			backupCodes = [];
			await invalidateAll();
			await goto('/app/tickets');
		} catch {
			problem = 'Could not connect. Please try again.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="login-page">
	<section class="login-card max-w-lg">
		<h1>{data.enrollment ? 'Set up your authenticator' : 'Verify your sign-in'}</h1>
		<p class="my-4">
			{data.enrollment
				? 'Administrators must use two-factor authentication before opening the workspace.'
				: 'Enter a code from your authenticator, or use one of your saved recovery codes.'}
		</p>
		<form onsubmit={submit} class="flex flex-col gap-4">
			{#if data.enrollment && !secret}
				<Label for="security-password">Current password</Label>
				<Input
					id="security-password"
					type="password"
					autocomplete="current-password"
					bind:value={password}
					required
				/>
			{:else}
				{#if secret}
					<p>Add a time-based account in your authenticator using this setup key:</p>
					<code class="break-all select-all">{secret}</code>
					<p>
						Save these single-use recovery codes in a password manager. They let you sign in if you
						lose your authenticator.
					</p>
					<div class="grid grid-cols-2 gap-2">
						{#each backupCodes as backupCode}<code class="select-all">{backupCode}</code>{/each}
					</div>
					<label class="flex gap-2 items-center"
						><input type="checkbox" bind:checked={savedCodes} required /> I saved my recovery codes</label
					>
				{/if}
				<Label for="security-code">{recovery ? 'Recovery code' : 'Authenticator code'}</Label>
				<Input id="security-code" autocomplete="one-time-code" bind:value={code} required />
				{#if !data.enrollment}<button
						class="text-link"
						type="button"
						onclick={() => {
							recovery = !recovery;
							code = '';
						}}>{recovery ? 'Use authenticator' : 'Use a recovery code'}</button
					>{/if}
			{/if}
			{#if problem}<p class="error" role="alert">{problem}</p>{/if}
			<Button type="submit" disabled={busy || (!!secret && !savedCodes)}
				>{busy ? 'Verifying…' : data.enrollment && !secret ? 'Start setup' : 'Verify'}</Button
			>
			<a href="/login" class="text-link">Back to sign in</a>
		</form>
	</section>
</div>
