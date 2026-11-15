import type { IDataObject } from 'n8n-workflow';
import {
	linkThroughRecords,
	resolveNaturalKeys,
	searchRelationOptions,
	RELATION_DROPDOWN_LIMIT,
	RELATION_SEARCH_MAX_LIMIT,
	unlinkThroughRecord,
} from '../GenericFunctions';
import {
	optionalString,
	parseResolveValues,
	readJunctionFieldData,
	requireRecordId,
	requireString,
} from './parameters';
import type { OperationHandler } from './types';

export const relationOperations: Record<string, OperationHandler> = {
	async searchRelation(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const formName = this.getNodeParameter('formName', i) as string;
		const fieldName = requireString(this, 'relationFieldName', i, 'Relation field');
		const q = optionalString(this.getNodeParameter('relationQuery', i, ''));
		const limit = Math.min(
			RELATION_SEARCH_MAX_LIMIT,
			Math.max(
				1,
				Number(this.getNodeParameter('relationLimit', i, RELATION_DROPDOWN_LIMIT)) ||
					RELATION_DROPDOWN_LIMIT,
			),
		);
		const records = await searchRelationOptions.call(this, entityId, formName, fieldName, limit, q);
		return records.map((r) => ({ id: r.id, label: r.label, field: fieldName }));
	},

	async resolveRelation(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const matchField = this.getNodeParameter('matchField', i) as string;
		const values = parseResolveValues(this, this.getNodeParameter('resolveValues', i) as string, i);
		const options = this.getNodeParameter('resolveOptions', i, {}) as IDataObject;
		const resolved = await resolveNaturalKeys.call(
			this,
			entityId,
			matchField,
			values,
			optionalString(options.fieldName),
		);
		const results = (resolved as { results?: unknown[] }).results ?? [resolved];
		return results as IDataObject[];
	},

	async linkRecords(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const formName = this.getNodeParameter('formName', i) as string;
		const throughField = requireString(this, 'throughFieldName', i, 'Through field');
		const fromRecordId = requireRecordId(this, i);
		const farRecordId = requireString(this, 'farRecordId', i, 'Far record ID');
		const data = readJunctionFieldData(this, i);
		const linked = await linkThroughRecords.call(
			this,
			entityId,
			formName,
			throughField,
			fromRecordId,
			farRecordId,
			data,
		);
		return {
			junction_record_id: linked.junction_record_id,
			record_id: fromRecordId,
			far_record_id: farRecordId,
			...(Object.keys(data).length > 0 ? { data } : {}),
		};
	},

	async unlinkRecords(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const formName = this.getNodeParameter('formName', i) as string;
		const throughField = requireString(this, 'throughFieldName', i, 'Through field');
		const fromRecordId = requireRecordId(this, i);
		const junctionRecordId = requireString(this, 'junctionRecordId', i, 'Junction record ID');
		const result = await unlinkThroughRecord.call(
			this,
			entityId,
			formName,
			throughField,
			fromRecordId,
			junctionRecordId,
		);
		// deleted = 0: the row is already gone or belongs to another record (safe to retry).
		return {
			deleted: result.deleted,
			junction_record_id: junctionRecordId,
			record_id: fromRecordId,
		};
	},
};
