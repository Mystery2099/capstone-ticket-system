<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	let { data } = $props();
	let password = $state('');
	let verificationCode = $state('');
	let isUsingRecoveryCode = $state(false);
	let totpSecret = $state('');
	let backupCodes = $state<string[]>([]);
	let hasSavedBackupCodes = $state(false);
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	function buildVerificationErrorMessage(status: number): string {
		if (status === 429) return 'Too many attempts. Please wait and try again.';
		if (status === 0) return 'Could not connect. Please try again.';
		if (status >= 500) return 'Verification is temporarily unavailable. Please try again.';
		return 'Verification failed. Check your password or code and try again.';
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		isSubmitting = true;
		errorMessage = '';
		try {
			if (data.isEnrolling && !totpSecret) {
				const result = await authClient.twoFactor.enable({ password });
				if (result.error) {
					errorMessage = buildVerificationErrorMessage(result.error.status);
					return;
				}
				if (result.data.method !== 'totp') {
					errorMessage = 'Authenticator setup is temporarily unavailable. Please try again.';
					return;
				}
				password = '';
				totpSecret = new URL(result.data.totpURI).searchParams.get('secret') || '';
				backupCodes = result.data.backupCodes;
				return;
			}
			const result = isUsingRecoveryCode
				? await authClient.twoFactor.verifyBackupCode({
						code: verificationCode,
						trustDevice: false
					})
				: await authClient.twoFactor.verifyTotp({ code: verificationCode, trustDevice: false });
			if (result.error) {
				errorMessage = buildVerificationErrorMessage(result.error.status);
				return;
			}
			verificationCode = '';
			totpSecret = '';
			backupCodes = [];
			await invalidateAll();
			await goto('/app/tickets');
		} catch {
			errorMessage = 'Could not connect. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="login-page">
	<section class="login-card max-w-lg">
		<h1>{data.isEnrolling ? 'Set up your authenticator' : 'Verify your sign-in'}</h1>
		<p class="my-4">
			{data.isEnrolling
				? 'Administrators must use two-factor authentication before opening the workspace.'
				: 'Enter a code from your authenticator, or use one of your saved recovery codes.'}
		</p>
		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			{#if data.isEnrolling && !totpSecret}
				<Label for="security-password">Current password</Label>
				<Input
					id="security-password"
					type="password"
					autocomplete="current-password"
					bind:value={password}
					required
				/>
			{:else}
				{#if totpSecret}
					<p>Add a time-based account in your authenticator using this setup key:</p>
					<code class="break-all select-all">{totpSecret}</code>
					<p>
						Save these single-use recovery codes in a password manager. They let you sign in if you
						lose your authenticator.
					</p>
					<div class="grid grid-cols-2 gap-2">
						{#each backupCodes as backupCode (backupCode)}<code class="select-all"
								>{backupCode}</code
							>{/each}
					</div>
					<label class="flex gap-2 items-center"
						><input type="checkbox" bind:checked={hasSavedBackupCodes} required /> I saved my recovery
						codes</label
					>
				{/if}
				<Label for="security-code"
					>{isUsingRecoveryCode ? 'Recovery code' : 'Authenticator code'}</Label
				>
				<Input
					id="security-code"
					autocomplete="one-time-code"
					bind:value={verificationCode}
					required
				/>
				{#if !data.isEnrolling}<button
						class="text-link"
						type="button"
						onclick={() => {
							isUsingRecoveryCode = !isUsingRecoveryCode;
							verificationCode = '';
						}}>{isUsingRecoveryCode ? 'Use authenticator' : 'Use a recovery code'}</button
					>{/if}
			{/if}
			{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
			<Button type="submit" disabled={isSubmitting || (!!totpSecret && !hasSavedBackupCodes)}
				>{isSubmitting
					? 'Verifying…'
					: data.isEnrolling && !totpSecret
						? 'Start setup'
						: 'Verify'}</Button
			>
			<a href="/login" class="text-link">Back to sign in</a>
		</form>
	</section>
</div>
