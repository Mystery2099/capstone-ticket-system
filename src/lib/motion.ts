import { prefersReducedMotion } from 'svelte/motion';

/** Duration for Svelte transitions, which CSS reduced-motion rules can't reach. */
export const motionMs = (duration: number) => (prefersReducedMotion.current ? 0 : duration);
