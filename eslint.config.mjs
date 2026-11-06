import json from '@eslint/json';
import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'dist/**',
			'coverage/**',
			'scripts/**',
			'media/**',
			'**/*.test.ts',
			'**/__tests__/**',
			'node_modules/**',
			'eslint.config.mjs',
			'vitest.config.ts',
			'package-lock.json',
		],
	},
	{
		files: ['**/*.ts'],
		extends: [tseslint.configs.recommended],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['nodes/**/*.ts', 'credentials/**/*.ts'],
		plugins: n8nCommunityNodesPlugin.configs.recommended.plugins,
		rules: n8nCommunityNodesPlugin.configs.recommended.rules,
	},
	{
		files: ['package.json'],
		plugins: {
			json,
			...n8nCommunityNodesPlugin.configs.recommended.plugins,
		},
		language: 'json/json',
		rules: {
			'@n8n/community-nodes/n8n-object-validation': 'error',
			'@n8n/community-nodes/package-name-convention': 'error',
			'@n8n/community-nodes/no-forbidden-lifecycle-scripts': 'error',
			'@n8n/community-nodes/no-overrides-field': 'error',
			'@n8n/community-nodes/no-runtime-dependencies': 'error',
			'@n8n/community-nodes/require-files-array': 'warn',
			'@n8n/community-nodes/require-homepage': 'warn',
			'@n8n/community-nodes/valid-author': 'error',
			'@n8n/community-nodes/valid-description': 'error',
			'@n8n/community-nodes/valid-peer-dependencies': 'error',
			'@n8n/community-nodes/ai-node-package-json': 'error',
		},
	},
);
