import { createContext, type Component } from 'svelte';

/** One ticket list view, as linked from the sidebar and the phone view chips. */
export interface TicketViewLink {
	key: string;
	label: string;
	hint: string;
	icon: Component;
	count: number;
}

/** The app layout owns the views; the ticket page reads them for its phone chips. */
export const [getTicketViewLinks, setTicketViewLinks] = createContext<() => TicketViewLink[]>();
