/**
 * Pure helpers: Cervio write-schema → n8n resourceMapper fields.
 * Kept free of n8n runtime so unit tests can run without the workflow package.
 */

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

/** Field type strings understood by n8n resourceMapper. */
export type MapperFieldType =
	| 'string'
	| 'number'
	| 'boolean'
	| 'dateTime'
	| 'time'
	| 'object'
	| 'options'
	| 'array';

export type MapperFieldOption = { name: string; value: string };

export type MapperField = {
	id: string;
	displayName: string;
	required: boolean;
	defaultMatch: boolean;
	canBeUsedToMatch: boolean;
	display: boolean;
	type: MapperFieldType;
	options?: MapperFieldOption[];
	readOnly?: boolean;
	removed?: boolean;
	description?: string;
};

/** Whether a write-schema field should appear in the guided mapper. */
export function isWritableMapperField(field: WriteDiscoveryField): boolean {
	if (field.readonly) return false;
	if (field.server_filled === 'computed') return false;
	if (field.input.storage === 'through') return false;
	return true;
}

export function mapValueShapeToMapperType(
	field: WriteDiscoveryField,
): MapperFieldType {
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

		const descriptionParts: string[] = [];
		if (field.instructions) descriptionParts.push(field.instructions);
		if (field.input.mode === 'relation') {
			if (field.input.multi_select) {
				descriptionParts.push(
					'Multi-select: UUID array (or JSON string / comma-separated UUIDs). On Update use “Multi-value mode” (add/replace/remove). If the dropdown is missing, use the “Search relation” operation.',
				);
			} else {
				descriptionParts.push(
					'UUID of the related record. Dropdown when few candidates; otherwise use “Search relation” or paste a UUID.',
				);
			}
		}
		if (field.input.mode === 'remote_options') {
			descriptionParts.push('Remote option value: use the saved slug or id.');
		}

		return {
			id: field.name,
			displayName: field.label || field.name,
			required: requiredMode === 'create' ? field.required : false,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type,
			options,
			description:
				descriptionParts.length > 0 ? descriptionParts.join(' ') : undefined,
		};
	});
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
		const coerced = coerceWriteValue(value);
		if (coerced === undefined || coerced === null) continue;
		if (typeof coerced === 'string' && coerced.trim() === '') continue;
		if (Array.isArray(coerced) && coerced.length === 0) continue;
		out[key] = coerced;
	}
	return out;
}

export function formLabelWithRole(form: {
	name: string;
	label: string;
	is_default?: boolean;
	is_default_view?: boolean;
}): string {
	const roles: string[] = [];
	if (form.is_default_view) roles.push('modifica');
	if (form.is_default) roles.push('creazione');
	const suffix = roles.length > 0 ? ` (${roles.join(', ')})` : '';
	return `${form.label || form.name}${suffix}`;
}
