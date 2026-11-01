/**
 * Mirrors `active`, but only turns on after it has stayed true for `ms`.
 * Loading views use this so quick navigations never flash a placeholder.
 * Call during component setup, since it registers an effect.
 */
export function delayed(active: () => boolean, ms = 120) {
	let settled = $state(false);
	$effect(() => {
		if (!active()) {
			settled = false;
			return;
		}
		const timer = setTimeout(() => (settled = true), ms);
		return () => clearTimeout(timer);
	});
	return {
		get current() {
			return settled;
		}
	};
}
