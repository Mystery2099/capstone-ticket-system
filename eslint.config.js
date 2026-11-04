import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default defineConfig(
	{
		ignores: [
			'**/node_modules/**',
			'.svelte-kit/**',
			'build/**',
			'.data/**',
			'drizzle/**',
			'playwright-report/**',
			'test-results/**',
			// Other checkouts of this repository, linted from their own folder.
			'.worktrees/**'
		]
	},
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		rules: {
			// The app is deployed at the origin root, without a SvelteKit base path.
			'svelte/no-navigation-without-resolve': 'off',
			// Query builders are temporary values, not reactive component state.
			'svelte/prefer-svelte-reactivity': 'off'
		},
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: { extraFileExtensions: ['.svelte'], tsconfigRootDir: import.meta.dirname }
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: { parser: ts.parser, svelteConfig }
		}
	}
);
