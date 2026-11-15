import type { IDataObject } from 'n8n-workflow';

import {
	generateRecordDocument,
	listRecordDocuments,
	openRecordDocument,
	uploadRecordDocument,
} from '../GenericFunctions';
import { optionalString, requireRecordId, requireString } from './parameters';
import type { OperationHandler } from './types';

export const documentOperations: Record<string, OperationHandler> = {
	async listDocuments(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const recordId = requireRecordId(this, i);
		// No documents → no items (turn on "Always Output Data" to keep the flow going).
		return (await listRecordDocuments.call(this, entityId, recordId)) as IDataObject[];
	},

	async openDocument(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const recordId = requireRecordId(this, i);
		const documentId = requireString(this, 'documentId', i, 'Document ID');
		return (await openRecordDocument.call(this, entityId, recordId, documentId)) as IDataObject;
	},

	async generateDocument(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const recordId = requireRecordId(this, i);
		const templateId = requireString(this, 'templateId', i, 'Template ID');
		return (await generateRecordDocument.call(this, entityId, recordId, templateId)) as IDataObject;
	},

	async uploadDocument(i, items) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const recordId = requireRecordId(this, i);
		const binaryProperty =
			optionalString(this.getNodeParameter('binaryPropertyName', i, 'data')) ?? 'data';
		const options = this.getNodeParameter('uploadOptions', i, {}) as IDataObject;
		const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
		const meta = items[i].binary?.[binaryProperty];
		const fileName = optionalString(options.fileName) ?? meta?.fileName ?? 'upload.bin';
		const mimeType = optionalString(meta?.mimeType) ?? 'application/octet-stream';

		const form = new FormData();
		form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
		form.append('file_name', fileName);
		const title = optionalString(options.title);
		if (title) form.append('title', title);
		return (await uploadRecordDocument.call(this, entityId, recordId, form)) as IDataObject;
	},
};
