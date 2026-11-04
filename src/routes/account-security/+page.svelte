<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ShieldCheck, KeyRound } from '@lucide/svelte';
	import AuthenticatorSetup from './AuthenticatorSetup.svelte';
	import SetupStepHeading from './SetupStepHeading.svelte';
	import { createAuthenticatorQrCode, readTotpSecret } from './authenticator-setup';
	let { data } = $props();
	let password = $state('');
	let verificationCode = $state('');
	let isUsingRecoveryCode = $state(false);
	let totpSecret = $state('');
	let qrCodeUrl = $state('');
	let qrCodeFailed = $state(false);
	let recoveryCodes = $state<string[]>([]);
	let hasSavedRecoveryCodes = $state(false);
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
				totpSecret = readTotpSecret(result.data.totpURI);
				recoveryCodes = result.data.backupCodes;
				try {
					qrCodeUrl = await createAuthenticatorQrCode(result.data.totpURI);
				} catch {
					qrCodeFailed = true;
				}
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
			qrCodeUrl = '';
			totpSecret = '';
			recoveryCodes = [];
			await invalidateAll();
			await goto('/app/tickets');
		} catch {
			errorMessage = 'Could not connect. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head
	><title
		>{data.isEnrolling ? 'Set up two-factor authentication' : 'Verify sign-in'} · Ticket System</title
	></svelte:head
>

<main class="security-page">
	<section class="security-card" class:enrolling={!!totpSecret} aria-labelledby="security-heading">
		<header class="security-heading">
			<span class="security-icon"><ShieldCheck size={26} /></span>
			<div>
				<p class="eyebrow">Account security</p>
				<h1 id="security-heading">
					{data.isEnrolling ? 'Set up your authenticator' : 'Verify your sign-in'}
				</h1>
			</div>
		</header>
		<p class="intro">
			{data.isEnrolling
				? 'Protect your administrator account with a second sign-in step.'
				: 'Enter a code from your authenticator, or use a saved recovery code.'}
		</p>
		<form onsubmit={handleSubmit}>
			{#if data.isEnrolling && !totpSecret}
				<div class="verification-fields">
					<Label for="security-password">Confirm your password</Label><Input
						id="security-password"
						aria-label="Current password"
						type="password"
						autocomplete="current-password"
						bind:value={password}
						required
					/>
					<p class="hint">Next, connect your authenticator and save your recovery codes.</p>
				</div>
			{:else}
				{#if totpSecret}
					<AuthenticatorSetup
						{totpSecret}
						{qrCodeUrl}
						{qrCodeFailed}
						{recoveryCodes}
						bind:hasSavedRecoveryCodes
					/>
				{/if}
				<section class="verification-fields" aria-label="Verify authenticator">
					{#if totpSecret}<SetupStepHeading stepNumber={3}
							>Verify your authenticator</SetupStepHeading
						>
						<p class="hint">Enter the six-digit code shown in your authenticator app.</p>{/if}
					<Label for="security-code"
						>{isUsingRecoveryCode ? 'Recovery code' : 'Authenticator code'}</Label
					>
					<Input
						id="security-code"
						autocomplete="one-time-code"
						inputmode={isUsingRecoveryCode ? 'text' : 'numeric'}
						bind:value={verificationCode}
						required
					/>
					{#if !data.isEnrolling}<button
							class="recovery-toggle"
							type="button"
							onclick={() => {
								isUsingRecoveryCode = !isUsingRecoveryCode;
								verificationCode = '';
							}}
							><KeyRound size={15} />{isUsingRecoveryCode
								? 'Use authenticator'
								: 'Use a recovery code'}</button
						>{/if}
				</section>
			{/if}
			{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
			<footer>
				<a href="/login">Back to sign in</a><Button
					type="submit"
					disabled={isSubmitting || (!!totpSecret && !hasSavedRecoveryCodes)}
					>{isSubmitting
						? 'Verifying…'
						: data.isEnrolling && !totpSecret
							? 'Start setup'
							: 'Verify'}</Button
				>
			</footer>
		</form>
	</section>
</main>

<style>
	.security-page {
		min-height: 100dvh;
		padding: 40px 20px;
		display: grid;
		place-items: center;
		background: var(--background);
	}
	.security-card {
		width: 100%;
		max-width: 480px;
		padding: 32px;
		border: 1px solid var(--border);
		border-radius: 20px;
		background: var(--card);
		box-shadow: 0 12px 40px #0000000d;
	}
	.security-card.enrolling {
		max-width: 820px;
	}
	.security-heading {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.security-icon {
		display: grid;
		place-items: center;
		background: var(--muted);
		color: var(--primary);
		border-radius: 12px;
		width: 50px;
		height: 50px;
		flex-shrink: 0;
	}
	h1 {
		font-size: 22px;
		line-height: 1.3;
		font-weight: 650;
		margin: 0;
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--muted-fg);
		margin: 0 0 4px;
	}
	.intro {
		margin: 18px 0 24px;
		color: var(--muted-fg);
		font-size: 14px;
		line-height: 1.6;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.hint {
		color: var(--muted-fg);
		font-size: 13px;
		line-height: 1.6;
		margin: 0;
	}
	.verification-fields {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 10px;
	}
	.recovery-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--primary);
		align-self: flex-start;
	}
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border-top: 1px solid var(--border);
		padding-top: 20px;
	}
	footer a {
		color: var(--primary);
		font-size: 13px;
	}
	.recovery-toggle:hover,
	footer a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	@media (max-width: 650px) {
		.security-page {
			padding: 20px 12px;
		}
		.security-card {
			padding: 22px 18px;
		}
		h1 {
			font-size: 19px;
		}
	}
</style>
