import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../GenericFunctions')>();
	return {
		...actual,
		getRecord: vi.fn(async () => ({ id: 'rec-1', data: { nome: 'Ada' } })),
		flattenRecordRow: actual.flattenRecordRow,
	};
});

import { getRecord } from '../GenericFunctions';
import { executeCervio } from '../execute';

function mockExecute(params: Record<string, unknown>) {
	const ctx = {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name: string, _i?: number, fallback?: unknown) => {
			if (name in params) return params[name];
			return fallback;
		},
		getNode: () => ({ name: 'Cervio' }),
		continueOnFail: () => false,
	};
	return ctx as unknown as Parameters<typeof executeCervio>[0];
}

describe('executeCervio get', () => {
	beforeEach(() => {
		vi.mocked(getRecord).mockClear();
	});

	it('returns flattened record with pairedItem', async () => {
		const ctx = mockExecute({
			operation: 'get',
			entityId: 'ent-1',
			recordId: 'rec-1',
		});
		const [[item]] = await executeCervio.call(ctx);
		expect(getRecord).toHaveBeenCalledOnce();
		expect(item.json).toMatchObject({ id: 'rec-1', nome: 'Ada' });
		expect(item.pairedItem).toEqual({ item: 0 });
	});
});
