import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../GenericFunctions')>();
	return {
		...actual,
		createRecord: vi.fn(async () => ({ id: 'new-1' })),
		getRecord: vi.fn(async () => ({ id: 'rec-1', data: { nome: 'Ada' } })),
	};
});

import { createRecord } from '../GenericFunctions';
import { executeCervio } from '../execute';

function mockExecute(
	params: Record<string, unknown>,
	opts?: { typeVersion?: number },
) {
	const ctx = {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name: string, _i?: number, fallback?: unknown) => {
			if (name in params) return params[name];
			return fallback;
		},
		getNode: () => ({ name: 'Cervio', typeVersion: opts?.typeVersion ?? 2 }),
		continueOnFail: () => false,
	};
	return ctx as unknown as Parameters<typeof executeCervio>[0];
}

describe('executeCervio create', () => {
	beforeEach(() => {
		vi.mocked(createRecord).mockClear();
	});

	it('creates a record and returns pairedItem', async () => {
		const ctx = mockExecute({
			operation: 'create',
			resource: 'record',
			entityId: 'ent-1',
			formName: 'default',
			'fields.mappingMode': 'defineBelow',
			'fields.value': { nome: 'Ada' },
		});
		const [[item]] = await executeCervio.call(ctx);
		expect(createRecord).toHaveBeenCalledOnce();
		expect(item.json).toEqual({ id: 'new-1' });
		expect(item.pairedItem).toEqual({ item: 0 });
	});

	it('rejects resource/operation mismatch on typeVersion 2', async () => {
		const ctx = mockExecute({
			operation: 'create',
			resource: 'document',
			entityId: 'ent-1',
			formName: 'default',
			'fields.mappingMode': 'defineBelow',
			'fields.value': { nome: 'Ada' },
		});
		await expect(executeCervio.call(ctx)).rejects.toThrow(/resource/i);
	});
});
