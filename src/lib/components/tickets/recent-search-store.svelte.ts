/** How many recent searches are remembered. */
const MAX_RECENT_SEARCHES = 5;

/** A person's latest searches, kept in this browser. Storage is optional, so failures are ignored. */
export class RecentSearchStore {
	searches = $state<string[]>([]);
	readonly #storageKey: string;

	constructor(userId: string) {
		this.#storageKey = `ticket-searches:${userId}`;
	}

	load(): void {
		try {
			const savedSearches = JSON.parse(localStorage.getItem(this.#storageKey) ?? '[]');
			if (Array.isArray(savedSearches))
				this.searches = savedSearches
					.filter((search) => typeof search === 'string')
					.slice(0, MAX_RECENT_SEARCHES);
		} catch {
			// Storage can be disabled.
		}
	}

	/** Moves the search to the top of the list. Empty searches aren't remembered. */
	remember(search: string): void {
		if (!search) return;
		this.searches = [search, ...this.searches.filter((existing) => existing !== search)].slice(
			0,
			MAX_RECENT_SEARCHES
		);
		try {
			localStorage.setItem(this.#storageKey, JSON.stringify(this.searches));
		} catch {
			// Search still works without storage.
		}
	}

	clear(): void {
		this.searches = [];
		try {
			localStorage.removeItem(this.#storageKey);
		} catch {
			// Optional storage.
		}
	}
}
