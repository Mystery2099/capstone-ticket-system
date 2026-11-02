import { parse } from 'devalue';
import { invalidateAll } from '$app/navigation';

type TicketListBatch<Row> = { tickets: Row[]; nextPageHref: string | null };

/**
 * The ticket list's rows, starting with the page data's first batch and growing as later
 * batches load on scroll.
 */
export class TicketListLoader<Row extends { id: string }> {
	rows = $state<Row[]>([]);
	nextPageHref = $state<string | null>(null);
	isLoadingMore = $state(false);
	loadMoreError = $state('');
	/** Changes whenever the list starts over, so the virtual list can remount. */
	resetVersion = $state(0);

	#loadedListKey = '';
	#loadedTicketRoute: string | undefined;
	#resetOnNextPageData = false;
	#requestVersion = 0;
	#requestController: AbortController | undefined;

	/** Starts with the page data's first batch, so the list renders on the server too. */
	constructor(firstRows: Row[], nextPageHref: string | null) {
		this.rows = firstRows;
		this.nextPageHref = nextPageHref;
	}

	/**
	 * Takes the first batch from newly loaded page data. Only navigation between
	 * conversations keeps later batches. A reload of the same route is authoritative, since
	 * actions may have changed which tickets belong in the view.
	 */
	acceptPageData(
		firstRows: Row[],
		nextPageHref: string | null,
		listKey: string,
		ticketRoute: string
	) {
		this.cancelPendingRequest();
		const shouldReset = this.#resetOnNextPageData || this.#loadedTicketRoute === ticketRoute;
		if (shouldReset || this.#loadedListKey !== listKey || !this.rows.length) {
			if (shouldReset) this.resetVersion++;
			this.rows = firstRows;
			this.nextPageHref = nextPageHref;
		} else {
			const updatedRowIds = new Set(firstRows.map((row) => row.id));
			this.rows = [...firstRows, ...this.rows.filter((row) => !updatedRowIds.has(row.id))];
		}
		this.#loadedListKey = listKey;
		this.#loadedTicketRoute = ticketRoute;
		this.#resetOnNextPageData = false;
	}

	async loadMore(currentUrl: URL): Promise<void> {
		if (!this.nextPageHref || this.isLoadingMore) return;
		const requestVersion = this.#requestVersion;
		const controller = new AbortController();
		this.#requestController = controller;
		this.isLoadingMore = true;
		this.loadMoreError = '';
		try {
			const url = new URL(this.nextPageHref, currentUrl);
			url.pathname = '/app/tickets/list';
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) throw new Error('Ticket list request failed');
			const batch = parse(await response.text()) as TicketListBatch<Row>;
			if (requestVersion !== this.#requestVersion) return;
			const existingRowIds = new Set(this.rows.map((row) => row.id));
			this.rows = [...this.rows, ...batch.tickets.filter((row) => !existingRowIds.has(row.id))];
			this.nextPageHref = batch.nextPageHref;
		} catch {
			if (requestVersion === this.#requestVersion && !controller.signal.aborted)
				this.loadMoreError = 'Couldn’t load more tickets.';
		} finally {
			if (requestVersion === this.#requestVersion) this.isLoadingMore = false;
		}
	}

	/**
	 * Reloads the page data and starts the list over from its first batch.
	 *
	 * @throws when the page data couldn't be reloaded
	 */
	async refresh(): Promise<void> {
		this.cancelPendingRequest();
		this.#resetOnNextPageData = true;
		try {
			await invalidateAll();
		} catch (caughtError) {
			this.#resetOnNextPageData = false;
			throw caughtError;
		}
	}

	/** Aborts any batch in flight, for when the list goes away. */
	dispose(): void {
		this.#requestController?.abort();
	}

	/** Stops any batch in flight, so its result is ignored. */
	cancelPendingRequest(): void {
		this.#requestController?.abort();
		this.#requestVersion++;
		this.isLoadingMore = false;
		this.loadMoreError = '';
	}
}
