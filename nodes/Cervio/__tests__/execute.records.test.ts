import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../GenericFunctions')>();
	return {
		...actual,
		updateRecord: vi.fn(async () => ({ id: 'rec' })),
		upsertRecord: vi.fn(async () => ({ id: 'rec', action: 'created' })),
		deleteRecord: vi.fn(async () => ({ ok: true })),
		validateDraft: vi.fn(async () => ({ valid: true })),
	};
});

import { deleteRecord, updateRecord, upsertRecord, validateDraft } from '../GenericFunctions';
import { executeCervio } from '../execute';

function run(params: Record<string, unknown>, json: Record<string, unknown> = {}) {
	const ctx = {
		getInputData: () => [{ json }],
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({ name: 'Cervio', typeVersion: 2 }),
		continueOnFail: () => false,
	} as unknown as Parameters<typeof executeCervio>[0];
	return executeCervio.call(ctx);
}

const base = { resource: 'record', entityId: 'ent', formName: 'default' };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('record operations', () => {
	it('update sends only filled fields, the ETag and multi-value modes', async () => {
		const [[item]] = await run({
			...base,
			operation: 'update',
			recordId: 'rec',
			'fields.mappingMode': 'defineBelow',
			'fields.value': { nome: 'Ada', note: '' },
			updateOptions: {
				expectedUpdatedAt: ' 2026-11-01T10:00:00Z ',
				multiValueModes: {
					entry: [
						{ field: 'tag', mode: 'add' },
						{ field: 'x', mode: 'bad' },
					],
				},
			},
		});
		expect(updateRecord).toHaveBeenCalledWith(
			'ent',
			'rec',
			'default',
			{ nome: 'Ada' },
			'2026-11-01T10:00:00Z',
			{
				tag: 'add',
			},
		);
		expect(item.json).toEqual({ id: 'rec' });
	});

	it('update refuses an empty change', async () => {
		await expect(
			run({
				...base,
				operation: 'update',
				recordId: 'rec',
				'fields.mappingMode': 'defineBelow',
				'fields.value': {},
			}),
		).rejects.toThrow(/at least one field/);
		expect(updateRecord).not.toHaveBeenCalled();
	});

	it('upsert auto-maps the input item without its id', async () => {
		const [[item]] = await run(
			{
				...base,
				operation: 'upsert',
				matchField: ' codice ',
				'fields.mappingMode': 'autoMapInputData',
			},
			{ id: 'old', codice: 'A1' },
		);
		expect(upsertRecord).toHaveBeenCalledWith('ent', 'default', 'codice', { codice: 'A1' });
		expect(item.json).toEqual({ id: 'rec', action: 'created' });
	});

	it('upsert requires a match field', async () => {
		await expect(run({ ...base, operation: 'upsert', matchField: '' })).rejects.toThrow(
			/Match field is required/,
		);
	});

	it('validate draft passes the existing record id', async () => {
		await run({
			...base,
			operation: 'validateDraft',
			'fields.mappingMode': 'defineBelow',
			'fields.value': { nome: 'Ada' },
			validateDraftOptions: { recordId: 'rec' },
		});
		expect(validateDraft).toHaveBeenCalledWith('ent', 'default', { nome: 'Ada' }, 'rec');
	});

	it('delete returns the removed id', async () => {
		const [[item]] = await run({ ...base, operation: 'delete', recordId: 'rec' });
		expect(deleteRecord).toHaveBeenCalledWith('ent', 'rec');
		expect(item.json).toEqual({ ok: true, id: 'rec' });
	});
});
