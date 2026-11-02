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
 * A newer search cancels the request for an older one. Create it during component
 * initialisation, since it registers an effect.
 */
export class TicketSuggestionLoader {
	suggestions = $state<TicketSuggestion[]>([]);
	isLoading = $state(false);
	hasFailed = $state(false);

	constructor(
		readSearchText: () => string,
		isActive: () => boolean,
		onSearchTextChange: () => void
	) {
		$effect(() => {
			const searchText = readSearchText();
			const shouldLoadSuggestions = isActive() && searchText.length >= MIN_SUGGESTION_QUERY_LENGTH;
			onSearchTextChange();
			this.suggestions = [];
			this.hasFailed = false;
			this.isLoading = shouldLoadSuggestions;
			if (!shouldLoadSuggestions) return;
			const suggestionRequestController = new AbortController();
			const suggestionDebounceTimeout = setTimeout(
				() => this.#loadSuggestions(searchText, suggestionRequestController.signal),
				SUGGESTION_DELAY_MS
			);
			return () => {
				clearTimeout(suggestionDebounceTimeout);
				suggestionRequestController.abort();
			};
		});
	}

	async #loadSuggestions(searchText: string, abortSignal: AbortSignal): Promise<void> {
		try {
			const response = await fetch('/app/search/suggest?q=' + encodeURIComponent(searchText), {
				signal: abortSignal
			});
			if (!response.ok) throw new Error('Suggestion request failed');
			const suggestionResponse: { tickets: TicketSuggestion[] } = await response.json();
			if (!abortSignal.aborted) this.suggestions = suggestionResponse.tickets;
		} catch {
			if (!abortSignal.aborted) this.hasFailed = true;
		} finally {
			if (!abortSignal.aborted) this.isLoading = false;
		}
	}
}
