import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../GenericFunctions')>();
	return {
		...actual,
		getWriteSchema: vi.fn(),
		listForms: vi.fn(),
		searchRelationOptions: vi.fn(async () => [{ id: 'c1', label: 'Commessa 1' }]),
	};
});

import { getWriteSchema, listForms } from '../GenericFunctions';
import { buildJunctionMapperFields } from '../methods/mapperFields';
import type { WriteDiscoveryField, WriteDiscoverySchema } from '../writeSchemaMapper';
import { withoutRelationsTo } from '../writeSchemaMapper';

const field = (
	name: string,
	input: WriteDiscoveryField['input'],
	extra: Partial<WriteDiscoveryField> = {},
) =>
	({
		name,
		label: name,
		field_type: input.mode === 'relation' ? 'relation' : 'text',
		value_shape: input.mode === 'relation' ? 'uuid' : 'string',
		required: false,
		readonly: false,
		order: 0,
		instructions: null,
		input,
		...extra,
	}) as WriteDiscoveryField;

const people: WriteDiscoverySchema = {
	form: { id: 'f', name: 'default', label: 'Persone' },
	fields: [
		field('nome', { mode: 'none' }),
		field('progetti', {
			mode: 'relation',
			storage: 'through',
			relation_entity_id: 'ent-projects',
			junction_entity_id: 'ent-junction',
		}),
	],
};

const junction: WriteDiscoverySchema = {
	form: { id: 'fj', name: 'righe', label: 'Righe' },
	fields: [
		field(
			'persona_id',
			{ mode: 'relation', relation_entity_id: 'ent-people' },
			{ required: true, order: 1 },
		),
		field(
			'progetto_id',
			{ mode: 'relation', relation_entity_id: 'ent-projects' },
			{ required: true, order: 2 },
		),
		field('anno', { mode: 'none' }, { value_shape: 'number', required: true, order: 3 }),
		field('commessa_id', { mode: 'relation', relation_entity_id: 'ent-orders' }, { order: 4 }),
	],
};

function loadOptionsCtx(params: Record<string, string>) {
	return { getNodeParameter: (name: string) => params[name] ?? '' } as never;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('withoutRelationsTo', () => {
	it('drops only relations to the given entities', () => {
		const out = withoutRelationsTo(junction, ['ent-people', 'ent-projects', null]);
		expect(out.fields.map((f) => f.name)).toEqual(['anno', 'commessa_id']);
	});
});

describe('Junction Fields mapper', () => {
	it('lists the junction create form without the two link keys', async () => {
		vi.mocked(getWriteSchema).mockImplementation(async (entityId: string) =>
			entityId === 'ent-people' ? people : junction,
		);
		vi.mocked(listForms).mockResolvedValue([
			{ id: 'x', name: 'altro', label: 'Altro' },
			{ id: 'fj', name: 'righe', label: 'Righe', is_default: true },
		]);
		const res = await buildJunctionMapperFields.call(
			loadOptionsCtx({ entityId: 'ent-people', formName: 'default', throughFieldName: 'progetti' }),
		);
		expect(vi.mocked(getWriteSchema).mock.calls[1]).toEqual(['ent-junction', 'righe']);
		expect(res.fields.map((f) => [f.id, f.type, f.required])).toEqual([
			['anno', 'number', true],
			['commessa_id', 'options', false],
		]);
	});

	it('is empty until the N:M field is chosen, or when it is not N:M', async () => {
		expect(
			await buildJunctionMapperFields.call(
				loadOptionsCtx({ entityId: 'ent-people', formName: 'default' }),
			),
		).toEqual({ fields: [] });
		vi.mocked(getWriteSchema).mockResolvedValue(people);
		expect(
			await buildJunctionMapperFields.call(
				loadOptionsCtx({ entityId: 'ent-people', formName: 'default', throughFieldName: 'nome' }),
			),
		).toEqual({ fields: [] });
		expect(listForms).not.toHaveBeenCalled();
	});
});
