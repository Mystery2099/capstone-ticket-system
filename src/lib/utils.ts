import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve Tailwind utility conflicts,
 * so later classes win (e.g. a size override passed to a shared component).
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/* Standard shadcn-svelte component property helpers. */

export type WithoutChild<T> = Omit<T, 'child'>;
export type WithoutChildren<T> = WithoutChild<Omit<T, 'children'>>;
export type WithoutChildrenOrChild<T> = WithoutChildren<Omit<T, 'child'>>;
export type WithElementRef<T, E extends HTMLElement = HTMLElement> = T & { ref?: E | null };
