/**
 * Mirrors `isActive`, but only turns on after it has stayed true for `delayMilliseconds`.
 * Loading views use this so quick navigations never flash a placeholder.
 * Call during component setup, since it registers an effect.
 */
export function createDelayedFlag(isActive: () => boolean, delayMilliseconds = 120) {
	let isSettled = $state(false);
	$effect(() => {
		if (!isActive()) {
			isSettled = false;
			return;
		}
		const settleTimeout = setTimeout(() => (isSettled = true), delayMilliseconds);
		return () => clearTimeout(settleTimeout);
	});
	return {
		get current() {
			return isSettled;
		}
	};
}
