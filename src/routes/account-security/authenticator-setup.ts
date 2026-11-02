/** Helpers for connecting an authenticator app during two-factor setup. */

const RECOVERY_CODES_FILE_NAME = 'ticket-system-recovery-codes.txt';
const QR_CODE_SIZE = 256;

/** Saves the recovery codes as a text file through the browser's download. */
export function downloadRecoveryCodes(recoveryCodes: string[]): void {
	const contents = [
		'Ticket System recovery codes',
		'',
		'Each code can be used once. Keep this file somewhere private.',
		'',
		...recoveryCodes,
		''
	].join('\n');
	const downloadUrl = URL.createObjectURL(
		new Blob([contents], { type: 'text/plain;charset=utf-8' })
	);
	const downloadLink = document.createElement('a');
	downloadLink.href = downloadUrl;
	downloadLink.download = RECOVERY_CODES_FILE_NAME;
	document.body.append(downloadLink);
	downloadLink.click();
	downloadLink.remove();
	setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

/**
 * Draws the authenticator link as a QR code image. The library is loaded only when needed.
 *
 * @returns a data URL for an image
 * @throws when the QR code can't be drawn
 */
export async function createAuthenticatorQrCode(totpUri: string): Promise<string> {
	const { default: qrCode } = await import('qrcode');
	return qrCode.toDataURL(totpUri, {
		width: QR_CODE_SIZE,
		margin: 4,
		errorCorrectionLevel: 'M'
	});
}

/** The secret key in an authenticator link, for typing in by hand. */
export function readTotpSecret(totpUri: string): string {
	return new URL(totpUri).searchParams.get('secret') || '';
}
