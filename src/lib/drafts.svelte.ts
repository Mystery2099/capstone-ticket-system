import { createContext, onMount } from 'svelte';
import { on } from 'svelte/events';

/** How long typing has to pause before drafts are written to storage. */
const SAVE_DELAY_MS = 300;

const generateDraftId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export type TicketDraftFields = {
	id: string;
	subject: string;
	description: string;
	categoryId: string;
	priority: string;
	assignedToUserId: string;
	requesterId: string;
};

export class TicketDraft {
	id: string;
	subject = $state('');
	description = $state('');
	categoryId = $state('');
	priority = $state('normal');
	assignedToUserId = $state('');
	requesterId = $state('');

	constructor(fields: Partial<TicketDraftFields>) {
		this.id = fields.id ?? generateDraftId();
		this.subject = fields.subject ?? '';
		this.description = fields.description ?? '';
		this.categoryId = fields.categoryId ?? '';
		this.priority = fields.priority ?? 'normal';
		this.assignedToUserId = fields.assignedToUserId ?? '';
		this.requesterId = fields.requesterId ?? '';
	}

	get isDirty() {
		return !!(this.subject.trim() || this.description.trim());
	}

	toJSON(): TicketDraftFields {
		const { id, subject, description, categoryId, priority, assignedToUserId, requesterId } = this;
		return { id, subject, description, categoryId, priority, assignedToUserId, requesterId };
	}
}

type UserDraftFields = { id: string; name: string; email: string; role: string };

/** A user being added. The initial password is left out so it never reaches localStorage. */
export class UserDraft {
	id: string;
	name = $state('');
	email = $state('');
	role = $state('requester');

	constructor(fields: Partial<UserDraftFields>) {
		this.id = fields.id ?? generateDraftId();
		this.name = fields.name ?? '';
		this.email = fields.email ?? '';
		this.role = fields.role ?? 'requester';
	}

	get isDirty() {
		return !!(this.name.trim() || this.email.trim());
	}

	toJSON(): UserDraftFields {
		const { id, name, email, role } = this;
		return { id, name, email, role };
	}
}

type CategoryDraftFields = { id: string; name: string };

export class CategoryDraft {
	id: string;
	name = $state('');

	constructor(fields: Partial<CategoryDraftFields>) {
		this.id = fields.id ?? generateDraftId();
		this.name = fields.name ?? '';
	}

	get isDirty() {
		return !!this.name.trim();
	}

	toJSON(): CategoryDraftFields {
		const { id, name } = this;
		return { id, name };
	}
}

type Draft<Fields> = { id: string; isDirty: boolean; toJSON(): Fields };

/**
 * One kind of unsent work, kept in this browser under one localStorage key. `blankDraft` backs a
 * new form and only joins `drafts` once something is written, so opening a form and closing
 * it again leaves nothing behind.
 */
export class DraftStore<Fields, DraftType extends Draft<Fields> = Draft<Fields>> {
	readonly storageKey: string;
	drafts = $state<DraftType[]>([]);
	blankDraft = $state() as DraftType;
	#createDraft: (fields: Partial<Fields>) => DraftType;
	#lastSavedJson = '[]';

	constructor(storageKey: string, createDraft: (fields: Partial<Fields>) => DraftType) {
		this.storageKey = storageKey;
		this.#createDraft = createDraft;
		this.blankDraft = createDraft({});
	}

	/** Drafts with content, which is what the Drafts view shows. */
	get dirtyDrafts() {
		return this.drafts.filter((draft) => draft.isDirty);
	}

	findById(id: string | null) {
		return this.drafts.find((draft) => draft.id === id);
	}

	/** Moves the blank draft into the list, once it has content worth keeping. */
	promoteBlankDraft() {
		this.drafts.unshift(this.blankDraft);
		this.blankDraft = this.#createDraft({});
	}

	discardById(id: string) {
		if (this.blankDraft.id === id) this.blankDraft = this.#createDraft({});
		else this.drafts = this.drafts.filter((draft) => draft.id !== id);
	}

	serialize() {
		return JSON.stringify(this.dirtyDrafts);
	}

	/** Reads saved drafts, keeping open ones as they are so unsaved typing isn't replaced. */
	load() {
		const storedJson = localStorage.getItem(this.storageKey);
		if (!storedJson || storedJson === this.#lastSavedJson) return;
		try {
			const parsedDrafts: (Partial<Fields> & { id: string })[] = JSON.parse(storedJson);
			this.drafts = parsedDrafts.map(
				(fields) => this.findById(fields.id) ?? this.#createDraft(fields)
			);
			this.#lastSavedJson = storedJson;
		} catch {
			localStorage.removeItem(this.storageKey);
		}
	}

	save(serializedDrafts = this.serialize()) {
		if (serializedDrafts === this.#lastSavedJson) return;
		this.#lastSavedJson = serializedDrafts;
		try {
			if (serializedDrafts === '[]') localStorage.removeItem(this.storageKey);
			else localStorage.setItem(this.storageKey, serializedDrafts);
		} catch {
			// Storage can be full or blocked. The draft still works until this tab closes.
		}
	}
}

/** Every kind of draft for one signed-in user. The app layout owns loading and saving. */
export class Drafts {
	tickets: DraftStore<TicketDraftFields, TicketDraft>;
	users: DraftStore<UserDraftFields, UserDraft>;
	categories: DraftStore<CategoryDraftFields, CategoryDraft>;

	constructor(userId: string, isAdmin: boolean) {
		this.tickets = new DraftStore(
			`ticket-drafts:${userId}`,
			(fields) => new TicketDraft({ requesterId: userId, ...fields })
		);
		// Admin drafts stay unloaded for anyone who loses the role, so they can't be reached.
		this.users = new DraftStore(
			`user-drafts:${isAdmin ? userId : ''}`,
			(fields) => new UserDraft(fields)
		);
		this.categories = new DraftStore(
			`category-drafts:${isAdmin ? userId : ''}`,
			(fields) => new CategoryDraft(fields)
		);
	}

	get stores() {
		return [this.tickets, this.users, this.categories];
	}

	get dirtyDraftCount() {
		return this.stores.reduce((total, store) => total + store.dirtyDrafts.length, 0);
	}

	/**
	 * Loads saved drafts and keeps them in sync with localStorage: saved after a pause in
	 * typing, when the page is hidden, and reloaded when another tab changes them.
	 * Call during component initialisation, since it registers lifecycle callbacks.
	 */
	startBrowserPersistence(): void {
		onMount(() => this.stores.forEach((store) => store.load()));
		// Debounced so typing costs one write after a pause, not one per keystroke.
		$effect(() => {
			const serializedDrafts = this.stores.map((store) => store.serialize());
			const saveTimeout = setTimeout(
				() => this.stores.forEach((store, index) => store.save(serializedDrafts[index])),
				SAVE_DELAY_MS
			);
			return () => clearTimeout(saveTimeout);
		});
		$effect(() => {
			const stopSavingOnPageHide = on(window, 'pagehide', () =>
				this.stores.forEach((store) => store.save())
			);
			const stopReloadingOnStorage = on(window, 'storage', (event) =>
				this.stores.find((store) => store.storageKey === event.key)?.load()
			);
			return () => {
				stopSavingOnPageHide();
				stopReloadingOnStorage();
			};
		});
	}
}

export const [getDrafts, setDrafts] = createContext<Drafts>();
