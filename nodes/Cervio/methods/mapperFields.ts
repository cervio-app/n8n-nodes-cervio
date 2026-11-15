import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';

import {
	getWriteSchema,
	listForms,
	RELATION_DROPDOWN_LIMIT,
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
 * Mapper columns for a form. A single relation becomes a list of its records when
 * there are fewer than RELATION_DROPDOWN_LIMIT; otherwise, and for multi-select
 * relations, it stays a field for record IDs (found with Relation → Search).
 */
async function mapperFieldsWithRelationOptions(
	this: ILoadOptionsFunctions,
	entityId: string,
	formName: string,
	schema: WriteDiscoverySchema,
	mode: 'create' | 'update',
): Promise<ResourceMapperFields['fields']> {
	const fields = writeSchemaToMapperFields(schema, mode);
	for (const field of fields) {
		const schemaField = schema.fields.find((f) => f.name === field.id);
		if (schemaField?.input.mode !== 'relation' || schemaField.input.multi_select) continue;
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
			continue; // The user can still type the record ID.
		}
		if (records.length > 0 && records.length < RELATION_DROPDOWN_LIMIT) {
			field.type = 'options';
			field.options = records.map((r) => ({ name: r.label, value: r.id }));
		}
	}
	return fields;
}
