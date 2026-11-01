import { createContext } from 'svelte';

/**
 * The ticket being written in the reading pane. It lives in the app layout's context,
 * not the page, so a draft survives moving around the app until the next full reload.
 */
export class TicketDraft {
	subject = $state('');
	description = $state('');
	categoryId = $state('');
	assignedToUserId = $state('');
	requesterId = $state('');
	#userId: string;

	constructor(userId: string) {
		this.#userId = userId;
		this.requesterId = userId;
	}

	get dirty() {
		return !!(this.subject.trim() || this.description.trim());
	}

	reset() {
		this.subject = '';
		this.description = '';
		this.categoryId = '';
		this.assignedToUserId = '';
		this.requesterId = this.#userId;
	}
}

export const [getTicketDraft, setTicketDraft] = createContext<TicketDraft>();
