import { createContext } from 'svelte';

type DraftFields = {
	id: string;
	subject: string;
	description: string;
	categoryId: string;
	assignedToUserId: string;
	requesterId: string;
};

export class TicketDraft {
	id: string;
	subject = $state('');
	description = $state('');
	categoryId = $state('');
	assignedToUserId = $state('');
	requesterId = $state('');

	constructor(fields: Partial<DraftFields> & Pick<DraftFields, 'id' | 'requesterId'>) {
		this.id = fields.id;
		this.subject = fields.subject ?? '';
		this.description = fields.description ?? '';
		this.categoryId = fields.categoryId ?? '';
		this.assignedToUserId = fields.assignedToUserId ?? '';
		this.requesterId = fields.requesterId;
	}

	get dirty() {
		return !!(this.subject.trim() || this.description.trim());
	}

	toJSON(): DraftFields {
		const { id, subject, description, categoryId, assignedToUserId, requesterId } = this;
		return { id, subject, description, categoryId, assignedToUserId, requesterId };
	}
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/**
 * A user's unsent tickets, kept in this browser under one localStorage key. `blank` backs a
 * new form and only joins `items` once something is written, so opening New ticket and
 * closing it again leaves nothing behind. The app layout owns loading and saving.
 */
export class TicketDrafts {
	readonly key: string;
	items = $state<TicketDraft[]>([]);
	blank = $state() as TicketDraft;
	#userId: string;
	#saved = '[]';

	constructor(userId: string) {
		this.#userId = userId;
		this.key = `ticket-drafts:${userId}`;
		this.blank = this.#create();
	}

	#create() {
		return new TicketDraft({ id: newId(), requesterId: this.#userId });
	}

	/** Drafts with content, which is what the sidebar and Drafts view show. */
	get saved() {
		return this.items.filter((draft) => draft.dirty);
	}

	find(id: string | null) {
		return this.items.find((draft) => draft.id === id);
	}

	/** Moves the blank draft into the list, once it has content worth keeping. */
	promote() {
		this.items.unshift(this.blank);
		this.blank = this.#create();
	}

	discard(id: string) {
		if (this.blank.id === id) this.blank = this.#create();
		else this.items = this.items.filter((draft) => draft.id !== id);
	}

	serialize() {
		return JSON.stringify(this.saved);
	}

	/** Reads saved drafts, keeping open ones as they are so unsaved typing isn't replaced. */
	load() {
		const raw = localStorage.getItem(this.key);
		if (!raw || raw === this.#saved) return;
		try {
			const saved: DraftFields[] = JSON.parse(raw);
			this.items = saved.map((fields) => this.find(fields.id) ?? new TicketDraft(fields));
			this.#saved = raw;
		} catch {
			localStorage.removeItem(this.key);
		}
	}

	save(json = this.serialize()) {
		if (json === this.#saved) return;
		this.#saved = json;
		try {
			if (json === '[]') localStorage.removeItem(this.key);
			else localStorage.setItem(this.key, json);
		} catch {
			// Storage can be full or blocked. The draft still works until this tab closes.
		}
	}
}

export const [getTicketDrafts, setTicketDrafts] = createContext<TicketDrafts>();
