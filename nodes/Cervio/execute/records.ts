import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	createRecord,
	deleteRecord,
	flattenRecordRow,
	getRecord,
	updateRecord,
	upsertRecord,
	validateDraft,
} from '../GenericFunctions';
import {
	optionalString,
	parseMultiValueModes,
	readMappedFieldData,
	requireRecordId,
} from './parameters';
import type { OperationHandler } from './types';

export const recordOperations: Record<string, OperationHandler> = {
	async get(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const record = await getRecord.call(this, entityId, requireRecordId(this, i));
		return flattenRecordRow(record);
	},

	async delete(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const recordId = requireRecordId(this, i);
		await deleteRecord.call(this, entityId, recordId);
		return { ok: true, id: recordId };
	},

	async create(i, items) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const formName = this.getNodeParameter('formName', i) as string;
		const data = readMappedFieldData(this, items, i);
		const result = await createRecord.call(this, entityId, formName, data);
		return { id: result.id };
	},

	async validateDraft(i, items) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const formName = this.getNodeParameter('formName', i) as string;
		const data = readMappedFieldData(this, items, i);
		const options = this.getNodeParameter('validateDraftOptions', i, {}) as IDataObject;
		const result = await validateDraft.call(
			this,
			entityId,
			formName,
			data,
			optionalString(options.recordId),
		);
		return result as IDataObject;
	},

	async upsert(i, items) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const formName = this.getNodeParameter('formName', i) as string;
		const matchField = optionalString(this.getNodeParameter('matchField', i));
		if (!matchField) {
			throw new NodeOperationError(this.getNode(), 'Match field is required.', { itemIndex: i });
		}
		const data = readMappedFieldData(this, items, i);
		const result = await upsertRecord.call(this, entityId, formName, matchField, data);
		return result as IDataObject;
	},

	async update(i, items) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const formName = this.getNodeParameter('formName', i) as string;
		const data = readMappedFieldData(this, items, i);
		if (Object.keys(data).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Fill at least one field to update.', {
				itemIndex: i,
			});
		}
		const recordId = requireRecordId(this, i);
		const options = this.getNodeParameter('updateOptions', i, {}) as IDataObject;
		const result = await updateRecord.call(
			this,
			entityId,
			recordId,
			formName,
			data,
			optionalString(options.expectedUpdatedAt),
			parseMultiValueModes(options.multiValueModes),
		);
		return { id: result.id };
	},
};
