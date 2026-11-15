import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../GenericFunctions')>();
	return {
		...actual,
		listEntities: vi.fn(),
		listForms: vi.fn(),
		listViews: vi.fn(),
		listWorkflows: vi.fn(),
		getWriteSchema: vi.fn(),
		searchRelationOptions: vi.fn(),
	};
});

import {
	getWriteSchema,
	listEntities,
	listForms,
	listViews,
	listWorkflows,
	searchRelationOptions,
} from '../GenericFunctions';
import { cervioMethods } from '../methods';
import type { WriteDiscoveryField, WriteDiscoverySchema } from '../writeSchemaMapper';

const { loadOptions, resourceMapping } = cervioMethods;
const ctx = (params: Record<string, string> = {}) =>
	({ getNodeParameter: (name: string) => params[name] ?? '' }) as never;

const field = (
	name: string,
	input: WriteDiscoveryField['input'],
	extra: Partial<WriteDiscoveryField> = {},
): WriteDiscoveryField => ({
	name,
	label: name.toUpperCase(),
	field_type: 'text',
	value_shape: input.mode === 'relation' ? (input.multi_select ? 'uuid[]' : 'uuid') : 'string',
	required: false,
	readonly: false,
	order: 0,
	instructions: null,
	input,
	...extra,
});

const schema = (fields: WriteDiscoveryField[]): WriteDiscoverySchema => ({
	form: { id: 'f', name: 'default', label: 'Default' },
	fields,
});

const params = { entityId: 'ent', formName: 'default' };

beforeEach(() => {
	vi.resetAllMocks();
});

describe('dropdowns', () => {
	it('lists entities by label, falling back to name and id', async () => {
		vi.mocked(listEntities).mockResolvedValue([
			{ id: '3', label: 'Zeta' },
			{ id: '2', name: 'beta' },
			{ id: '1' },
		]);
		expect(await loadOptions.getEntities.call(ctx())).toEqual([
			{ name: '1', value: '1' },
			{ name: 'beta', value: '2' },
			{ name: 'Zeta', value: '3' },
		]);
	});

	it('lists forms with the edit and create forms first', async () => {
		vi.mocked(listForms).mockResolvedValue([
			{ id: 'a', name: 'zz', label: 'Altro' },
			{ id: 'b', name: 'b', label: '' },
			{ id: 'e', name: 'aa', label: '' },
			{ id: 'c', name: 'create', label: 'Nuovo', is_default: true },
			{ id: 'd', name: 'edit', label: 'Modifica', is_default_view: true },
		]);
		expect(await loadOptions.getForms.call(ctx({ entityId: 'ent' }))).toEqual([
			{ name: 'Modifica (edit)', value: 'edit' },
			{ name: 'Nuovo (create)', value: 'create' },
			{ name: 'aa', value: 'aa' },
			{ name: 'Altro', value: 'zz' },
			{ name: 'b', value: 'b' },
		]);
		expect(await loadOptions.getForms.call(ctx())).toEqual([]);
	});

	it('lists views with the default one first', async () => {
		vi.mocked(listViews).mockResolvedValue([
			{ id: '1', name: 'b', label: 'Beta' },
			{ id: '2', name: 'a', label: '' },
			{ id: '3', name: 'main', label: '', is_default: true },
			{ id: '4', name: 'c', label: 'Alfa' },
		]);
		expect(await loadOptions.getViews.call(ctx({ entityId: 'ent' }))).toEqual([
			{ name: 'main (default)', value: '3' },
			{ name: 'a', value: '2' },
			{ name: 'Alfa', value: '4' },
			{ name: 'Beta', value: '1' },
		]);
		expect(await loadOptions.getViews.call(ctx())).toEqual([]);
	});

	it('lists relation fields once each, without N:M fields', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([
				field('tag', { mode: 'relation', multi_select: true }, { order: 2, label: '' }),
				field('cliente_id', { mode: 'relation' }, { order: 1 }),
				field('cliente_id', { mode: 'relation' }, { order: 3 }),
				field('progetti', { mode: 'relation', storage: 'through' }),
				field('nome', { mode: 'none' }),
			]),
		);
		expect(await loadOptions.getRelationFields.call(ctx(params))).toEqual([
			{ name: 'CLIENTE_ID', value: 'cliente_id' },
			{ name: 'tag (multi)', value: 'tag' },
		]);
		expect(await loadOptions.getRelationFields.call(ctx())).toEqual([]);
	});

	it('lists only N:M fields for Link and Unlink', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([
				field('progetti', { mode: 'relation', storage: 'through' }, { order: 2 }),
				field('ruoli', { mode: 'relation', storage: 'through' }, { order: 1, label: '' }),
				field('cliente_id', { mode: 'relation' }),
				field('nome', { mode: 'none' }),
			]),
		);
		expect(await loadOptions.getThroughFields.call(ctx(params))).toEqual([
			{ name: 'ruoli', value: 'ruoli' },
			{ name: 'PROGETTI', value: 'progetti' },
		]);
		expect(await loadOptions.getThroughFields.call(ctx())).toEqual([]);
	});

	it('offers writable scalar fields as match fields, from the first form when none is chosen', async () => {
		vi.mocked(listForms).mockResolvedValue([{ id: 'f', name: 'first', label: 'First' }]);
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([
				field('email', { mode: 'none' }),
				field('codice', { mode: 'none' }, { label: '' }),
				field('codice', { mode: 'none' }),
				field('totale', { mode: 'none' }, { server_filled: 'computed' }),
				field('creato', { mode: 'none' }, { readonly: true }),
				field('cliente_id', { mode: 'relation' }),
			]),
		);
		expect(await loadOptions.getMatchFields.call(ctx({ entityId: 'ent' }))).toEqual([
			{ name: 'codice', value: 'codice' },
			{ name: 'EMAIL', value: 'email' },
		]);
		expect(getWriteSchema).toHaveBeenCalledWith('ent', 'first');
	});

	it('has no match fields without an entity or a form', async () => {
		expect(await loadOptions.getMatchFields.call(ctx())).toEqual([]);
		vi.mocked(listForms).mockResolvedValue([]);
		expect(await loadOptions.getMatchFields.call(ctx({ entityId: 'ent' }))).toEqual([]);
	});

	it('lists workflows by name, falling back to id', async () => {
		vi.mocked(listWorkflows).mockResolvedValue([{ id: 'w2', name: 'Zeta' }, { id: 'w1' }]);
		expect(await loadOptions.getWorkflows.call(ctx())).toEqual([
			{ name: 'w1', value: 'w1' },
			{ name: 'Zeta', value: 'w2' },
		]);
	});
});

describe('field mappers', () => {
	it('is empty until entity and form are chosen', async () => {
		expect(await resourceMapping.getFormFieldsCreate.call(ctx())).toEqual({ fields: [] });
	});

	it('turns a single relation with few candidates into a list', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([field('cliente_id', { mode: 'relation' })]),
		);
		vi.mocked(searchRelationOptions).mockResolvedValue([{ id: 'c1', label: 'Acme' }]);
		const { fields } = await resourceMapping.getFormFieldsCreate.call(ctx(params));
		expect(fields[0]).toMatchObject({ type: 'options', options: [{ name: 'Acme', value: 'c1' }] });
	});

	it('keeps a single relation with too many candidates as an ID field', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([field('cliente_id', { mode: 'relation' })]),
		);
		vi.mocked(searchRelationOptions).mockResolvedValue(
			Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, label: `C${i}` })),
		);
		const { fields } = await resourceMapping.getFormFieldsUpdate.call(ctx(params));
		expect(fields[0]).toMatchObject({ type: 'string', required: false });
		expect(fields[0].options).toBeUndefined();
	});

	it('keeps multi-select relations as ID lists without loading their candidates', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([field('tag', { mode: 'relation', multi_select: true })]),
		);
		const { fields } = await resourceMapping.getFormFieldsCreate.call(ctx(params));
		expect(fields[0].type).toBe('array');
		expect(searchRelationOptions).not.toHaveBeenCalled();
	});

	it('keeps a single relation without candidates as an ID field', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([field('cliente_id', { mode: 'relation' })]),
		);
		vi.mocked(searchRelationOptions).mockResolvedValue([]);
		const { fields } = await resourceMapping.getFormFieldsCreate.call(ctx(params));
		expect(fields[0]).toMatchObject({ type: 'string' });
		expect(fields[0].options).toBeUndefined();
	});

	it('keeps a relation as free text when its candidates cannot be loaded', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([field('cliente_id', { mode: 'relation' })]),
		);
		vi.mocked(searchRelationOptions).mockRejectedValue(new Error('403'));
		const { fields } = await resourceMapping.getFormFieldsCreate.call(ctx(params));
		expect(fields[0].type).toBe('string');
	});

	it('lists link fields from the first form when the junction has no default form', async () => {
		vi.mocked(getWriteSchema)
			.mockResolvedValueOnce(
				schema([
					field('progetti', {
						mode: 'relation',
						storage: 'through',
						junction_entity_id: 'junction',
						relation_entity_id: 'projects',
					}),
				]),
			)
			.mockResolvedValueOnce(schema([field('anno', { mode: 'none' })]));
		vi.mocked(listForms).mockResolvedValue([{ id: 'j', name: 'only', label: 'Only' }]);
		const { fields } = await resourceMapping.getJunctionFields.call(
			ctx({ ...params, throughFieldName: 'progetti' }),
		);
		expect(fields.map((f) => f.id)).toEqual(['anno']);
		expect(getWriteSchema).toHaveBeenLastCalledWith('junction', 'only');
	});

	it('has no link fields when the junction has no form', async () => {
		vi.mocked(getWriteSchema).mockResolvedValue(
			schema([
				field('progetti', { mode: 'relation', storage: 'through', junction_entity_id: 'j' }),
			]),
		);
		vi.mocked(listForms).mockResolvedValue([]);
		expect(
			await resourceMapping.getJunctionFields.call(
				ctx({ ...params, throughFieldName: 'progetti' }),
			),
		).toEqual({ fields: [] });
	});
});
