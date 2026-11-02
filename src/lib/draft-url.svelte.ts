import { afterNavigate, replaceState } from '$app/navigation';
import { page } from '$app/state';

/** The part of a DraftStore this binding needs. */
export interface PromotableDraftStore<DraftType> {
	readonly blankDraft: DraftType;
	findById(id: string | null): DraftType | undefined;
	promoteBlankDraft(): void;
}

type DraftUrlBindingOptions = {
	/** Whether the new-record form is open. */
	isComposing: () => boolean;
	/** Whether a navigation is in flight, which would replace a URL set now. */
	isNavigating: () => boolean;
	/** The draft id of a pending navigation, which takes priority over the current URL. */
	readPendingDraftId?: () => string | null | undefined;
};

/**
 * Keeps a new-record form's draft in the URL, so a reload or a link reopens it. The form
 * starts on the store's blank draft. Once something is written, the draft joins the store
 * and its id is added to the URL with shallow routing.
 *
 * Create it during component initialisation, since it registers an effect and a navigation
 * callback.
 */
export class DraftUrlBinding<DraftType extends { id: string; isDirty: boolean }> {
	// Shallow routing leaves page.url as it was, so the id just added is tracked here.
	#promotedDraftId = $state<string | null>(null);
	readonly #draftStore: PromotableDraftStore<DraftType>;
	readonly #options: DraftUrlBindingOptions;

	constructor(draftStore: PromotableDraftStore<DraftType>, options: DraftUrlBindingOptions) {
		this.#draftStore = draftStore;
		this.#options = options;
		$effect(() => this.#promoteDirtyBlankDraft());
		afterNavigate(() => {
			this.#promotedDraftId = null;
		});
	}

	get draftId(): string | null {
		const pendingDraftId = this.#options.readPendingDraftId?.();
		if (pendingDraftId !== undefined) return pendingDraftId;
		return page.url.searchParams.get('draft') ?? this.#promotedDraftId;
	}

	/** The draft the form edits: the one named in the URL, or the blank draft. */
	get activeDraft(): DraftType {
		return this.#draftStore.findById(this.draftId) ?? this.#draftStore.blankDraft;
	}

	#promoteDirtyBlankDraft(): void {
		const draft = this.activeDraft;
		if (
			!this.#options.isComposing() ||
			this.#options.isNavigating() ||
			draft !== this.#draftStore.blankDraft ||
			!draft.isDirty
		)
			return;
		const url = new URL(page.url);
		url.searchParams.set('draft', draft.id);
		this.#promotedDraftId = draft.id;
		this.#draftStore.promoteBlankDraft();
		replaceState(url, {});
	}
}
