import { createContext } from 'svelte';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

type TicketFields = {
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

	constructor(fields: Partial<TicketFields>) {
		this.id = fields.id ?? newId();
		this.subject = fields.subject ?? '';
		this.description = fields.description ?? '';
		this.categoryId = fields.categoryId ?? '';
		this.assignedToUserId = fields.assignedToUserId ?? '';
		this.requesterId = fields.requesterId ?? '';
	}

	get dirty() {
		return !!(this.subject.trim() || this.description.trim());
	}

	toJSON(): TicketFields {
		const { id, subject, description, categoryId, assignedToUserId, requesterId } = this;
		return { id, subject, description, categoryId, assignedToUserId, requesterId };
	}
}

type UserFields = { id: string; name: string; email: string; role: string };

/** A user being added. The initial password is left out so it never reaches localStorage. */
export class UserDraft {
	id: string;
	name = $state('');
	email = $state('');
	role = $state('requester');

	constructor(fields: Partial<UserFields>) {
		this.id = fields.id ?? newId();
		this.name = fields.name ?? '';
		this.email = fields.email ?? '';
		this.role = fields.role ?? 'requester';
	}

	get dirty() {
		return !!(this.name.trim() || this.email.trim());
	}

	toJSON(): UserFields {
		const { id, name, email, role } = this;
		return { id, name, email, role };
	}
}

type CategoryFields = { id: string; name: string };

export class CategoryDraft {
	id: string;
	name = $state('');

	constructor(fields: Partial<CategoryFields>) {
		this.id = fields.id ?? newId();
		this.name = fields.name ?? '';
	}

	get dirty() {
		return !!this.name.trim();
	}

	toJSON(): CategoryFields {
		const { id, name } = this;
		return { id, name };
	}
}

type Draft<Fields> = { id: string; dirty: boolean; toJSON(): Fields };

/**
 * One kind of unsent work, kept in this browser under one localStorage key. `blank` backs a
 * new form and only joins `items` once something is written, so opening a form and closing
 * it again leaves nothing behind.
 */
export class DraftStore<Fields, D extends Draft<Fields> = Draft<Fields>> {
	readonly key: string;
	items = $state<D[]>([]);
	blank = $state() as D;
	#create: (fields: Partial<Fields>) => D;
	#saved = '[]';

	constructor(key: string, create: (fields: Partial<Fields>) => D) {
		this.key = key;
		this.#create = create;
		this.blank = create({});
	}

	/** Drafts with content, which is what the Drafts view shows. */
	get saved() {
		return this.items.filter((draft) => draft.dirty);
	}

	find(id: string | null) {
		return this.items.find((draft) => draft.id === id);
	}

	/** Moves the blank draft into the list, once it has content worth keeping. */
	promote() {
		this.items.unshift(this.blank);
		this.blank = this.#create({});
	}

	discard(id: string) {
		if (this.blank.id === id) this.blank = this.#create({});
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
			const saved: (Partial<Fields> & { id: string })[] = JSON.parse(raw);
			this.items = saved.map((fields) => this.find(fields.id) ?? this.#create(fields));
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

/** Every kind of draft for one signed-in user. The app layout owns loading and saving. */
export class Drafts {
	tickets: DraftStore<TicketFields, TicketDraft>;
	users: DraftStore<UserFields, UserDraft>;
	categories: DraftStore<CategoryFields, CategoryDraft>;

	constructor(userId: string, isAdmin: boolean) {
		this.tickets = new DraftStore(
			`ticket-drafts:${userId}`,
			(fields) => new TicketDraft({ requesterId: userId, ...fields })
		);
		// Admin drafts stay unloaded for anyone who loses the role, so they can't be reached.
		this.users = new DraftStore(`user-drafts:${isAdmin ? userId : ''}`, (f) => new UserDraft(f));
		this.categories = new DraftStore(
			`category-drafts:${isAdmin ? userId : ''}`,
			(f) => new CategoryDraft(f)
		);
	}

	get stores() {
		return [this.tickets, this.users, this.categories];
	}

	get count() {
		return this.stores.reduce((total, store) => total + store.saved.length, 0);
	}
}

export const [getDrafts, setDrafts] = createContext<Drafts>();
