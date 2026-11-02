import type { PageData } from './$types';

export type TicketListRow = PageData['tickets'][number];
/** A ticket in the reading pane: the full record, or its list row while that loads. */
export type DisplayedTicket = NonNullable<PageData['selectedTicket']> | TicketListRow;
export type PersonSummary = PageData['people'][number];
export type CategoryRecord = PageData['categories'][number];
export type TicketCommentRecord = PageData['comments'][number];
export type TicketEventRecord = PageData['events'][number];
export type SelectOption = { value: string; label: string };
