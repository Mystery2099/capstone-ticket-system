<script lang="ts">
	import { Plus, SquarePen } from '@lucide/svelte';
	import type { Component } from 'svelte';

	interface QuickAction {
		label: string;
		href: string;
		icon: Component;
	}

	/** Each administration page's main action adds one of its records. */
	const ADMIN_RECORD_NOUNS: Record<string, string> = {
		'/app/admin/users': 'user',
		'/app/admin/roles': 'role',
		'/app/admin/categories': 'category'
	};

	/**
	 * Phones only: the current page's main action, within thumb reach above the bottom bar. It
	 * hides while a ticket or record is open, so it never covers that pane's own buttons.
	 */
	let { pathname, newTicketHref }: { pathname: string; newTicketHref: string } = $props();

	let quickAction = $derived.by((): QuickAction => {
		const adminRecordNoun = ADMIN_RECORD_NOUNS[pathname];
		if (adminRecordNoun)
			return { label: `Add ${adminRecordNoun}`, href: `${pathname}?new`, icon: Plus };
		return { label: 'New ticket', href: newTicketHref, icon: SquarePen };
	});
</script>

<a
	class="new-ticket fixed right-4 bottom-[88px] z-10 m-0 hidden h-[52px] w-auto gap-3 rounded-[16px] px-5 text-[14px] max-md:flex [main:has(.workspace.has-ticket)~&]:hidden"
	href={quickAction.href}><quickAction.icon size={23} /> {quickAction.label}</a
>
