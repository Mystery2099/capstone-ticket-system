import type { CategoryRecord, PersonSummary } from './ticket-types';

/** Looks up the display names of the people and categories a ticket refers to. */
export class TicketDirectory {
	readonly #people: PersonSummary[];
	readonly #categories: CategoryRecord[];

	constructor(people: PersonSummary[], categories: CategoryRecord[]) {
		this.#people = people;
		this.#categories = categories;
	}

	/** The person's name. Missing people are shown as the support team. */
	getPersonName(personId: string | null): string {
		return this.#findPerson(personId)?.name || 'Support team';
	}

	/** The person's role. Missing people are treated as agents. */
	getPersonRole(personId: string): string {
		return this.#findPerson(personId)?.role || 'agent';
	}

	getCategoryName(categoryId: string): string {
		return this.#categories.find((category) => category.id === categoryId)?.name || 'Category';
	}

	#findPerson(personId: string | null): PersonSummary | undefined {
		return this.#people.find((person) => person.id === personId);
	}
}
