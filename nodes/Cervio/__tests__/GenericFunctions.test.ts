import { describe, expect, it } from 'vitest';

import { flattenRecordRow } from '../GenericFunctions';

describe('flattenRecordRow', () => {
	it('flattens nested data payload', () => {
		expect(
			flattenRecordRow({
				id: 'r1',
				entity_id: 'e1',
				created_at: '2020-01-01',
				updated_at: '2020-01-02',
				data: { nome: 'Ada', attivo: true },
			}),
		).toEqual({ id: 'r1', nome: 'Ada', attivo: true });
	});

	it('flattens flat rows and drops system keys', () => {
		expect(
			flattenRecordRow({
				id: 'r2',
				entity_id: 'e1',
				created_at: 'x',
				updated_at: 'y',
				nome: 'Bob',
			}),
		).toEqual({ id: 'r2', nome: 'Bob' });
	});

	it('returns empty object for non-objects', () => {
		expect(flattenRecordRow(null)).toEqual({});
		expect(flattenRecordRow('x')).toEqual({});
		expect(flattenRecordRow([])).toEqual({});
	});
});
