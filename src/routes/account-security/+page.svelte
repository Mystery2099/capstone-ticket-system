<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ShieldCheck, Download, ScanLine, KeyRound } from '@lucide/svelte';
	let { data } = $props();
	let password = $state('');
	let verificationCode = $state('');
	let isUsingRecoveryCode = $state(false);
	let totpSecret = $state('');
	let qrCodeUrl = $state('');
	let qrCodeFailed = $state(false);
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

	function downloadRecoveryCodes(): void {
		const contents = [
			'Ticket System recovery codes',
			'',
			'Each code can be used once. Keep this file somewhere private.',
			'',
			...backupCodes,
			''
		].join('\n');
		const downloadUrl = URL.createObjectURL(
			new Blob([contents], { type: 'text/plain;charset=utf-8' })
		);
		const downloadLink = document.createElement('a');
		downloadLink.href = downloadUrl;
		downloadLink.download = 'ticket-system-recovery-codes.txt';
		document.body.append(downloadLink);
		downloadLink.click();
		downloadLink.remove();
		setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
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
				try {
					const { default: qrCode } = await import('qrcode');
					qrCodeUrl = await qrCode.toDataURL(result.data.totpURI, {
						width: 256,
						margin: 4,
						errorCorrectionLevel: 'M'
					});
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
					<div class="setup-grid">
						<section class="setup-panel" aria-labelledby="scan-heading">
							<h2 id="scan-heading">
								<span class="step-number">1</span>Connect your authenticator
							</h2>
							<p class="hint">Scan this QR code with your authenticator app.</p>
							{#if qrCodeUrl}<img
									class="setup-qr"
									src={qrCodeUrl}
									width="256"
									height="256"
									alt="QR code for authenticator setup"
								/>{:else}<div class="qr-placeholder" role="status">
									<ScanLine size={32} /><span
										>{qrCodeFailed ? 'Use the setup key below.' : 'Preparing QR code…'}</span
									>
								</div>{/if}
							<details>
								<summary>Can’t scan? Use the setup key</summary>
								<p class="hint">Add a time-based account and enter this key:</p>
								<code class="setup-key">{totpSecret}</code>
							</details>
						</section>
						<section class="setup-panel" aria-labelledby="recovery-heading">
							<h2 id="recovery-heading">
								<span class="step-number">2</span>Save your recovery codes
							</h2>
							<p class="hint">
								Each code works once if you lose access to your authenticator. Store them somewhere
								private.
							</p>
							<div class="recovery-codes">
								{#each backupCodes as backupCode (backupCode)}<code>{backupCode}</code>{/each}
							</div>
							<Button type="button" variant="outline" onclick={downloadRecoveryCodes}
								><Download size={16} />Download recovery codes</Button
							>
							<label class="saved-codes"
								><input type="checkbox" bind:checked={hasSavedBackupCodes} required /><span
									>I saved my recovery codes</span
								></label
							>
						</section>
					</div>
				{/if}
				<section class="verification-fields" aria-label="Verify authenticator">
					{#if totpSecret}<h2><span class="step-number">3</span>Verify your authenticator</h2>
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
					disabled={isSubmitting || (!!totpSecret && !hasSavedBackupCodes)}
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
	.setup-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}
	.setup-panel {
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: 12px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 14px;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 9px;
		font-weight: 600;
		font-size: 14px;
		margin: 0;
	}
	.step-number {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--muted);
		font-size: 12px;
		flex-shrink: 0;
	}
	.hint {
		color: var(--muted-fg);
		font-size: 13px;
		line-height: 1.6;
		margin: 0;
	}
	.setup-qr,
	.qr-placeholder {
		width: 100%;
		max-width: 224px;
		aspect-ratio: 1;
		height: auto;
		align-self: center;
		border-radius: 8px;
	}
	.qr-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 12px;
		background: white;
		color: #333;
		font-size: 12px;
	}
	summary {
		cursor: pointer;
		font-size: 12px;
		color: var(--primary);
	}
	details .hint {
		margin-top: 10px;
	}
	.setup-key {
		display: block;
		overflow-wrap: anywhere;
		user-select: all;
		font-size: 12px;
		line-height: 1.7;
		margin-top: 8px;
	}
	.recovery-codes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		padding: 16px;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.recovery-codes code {
		user-select: all;
		font-size: 12px;
		line-height: 1.6;
		white-space: nowrap;
	}
	.saved-codes {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		cursor: pointer;
		margin-top: 2px;
	}
	.saved-codes input {
		width: 16px;
		height: 16px;
		min-width: 16px;
		margin: 0;
		padding: 0;
		flex: none;
		appearance: auto;
		accent-color: var(--primary);
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
	@media (max-width: 650px) {
		.security-page {
			padding: 20px 12px;
		}
		.security-card {
			padding: 22px 18px;
		}
		.setup-grid {
			grid-template-columns: 1fr;
		}
		h1 {
			font-size: 19px;
		}
	}
</style>
