import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

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
	parseMultiValueModes,
	readMappedFieldData,
	requireRecordId,
} from './helpers';

export async function executeRecordOperations(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	operation: string,
	returnData: INodeExecutionData[],
): Promise<void> {
	for (let i = 0; i < items.length; i++) {
		try {
			const entityId = this.getNodeParameter('entityId', i) as string;

			if (operation === 'get') {
				const recordId = requireRecordId(this, i);
				const record = await getRecord.call(this, entityId, recordId);
				returnData.push({
					json: flattenRecordRow(record),
					pairedItem: { item: i },
				});
				continue;
			}

			if (operation === 'delete') {
				const recordId = requireRecordId(this, i);
				await deleteRecord.call(this, entityId, recordId);
				returnData.push({
					json: { ok: true, id: recordId },
					pairedItem: { item: i },
				});
				continue;
			}

			const formName = this.getNodeParameter('formName', i) as string;
			const data = readMappedFieldData(this, items, i);

			if (operation === 'create') {
				const result = await createRecord.call(this, entityId, formName, data);
				returnData.push({
					json: { id: result.id },
					pairedItem: { item: i },
				});
				continue;
			}

			if (operation === 'validateDraft') {
				const validateOpts = this.getNodeParameter('validateDraftOptions', i, {}) as IDataObject;
				const existingId =
					typeof validateOpts.recordId === 'string' && validateOpts.recordId.trim()
						? validateOpts.recordId.trim()
						: undefined;
				const result = await validateDraft.call(this, entityId, formName, data, existingId);
				returnData.push({
					json: result as IDataObject,
					pairedItem: { item: i },
				});
				continue;
			}

			if (operation === 'upsert') {
				const matchField = this.getNodeParameter('matchField', i) as string;
				if (!matchField?.trim()) {
					throw new NodeOperationError(this.getNode(), 'Match field is required.', {
						itemIndex: i,
					});
				}
				const result = await upsertRecord.call(this, entityId, formName, matchField.trim(), data);
				returnData.push({
					json: result as IDataObject,
					pairedItem: { item: i },
				});
				continue;
			}

			if (operation === 'update') {
				if (Object.keys(data).length === 0) {
					throw new NodeOperationError(this.getNode(), 'Fill at least one field to update.', {
						itemIndex: i,
					});
				}
				const recordId = requireRecordId(this, i);
				const updateOptions = this.getNodeParameter('updateOptions', i, {}) as IDataObject;
				const expected =
					typeof updateOptions.expectedUpdatedAt === 'string' &&
					updateOptions.expectedUpdatedAt.trim()
						? updateOptions.expectedUpdatedAt.trim()
						: undefined;
				const multiValueModes = parseMultiValueModes(updateOptions.multiValueModes);

				const result = await updateRecord.call(
					this,
					entityId,
					recordId,
					formName,
					data,
					expected,
					multiValueModes,
				);
				returnData.push({
					json: { id: result.id },
					pairedItem: { item: i },
				});
				continue;
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: {
						error: error instanceof Error ? error.message : String(error),
					},
					pairedItem: { item: i },
				});
				continue;
			}
			const wrapped =
				error instanceof NodeOperationError || error instanceof NodeApiError
					? error
					: new NodeOperationError(
							this.getNode(),
							error instanceof Error ? error.message : String(error),
							{ itemIndex: i },
						);
			throw wrapped;
		}
	}
}
