import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['nodes/**/__tests__/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: [
				'nodes/Cervio/baseUrl.ts',
				'nodes/Cervio/resourceMap.ts',
				'nodes/Cervio/writeSchemaMapper.ts',
				'nodes/Cervio/GenericFunctions.ts',
				'nodes/Cervio/execute/**/*.ts',
			],
			exclude: ['**/__tests__/**', '**/*.test.ts'],
			reporter: ['text', 'json-summary'],
			thresholds: {
				// Focused modules must stay well covered; execute paths grow via mocks.
				'nodes/Cervio/baseUrl.ts': {
					lines: 90,
					functions: 90,
					statements: 90,
				},
				'nodes/Cervio/resourceMap.ts': {
					lines: 90,
					functions: 90,
					statements: 90,
				},
				'nodes/Cervio/writeSchemaMapper.ts': {
					lines: 70,
					functions: 70,
					statements: 70,
				},
			},
		},
	},
});
