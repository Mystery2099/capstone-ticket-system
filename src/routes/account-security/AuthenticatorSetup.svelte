<!--
	Steps 1 and 2 of two-factor setup: connecting the authenticator app and saving the
	recovery codes. Verifying the first code, step 3, stays with the page's form.
-->
<script lang="ts">
	import { Download, ScanLine } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SetupStepHeading from './SetupStepHeading.svelte';
	import { downloadRecoveryCodes } from './authenticator-setup';

	type AuthenticatorSetupProps = {
		totpSecret: string;
		/** The QR code image, empty until it's drawn or if drawing it failed. */
		qrCodeUrl: string;
		qrCodeFailed: boolean;
		recoveryCodes: string[];
		hasSavedRecoveryCodes: boolean;
	};
	let {
		totpSecret,
		qrCodeUrl,
		qrCodeFailed,
		recoveryCodes,
		hasSavedRecoveryCodes = $bindable()
	}: AuthenticatorSetupProps = $props();
</script>

<div class="setup-grid">
	<section class="setup-panel" aria-labelledby="scan-heading">
		<SetupStepHeading stepNumber={1} id="scan-heading">Connect your authenticator</SetupStepHeading>
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
		<SetupStepHeading stepNumber={2} id="recovery-heading"
			>Save your recovery codes</SetupStepHeading
		>
		<p class="hint">
			Each code works once if you lose access to your authenticator. Store them somewhere private.
		</p>
		<div class="recovery-codes">
			{#each recoveryCodes as recoveryCode (recoveryCode)}<code>{recoveryCode}</code>{/each}
		</div>
		<Button type="button" variant="outline" onclick={() => downloadRecoveryCodes(recoveryCodes)}
			><Download size={16} />Download recovery codes</Button
		>
		<label class="saved-codes"
			><input type="checkbox" bind:checked={hasSavedRecoveryCodes} required /><span
				>I saved my recovery codes</span
			></label
		>
	</section>
</div>

<style>
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
	@media (max-width: 650px) {
		.setup-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
