/**
 * Pure helpers: Cervio write-schema → n8n resourceMapper fields.
 * Only types come from n8n-workflow, so these helpers stay free of the n8n runtime.
 */
import type { IDataObject, ResourceMapperField } from 'n8n-workflow';

export type WriteDiscoveryValueShape =
	| 'string'
	| 'number'
	| 'boolean'
	| 'uuid'
	| 'uuid[]'
	| 'string[]';

export type WriteDiscoveryInputMode =
	| 'none'
	| 'boolean'
	| 'fixed_list'
	| 'remote_options'
	| 'relation';

export type WriteDiscoveryOption = { value: string; label: string };

export type WriteDiscoveryField = {
	name: string;
	label: string;
	field_type: string;
	value_shape: WriteDiscoveryValueShape;
	required: boolean;
	readonly: boolean;
	order: number;
	instructions: string | null;
	server_filled?: 'default' | 'computed';
	client_may_omit?: boolean;
	input: {
		mode: WriteDiscoveryInputMode;
		options?: WriteDiscoveryOption[];
		relation_entity_id?: string | null;
		multi_select?: boolean;
		storage?: 'parent_fk' | 'child_fk' | 'through';
		junction_entity_id?: string | null;
	};
};

export type WriteDiscoverySchema = {
	form: { id: string; name: string; label: string };
	fields: WriteDiscoveryField[];
};

/**
 * A resource mapper column, as n8n defines it. n8n shows no per-column description,
 * so hints for the user belong in the Fields parameter's description instead.
 */
export type MapperField = ResourceMapperField;
export type MapperFieldType = NonNullable<ResourceMapperField['type']>;

/** Whether a write-schema field should appear in the guided mapper. */
export function isWritableMapperField(field: WriteDiscoveryField): boolean {
	if (field.readonly) return false;
	if (field.server_filled === 'computed') return false;
	if (field.input.storage === 'through') return false;
	return true;
}

export function mapValueShapeToMapperType(field: WriteDiscoveryField): MapperFieldType {
	if (field.input.mode === 'fixed_list') return 'options';
	if (field.input.mode === 'boolean' || field.value_shape === 'boolean') {
		return 'boolean';
	}
	if (field.value_shape === 'number') return 'number';
	if (field.field_type === 'date' || field.field_type === 'datetime') {
		return 'dateTime';
	}
	if (field.value_shape === 'uuid[]' || field.value_shape === 'string[]') {
		return 'array';
	}
	return 'string';
}

/**
 * Convert write-schema fields into resourceMapper columns.
 * @param requiredMode 'create' keeps schema required flags; 'update' makes all optional (PATCH merge).
 * Dedupes by field name (far-edit can repeat the same relation on one form).
 */
export function writeSchemaToMapperFields(
	schema: WriteDiscoverySchema,
	requiredMode: 'create' | 'update' = 'create',
): MapperField[] {
	const seen = new Set<string>();
	const fields = schema.fields
		.filter(isWritableMapperField)
		.slice()
		.sort((a, b) => a.order - b.order)
		.filter((field) => {
			if (seen.has(field.name)) return false;
			seen.add(field.name);
			return true;
		});

	return fields.map((field) => {
		const type = mapValueShapeToMapperType(field);
		const options =
			type === 'options' && field.input.options
				? field.input.options.map((o) => ({
						name: o.label || o.value,
						value: o.value,
					}))
				: undefined;

		return {
			id: field.name,
			displayName: field.label || field.name,
			required: requiredMode === 'create' ? field.required : false,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type,
			options,
		};
	});
}

/**
 * Junction schema without the relation fields to the two linked entities: Cervio
 * fills those keys itself when it creates the link, and ignores them in `data`.
 */
export function withoutRelationsTo(
	schema: WriteDiscoverySchema,
	entityIds: ReadonlyArray<string | null | undefined>,
): WriteDiscoverySchema {
	const skip = new Set(entityIds.filter((id): id is string => Boolean(id)));
	return {
		...schema,
		fields: schema.fields.filter(
			(f) =>
				!(
					f.input.mode === 'relation' &&
					f.input.relation_entity_id &&
					skip.has(f.input.relation_entity_id)
				),
		),
	};
}

/** Unwrap listView `{ id, label }` (and arrays thereof) into write-ready ids/slugs. */
export function coerceWriteValue(value: unknown): unknown {
	if (value === undefined || value === null) return value;
	if (Array.isArray(value)) {
		return value
			.map((item) => coerceWriteValue(item))
			.filter((item) => item !== undefined && item !== null && item !== '');
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (
			(trimmed.startsWith('[') && trimmed.endsWith(']')) ||
			(trimmed.startsWith('{') && trimmed.endsWith('}'))
		) {
			try {
				return coerceWriteValue(JSON.parse(trimmed) as unknown);
			} catch {
				/* fall through */
			}
		}
		if (trimmed.includes(',') && /^[\s0-9a-fA-F,-]+$/.test(trimmed)) {
			return trimmed
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean);
		}
		return trimmed;
	}
	if (typeof value === 'object' && value !== null && 'id' in value) {
		const id = (value as { id: unknown }).id;
		if (id === undefined || id === null) return value;
		return typeof id === 'string' || typeof id === 'number' || typeof id === 'boolean'
			? id
			: String(id);
	}
	return value;
}

/** Drop empty / undefined values; keep false and 0. Coerce `{id,label}` from listView. */
export function pickCompiledFieldValues(
	raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
	if (!raw || typeof raw !== 'object') return {};
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined || value === null) continue;
		const coerced = coerceWriteValue(value); // never null for a non-null value
		if (typeof coerced === 'string' && coerced.trim() === '') continue;
		if (Array.isArray(coerced) && coerced.length === 0) continue;
		out[key] = coerced;
	}
	return out;
}

/** Same as pickCompiledFieldValues, typed for n8n IDataObject consumers. */
export function pickCompiledFieldData(
	raw: Record<string, unknown> | null | undefined,
): IDataObject {
	return pickCompiledFieldValues(raw) as IDataObject;
}

export function formLabelWithRole(form: {
	name: string;
	label: string;
	is_default?: boolean;
	is_default_view?: boolean;
}): string {
	const roles: string[] = [];
	if (form.is_default_view) roles.push('edit');
	if (form.is_default) roles.push('create');
	const suffix = roles.length > 0 ? ` (${roles.join(', ')})` : '';
	return `${form.label || form.name}${suffix}`;
}
