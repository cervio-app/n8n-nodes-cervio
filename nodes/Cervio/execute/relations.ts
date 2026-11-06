import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { linkThroughRecords, resolveNaturalKeys, unlinkThroughRecords } from '../GenericFunctions';
import { parseResolveValues, requireRecordId } from './helpers';

export async function executeRelationOperations(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	operation: string,
	returnData: INodeExecutionData[],
): Promise<void> {
	for (let i = 0; i < items.length; i++) {
		try {
			const entityId = this.getNodeParameter('entityId', i) as string;

			if (operation === 'linkRecords' || operation === 'unlinkRecords') {
				const formName = this.getNodeParameter('formName', i) as string;
				const fromRecordId = requireRecordId(this, i);
				const farRecordId = (this.getNodeParameter('farRecordId', i) as string)?.trim();
				const throughField = (this.getNodeParameter('throughFieldName', i) as string)?.trim();
				if (!farRecordId || !throughField) {
					throw new NodeOperationError(
						this.getNode(),
						'Through field and far record ID are required.',
						{ itemIndex: i },
					);
				}
				if (operation === 'linkRecords') {
					const linked = await linkThroughRecords.call(
						this,
						entityId,
						formName,
						throughField,
						fromRecordId,
						farRecordId,
					);
					returnData.push({
						json: linked as IDataObject,
						pairedItem: { item: i },
					});
				} else {
					const unlinked = await unlinkThroughRecords.call(
						this,
						entityId,
						formName,
						throughField,
						fromRecordId,
						farRecordId,
					);
					returnData.push({
						json: unlinked as IDataObject,
						pairedItem: { item: i },
					});
				}
				continue;
			}

			if (operation === 'resolveRelation') {
				const matchField = this.getNodeParameter('matchField', i) as string;
				const values = parseResolveValues(
					this,
					this.getNodeParameter('resolveValues', i) as string,
					i,
				);
				const resolveOptions = this.getNodeParameter('resolveOptions', i, {}) as IDataObject;
				const fieldName =
					typeof resolveOptions.fieldName === 'string' && resolveOptions.fieldName.trim()
						? resolveOptions.fieldName.trim()
						: undefined;
				const resolved = await resolveNaturalKeys.call(
					this,
					entityId,
					matchField,
					values,
					fieldName,
				);
				const results = (resolved as { results?: unknown[] }).results ?? [resolved];
				for (const row of results) {
					returnData.push({
						json: row as IDataObject,
						pairedItem: { item: i },
					});
				}
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
