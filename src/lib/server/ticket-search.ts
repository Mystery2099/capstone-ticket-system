import { and, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from './db';
import { category, ticket, ticketComment, user } from './schema';
import { TicketContentFormat } from '../ticket-content/ticket-content-format';
import { stripMarkdownSyntax } from '../ticket-content/ticket-content-renderer';

/** Longest search text sent to the database. */
export const MAX_SEARCH_LENGTH = 200;
/** Shorter text matches too many subjects by similarity alone. */
const MIN_SIMILARITY_SEARCH_LENGTH = 3;
const HIGHLIGHT_START = '\u0001';
const HIGHLIGHT_END = '\u0002';
const SUBJECT_HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, HighlightAll=true`;
const SNIPPET_HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxFragments=1, MaxWords=24, MinWords=10, FragmentDelimiter=" … "`;
/** Word weights D, C, B, A: comments, category and people, description, subject. */
const RANK_WEIGHTS = '{0.1, 0.2, 0.4, 1.0}';
/** Letters and digits, keeping joined forms such as `wi-fi` or `5.2.1` whole. */
const WORD_PATTERN = /[\p{L}\p{N}]+(?:[.\-_][\p{L}\p{N}]+)*/gu;
const TOKEN_PATTERN = /(-?)"([^"]*)"|(-?)(\S+)/g;

export type HighlightSegment = { text: string; isMatch: boolean };

export type TicketSearchHighlight = {
	subjectSegments: HighlightSegment[] | null;
	snippetSegments: HighlightSegment[] | null;
	snippetAuthorId: string | null;
	metadataMatches: { label: string; segments: HighlightSegment[] }[];
};

/** What the person typed, prepared once for every part of the search. */
export class TicketSearchQuery {
	readonly searchText: string;
	/** Text for `to_tsquery`, or null when nothing searchable is left. */
	readonly tsQueryText: string | null;
	/** Positive terms joined with OR so each field can explain its own part of a match. */
	private readonly highlightQueryText: string | null;
	/** Set when the whole search is a ticket number such as `1046` or `#1046`. */
	readonly ticketNumber: number | null;

	constructor(rawSearchText: string) {
		this.searchText = rawSearchText.trim().slice(0, MAX_SEARCH_LENGTH);
		this.tsQueryText = TicketSearchQuery.buildTsQueryText(this.searchText);
		this.highlightQueryText = TicketSearchQuery.buildTsQueryText(this.searchText, true);
		const ticketNumberMatch = /^#?(\d{1,15})$/.exec(this.searchText);
		this.ticketNumber = ticketNumberMatch ? Number(ticketNumberMatch[1]) : null;
	}

	static fromUrl(url: URL): TicketSearchQuery | null {
		const searchQuery = new TicketSearchQuery(url.searchParams.get('q') ?? '');
		return searchQuery.searchText ? searchQuery : null;
	}

	/**
	 * Words match as prefixes, so results appear while a word is still being typed.
	 * Quoted text must appear as an exact phrase, and a leading `-` excludes a word or phrase.
	 */
	private static buildTsQueryText(searchText: string, highlightOnly = false): string | null {
		const includedTerms: string[] = [];
		const excludedTerms: string[] = [];
		for (const tokenMatch of searchText.matchAll(TOKEN_PATTERN)) {
			const [, phraseNegation, phraseText, wordNegation, wordText] = tokenMatch;
			const isPhrase = phraseText !== undefined;
			const words = (isPhrase ? phraseText : wordText).toLowerCase().match(WORD_PATTERN);
			if (!words) continue;
			const term = isPhrase ? words.join(' <-> ') : words.map((word) => word + ':*').join(' & ');
			if ((isPhrase ? phraseNegation : wordNegation) === '-') excludedTerms.push(`!(${term})`);
			else includedTerms.push(`(${term})`);
		}
		if (!includedTerms.length) return null;
		return highlightOnly
			? includedTerms.join(' | ')
			: [...includedTerms, ...excludedTerms].join(' & ');
	}

	private tsQuery(): SQL {
		return sql`to_tsquery('english', ${this.tsQueryText})`;
	}

	/**
	 * One weighted document per ticket: subject, description, category and people names,
	 * then comments. Requesters' documents leave out internal notes.
	 */
	private buildSearchDocument(includeInternalNotes: boolean): SQL {
		const visibleComments = includeInternalNotes
			? sql`true`
			: sql`${ticketComment.isInternal} = false`;
		return sql`(
			setweight(to_tsvector('english', ${ticket.subject}), 'A') ||
			setweight(to_tsvector('english', ${ticket.description}), 'B') ||
			setweight(to_tsvector('english', concat_ws(' ',
				(select ${category.name} from ${category} where ${category.id} = ${ticket.categoryId}),
				(select ${user.name} from ${user} where ${user.id} = ${ticket.requesterId}),
				(select ${user.name} from ${user} where ${user.id} = ${ticket.assignedToUserId})
			)), 'C') ||
			setweight(to_tsvector('english', coalesce((
				select string_agg(${ticketComment.body}, ' ')
				from ${ticketComment}
				where ${ticketComment.ticketId} = ${ticket.id} and ${visibleComments}
			), '')), 'D')
		)`;
	}

	private isSimilarityEnabled(): boolean {
		// Similarity must not bypass quoted phrases or excluded words.
		return (
			this.searchText.length >= MIN_SIMILARITY_SEARCH_LENGTH &&
			!this.searchText.includes('"') &&
			!/(?:^|\s)-/.test(this.searchText)
		);
	}

	/** Matches by words anywhere on the ticket, a close spelling of the subject, or the ticket number. */
	buildMatchCondition(includeInternalNotes: boolean): SQL {
		const matchConditions = [
			this.tsQueryText
				? sql`${this.buildSearchDocument(includeInternalNotes)} @@ ${this.tsQuery()}`
				: undefined,
			this.isSimilarityEnabled() ? sql`${this.searchText} <% ${ticket.subject}` : undefined,
			this.ticketNumber !== null ? eq(ticket.ticketNumber, this.ticketNumber) : undefined
		].filter((condition) => condition !== undefined);
		return or(...matchConditions) ?? sql`false`;
	}

	/** Higher is better. Subject words count most, then close subject spellings. */
	buildRankExpression(includeInternalNotes: boolean): SQL<number> {
		const textRank = this.tsQueryText
			? sql`ts_rank(${RANK_WEIGHTS}::float4[], ${this.buildSearchDocument(includeInternalNotes)}, ${this.tsQuery()})`
			: sql`0`;
		const similarityRank = this.isSimilarityEnabled()
			? sql`0.3 * word_similarity(${this.searchText}, ${ticket.subject})`
			: sql`0`;
		const ticketNumberRank =
			this.ticketNumber !== null
				? sql`case when ${ticket.ticketNumber} = ${this.ticketNumber} then 10 else 0 end`
				: sql`0`;
		return sql<number>`(${textRank} + ${similarityRank} + ${ticketNumberRank})`;
	}

	/**
	 * Highlights matched words in the subject, plus a short excerpt from the description,
	 * or failing that the newest matching comment the actor may see.
	 */
	async loadHighlights(
		ticketIds: string[],
		includeInternalNotes: boolean
	): Promise<Map<string, TicketSearchHighlight>> {
		const highlightsByTicketId = new Map<string, TicketSearchHighlight>();
		if (!this.tsQueryText || !ticketIds.length) return highlightsByTicketId;

		const highlightQuery = sql`to_tsquery('english', ${this.highlightQueryText})`;
		const requesterName = sql`coalesce((select ${user.name} from ${user} where ${user.id} = ${ticket.requesterId}), '')`;
		const assigneeName = sql`coalesce((select ${user.name} from ${user} where ${user.id} = ${ticket.assignedToUserId}), '')`;
		const categoryName = sql`coalesce((select ${category.name} from ${category} where ${category.id} = ${ticket.categoryId}), '')`;
		const ticketHeadlines = await db
			.select({
				id: ticket.id,
				descriptionFormat: ticket.descriptionFormat,
				requesterHeadline: sql<string>`ts_headline('english', ${requesterName}, ${highlightQuery}, ${SUBJECT_HEADLINE_OPTIONS})`,
				assigneeHeadline: sql<string>`ts_headline('english', ${assigneeName}, ${highlightQuery}, ${SUBJECT_HEADLINE_OPTIONS})`,
				categoryHeadline: sql<string>`ts_headline('english', ${categoryName}, ${highlightQuery}, ${SUBJECT_HEADLINE_OPTIONS})`,
				subjectHeadline: sql<
					string | null
				>`case when to_tsvector('english', ${ticket.subject}) @@ ${highlightQuery}
					then ts_headline('english', ${ticket.subject}, ${highlightQuery}, ${SUBJECT_HEADLINE_OPTIONS}) end`,
				descriptionHeadline: sql<
					string | null
				>`case when to_tsvector('english', ${ticket.description}) @@ ${highlightQuery}
					then ts_headline('english', ${ticket.description}, ${highlightQuery}, ${SNIPPET_HEADLINE_OPTIONS}) end`
			})
			.from(ticket)
			.where(inArray(ticket.id, ticketIds));
		const commentHeadlines = await db
			.selectDistinctOn([ticketComment.ticketId], {
				ticketId: ticketComment.ticketId,
				authorId: ticketComment.authorId,
				bodyFormat: ticketComment.bodyFormat,
				headline: sql<string>`ts_headline('english', ${ticketComment.body}, ${highlightQuery}, ${SNIPPET_HEADLINE_OPTIONS})`
			})
			.from(ticketComment)
			.where(
				and(
					inArray(ticketComment.ticketId, ticketIds),
					includeInternalNotes ? undefined : eq(ticketComment.isInternal, false),
					sql`to_tsvector('english', ${ticketComment.body}) @@ ${highlightQuery}`
				)
			)
			.orderBy(ticketComment.ticketId, desc(ticketComment.createdAt), desc(ticketComment.id));

		for (const ticketHeadline of ticketHeadlines) {
			const commentHeadline = ticketHeadline.descriptionHeadline
				? undefined
				: commentHeadlines.find((candidate) => candidate.ticketId === ticketHeadline.id);
			const snippetHeadline = ticketHeadline.descriptionHeadline
				? TicketSearchQuery.removeFormatting(
						ticketHeadline.descriptionHeadline,
						ticketHeadline.descriptionFormat
					)
				: commentHeadline &&
					TicketSearchQuery.removeFormatting(commentHeadline.headline, commentHeadline.bodyFormat);
			highlightsByTicketId.set(ticketHeadline.id, {
				subjectSegments: ticketHeadline.subjectHeadline
					? TicketSearchQuery.toHighlightSegments(ticketHeadline.subjectHeadline)
					: null,
				snippetSegments: snippetHeadline
					? TicketSearchQuery.toHighlightSegments(snippetHeadline)
					: null,
				snippetAuthorId: commentHeadline?.authorId ?? null,
				metadataMatches: [
					{ label: 'Assigned to', headline: ticketHeadline.assigneeHeadline },
					{ label: 'Requested by', headline: ticketHeadline.requesterHeadline },
					{ label: 'Category', headline: ticketHeadline.categoryHeadline }
				]
					.filter((match) => match.headline.includes(HIGHLIGHT_START))
					.map((match) => ({
						label: match.label,
						segments: TicketSearchQuery.toHighlightSegments(match.headline)
					}))
			});
		}
		return highlightsByTicketId;
	}

	/** Excerpts are shown as plain text, so Markdown symbols are taken out of them. */
	private static removeFormatting(headline: string, contentFormat: TicketContentFormat): string {
		return contentFormat === TicketContentFormat.MARKDOWN
			? stripMarkdownSyntax(headline)
			: headline;
	}

	/** Splits a headline into plain text and matched words, so the page never renders HTML. */
	private static toHighlightSegments(headline: string): HighlightSegment[] {
		const highlightSegments: HighlightSegment[] = [];
		const markerPattern = new RegExp(`[${HIGHLIGHT_START}${HIGHLIGHT_END}]`);
		headline.split(markerPattern).forEach((text, index) => {
			if (text) highlightSegments.push({ text, isMatch: index % 2 === 1 });
		});
		return highlightSegments;
	}
}
