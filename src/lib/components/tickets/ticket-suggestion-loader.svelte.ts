/** Part of a text, marked when it matched the search. */
export type HighlightSegment = { text: string; isMatch: boolean };

export type TicketSuggestion = {
	ticketNumber: number;
	subject: string;
	statusCode: string;
	subjectSegments?: HighlightSegment[];
	snippetSegments?: HighlightSegment[];
	metadataMatches?: { label: string; segments: HighlightSegment[] }[];
};

/** Queries shorter than this get no suggestions. */
export const MIN_SUGGESTION_QUERY_LENGTH = 2;
/** How long typing has to pause before suggestions are requested. */
const SUGGESTION_DELAY_MS = 200;

/**
 * Fetches ticket suggestions for the search box while it's focused, after a pause in typing.
 * A newer query cancels the request for an older one. Create it during component
 * initialisation, since it registers an effect.
 */
export class TicketSuggestionLoader {
	suggestions = $state<TicketSuggestion[]>([]);
	isLoading = $state(false);
	hasFailed = $state(false);

	constructor(readQuery: () => string, isActive: () => boolean, onQueryChange: () => void) {
		$effect(() => {
			const query = readQuery();
			const shouldLoad = isActive() && query.length >= MIN_SUGGESTION_QUERY_LENGTH;
			onQueryChange();
			this.suggestions = [];
			this.hasFailed = false;
			this.isLoading = shouldLoad;
			if (!shouldLoad) return;
			const controller = new AbortController();
			const timeout = setTimeout(() => this.#load(query, controller.signal), SUGGESTION_DELAY_MS);
			return () => {
				clearTimeout(timeout);
				controller.abort();
			};
		});
	}

	async #load(query: string, signal: AbortSignal): Promise<void> {
		try {
			const response = await fetch('/app/search/suggest?q=' + encodeURIComponent(query), {
				signal
			});
			if (!response.ok) throw new Error('Suggestion request failed');
			const result: { tickets: TicketSuggestion[] } = await response.json();
			if (!signal.aborted) this.suggestions = result.tickets;
		} catch {
			if (!signal.aborted) this.hasFailed = true;
		} finally {
			if (!signal.aborted) this.isLoading = false;
		}
	}
}
