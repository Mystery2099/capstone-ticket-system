import { prefersReducedMotion } from 'svelte/motion';

/** Duration for Svelte transitions, which CSS reduced-motion rules can't reach. */
export const resolveMotionDuration = (durationMilliseconds: number) =>
	prefersReducedMotion.current ? 0 : durationMilliseconds;
