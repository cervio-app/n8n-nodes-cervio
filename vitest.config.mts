import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['nodes/**/__tests__/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['nodes/**/*.ts', 'credentials/**/*.ts'],
			exclude: ['**/__tests__/**', '**/*.test.ts'],
			reporter: ['text', 'json-summary'],
			// Every line, branch and function of the node and credential is exercised by a test.
			thresholds: {
				lines: 100,
				branches: 100,
				functions: 100,
				statements: 100,
			},
		},
	},
});
