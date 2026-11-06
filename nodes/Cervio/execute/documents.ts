import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	generateRecordDocument,
	listRecordDocuments,
	openRecordDocument,
	uploadRecordDocument,
} from '../GenericFunctions';
import { requireRecordId } from './helpers';

export async function executeDocumentOperations(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	operation: string,
	returnData: INodeExecutionData[],
): Promise<void> {
	for (let i = 0; i < items.length; i++) {
		try {
			const entityId = this.getNodeParameter('entityId', i) as string;

			if (operation === 'listDocuments') {
				const recordId = requireRecordId(this, i);
				const docs = await listRecordDocuments.call(this, entityId, recordId);
				for (const doc of docs) {
					returnData.push({
						json: doc as IDataObject,
						pairedItem: { item: i },
					});
				}
				if (docs.length === 0) {
					returnData.push({
						json: { _empty: true, record_id: recordId },
						pairedItem: { item: i },
					});
				}
				continue;
			}

			if (operation === 'openDocument') {
				const recordId = requireRecordId(this, i);
				const documentId = (this.getNodeParameter('documentId', i) as string)?.trim();
				if (!documentId) {
					throw new NodeOperationError(this.getNode(), 'Document ID is required.', {
						itemIndex: i,
					});
				}
				const opened = await openRecordDocument.call(
					this,
					entityId,
					recordId,
					documentId,
				);
				returnData.push({
					json: opened as IDataObject,
					pairedItem: { item: i },
				});
				continue;
			}

			if (operation === 'generateDocument') {
				const recordId = requireRecordId(this, i);
				const templateId = (this.getNodeParameter('templateId', i) as string)?.trim();
				if (!templateId) {
					throw new NodeOperationError(this.getNode(), 'Template ID is required.', {
						itemIndex: i,
					});
				}
				const generated = await generateRecordDocument.call(
					this,
					entityId,
					recordId,
					templateId,
				);
				returnData.push({
					json: generated as IDataObject,
					pairedItem: { item: i },
				});
				continue;
			}

			if (operation === 'uploadDocument') {
				const recordId = requireRecordId(this, i);
				const binaryProperty =
					(this.getNodeParameter('binaryPropertyName', i, 'data') as string) || 'data';
				const uploadOptions = this.getNodeParameter('uploadOptions', i, {}) as IDataObject;
				const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
				const binaryBag = items[i].binary as
					| Record<string, { fileName?: string; mimeType?: string }>
					| undefined;
				const binaryMeta = binaryBag?.[binaryProperty];
				const fileName =
					(typeof uploadOptions.fileName === 'string' && uploadOptions.fileName.trim()
						? uploadOptions.fileName.trim()
						: binaryMeta?.fileName) || 'upload.bin';
				const form = new FormData();
				const mime =
					binaryMeta?.mimeType && binaryMeta.mimeType.trim()
						? binaryMeta.mimeType
						: 'application/octet-stream';
				form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), fileName);
				if (typeof uploadOptions.title === 'string' && uploadOptions.title.trim()) {
					form.append('title', uploadOptions.title.trim());
				}
				form.append('file_name', fileName);
				const uploaded = await uploadRecordDocument.call(this, entityId, recordId, form);
				returnData.push({
					json: uploaded as IDataObject,
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
