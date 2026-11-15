import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';

import {
	getWriteSchema,
	listForms,
	RELATION_DROPDOWN_LIMIT,
	RELATION_SEARCH_MAX_LIMIT,
	searchRelationOptions,
} from '../GenericFunctions';
import {
	withoutRelationsTo,
	writeSchemaToMapperFields,
	type WriteDiscoverySchema,
} from '../writeSchemaMapper';

export async function buildMapperFields(
	this: ILoadOptionsFunctions,
	mode: 'create' | 'update',
): Promise<ResourceMapperFields> {
	const entityId = this.getNodeParameter('entityId') as string;
	const formName = this.getNodeParameter('formName') as string;
	if (!entityId || !formName) return { fields: [] };
	const schema = (await getWriteSchema.call(this, entityId, formName)) as WriteDiscoverySchema;
	return {
		fields: await mapperFieldsWithRelationOptions.call(this, entityId, formName, schema, mode),
	};
}

/**
 * Junction Fields for Link Records: the junction entity's create form, without the
 * two keys Cervio sets itself. Empty when the junction has no other fields.
 */
export async function buildJunctionMapperFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const entityId = this.getNodeParameter('entityId') as string;
	const formName = this.getNodeParameter('formName') as string;
	const throughFieldName = this.getNodeParameter('throughFieldName') as string;
	if (!entityId || !formName || !throughFieldName) return { fields: [] };

	const schema = (await getWriteSchema.call(this, entityId, formName)) as WriteDiscoverySchema;
	const through = schema.fields.find(
		(f) => f.name === throughFieldName && f.input.storage === 'through',
	);
	const junctionEntityId = through?.input.junction_entity_id;
	if (!junctionEntityId) return { fields: [] };

	const forms = await listForms.call(this, junctionEntityId);
	const form = forms.find((f) => f.is_default) ?? forms[0];
	if (!form) return { fields: [] };

	const junctionSchema = withoutRelationsTo(
		(await getWriteSchema.call(this, junctionEntityId, form.name)) as WriteDiscoverySchema,
		[entityId, through.input.relation_entity_id],
	);
	return {
		fields: await mapperFieldsWithRelationOptions.call(
			this,
			junctionEntityId,
			form.name,
			junctionSchema,
			'create',
		),
	};
}

/**
 * Mapper columns for a form. Single relations become a dropdown when their
 * candidates fit under RELATION_DROPDOWN_LIMIT; multi relations stay UUID arrays
 * (browse them with “Search Relation”).
 */
async function mapperFieldsWithRelationOptions(
	this: ILoadOptionsFunctions,
	entityId: string,
	formName: string,
	schema: WriteDiscoverySchema,
	mode: 'create' | 'update',
): Promise<ResourceMapperFields['fields']> {
	const fields = writeSchemaToMapperFields(schema, mode);
	const appendDescription = (field: (typeof fields)[number], text: string) => {
		field.description = [field.description, text].filter(Boolean).join(' ');
	};

	for (const field of fields) {
		const schemaField = schema.fields.find((f) => f.name === field.id);
		if (!schemaField || schemaField.input.mode !== 'relation') continue;

		let records: Array<{ id: string; label: string }>;
		try {
			records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				field.id,
				RELATION_DROPDOWN_LIMIT,
			);
		} catch {
			continue; // Keep the field as free-text UUID / array.
		}
		const fitsDropdown = records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT;

		if (schemaField.input.multi_select) {
			if (fitsDropdown) {
				const preview = records
					.slice(0, 8)
					.map((r) => `${r.label} (${r.id})`)
					.join('; ');
				appendDescription(
					field,
					`For example: ${preview}${records.length > 8 ? '…' : ''}. To find others, use Relation → Search.`,
				);
			} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
				appendDescription(
					field,
					`${RELATION_DROPDOWN_LIMIT} or more possible records: find their IDs with Relation → Search (up to ${RELATION_SEARCH_MAX_LIMIT} per search).`,
				);
			}
			continue;
		}

		if (fitsDropdown) {
			field.type = 'options';
			field.options = records.map((r) => ({ name: r.label, value: r.id }));
		} else if (records.length >= RELATION_DROPDOWN_LIMIT) {
			appendDescription(
				field,
				`Too many records for a list (${RELATION_DROPDOWN_LIMIT} or more): find the ID with Relation → Search.`,
			);
		}
	}
	return fields;
}
