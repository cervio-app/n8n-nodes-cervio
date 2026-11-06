import { describe, expect, it } from 'vitest';

import { OPERATION_RESOURCE, resourceForOperation } from '../resourceMap';

describe('resourceForOperation', () => {
	it('maps every known operation', () => {
		for (const [op, resource] of Object.entries(OPERATION_RESOURCE)) {
			expect(resourceForOperation(op)).toBe(resource);
		}
	});

	it('defaults unknown operations to record', () => {
		expect(resourceForOperation('nope')).toBe('record');
	});
});
