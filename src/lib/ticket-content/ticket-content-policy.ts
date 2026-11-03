/**
 * The formatting rules every ticket message follows. Descriptions, comments and internal
 * notes are stored as Markdown text, but people only ever see formatted text: the editor
 * writes the Markdown, and the renderer turns it back into formatted text.
 */

/** Messages may only link to web and email addresses. Anything else stays plain text. */
const ALLOWED_LINK_PATTERN = /^(https?:\/\/|mailto:)/i;

/** Whether a link target is safe to show as a clickable link. */
export function isAllowedLinkTarget(linkTarget: string): boolean {
	return ALLOWED_LINK_PATTERN.test(linkTarget.trim());
}

/**
 * Turns what someone typed into the link box into a link target, or null when it can't be
 * one. A bare address such as example.com gets https:// in front of it.
 */
export function normalizeLinkTarget(typedLinkTarget: string): string | null {
	const trimmedLinkTarget = typedLinkTarget.trim();
	if (!trimmedLinkTarget) return null;
	if (isAllowedLinkTarget(trimmedLinkTarget)) return trimmedLinkTarget;
	// Some other scheme, such as javascript:, is refused rather than repaired.
	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedLinkTarget)) return null;
	return `https://${trimmedLinkTarget}`;
}
