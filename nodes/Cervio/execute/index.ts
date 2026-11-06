import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	countViewRecords,
	createRecord,
	deleteRecord,
	flattenRecordRow,
	generateRecordDocument,
	getRecord,
	getWorkflowRunStatus,
	linkThroughRecords,
	listEntityRecords,
	listRecordDocuments,
	listViewRecords,
	MAX_PAGE_LIMIT,
	MAX_PAGES,
	openRecordDocument,
	RELATION_SEARCH_MAX_LIMIT,
	resolveNaturalKeys,
	searchRelationOptions,
	startWorkflowRun,
	unlinkThroughRecords,
	updateRecord,
	uploadRecordDocument,
	upsertRecord,
	validateDraft,
} from '../GenericFunctions';
import {
	parseMultiValueModes,
	parseResolveValues,
	readMappedFieldData,
	requireRecordId,
} from './helpers';

export async function executeCervio(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		if (operation === 'searchRelation') {
			const entityId = this.getNodeParameter('entityId', 0) as string;
			const formName = this.getNodeParameter('formName', 0) as string;
			const fieldName = this.getNodeParameter(
				'relationFieldName',
				0,
			) as string;
			const q = (this.getNodeParameter('relationQuery', 0, '') as string) || '';
			const limit = Math.min(
				RELATION_SEARCH_MAX_LIMIT,
				Math.max(
					1,
					Number(this.getNodeParameter('relationLimit', 0, 50)) || 50,
				),
			);
			if (!fieldName?.trim()) {
				throw new NodeOperationError(
					this.getNode(),
					'Relation field is required.',
				);
			}
			const records = await searchRelationOptions.call(
				this,
				entityId,
				formName,
				fieldName.trim(),
				limit,
				q,
			);
			for (const record of records) {
				returnData.push({
					json: {
						id: record.id,
						label: record.label,
						field: fieldName.trim(),
					},
					pairedItem: { item: 0 },
				});
			}
			return [returnData];
		}

		if (operation === 'listView') {
			const viewId = this.getNodeParameter('viewId', 0) as string;
			const pageMode = this.getNodeParameter('pageMode', 0) as string;
			const limit = Math.min(
				MAX_PAGE_LIMIT,
				Math.max(1, Number(this.getNodeParameter('limit', 0, 50)) || 50),
			);
			const optionsMode = this.getNodeParameter('optionsMode', 0) as string;
			const relationsMode = this.getNodeParameter('relationsMode', 0) as string;
			const locale = (this.getNodeParameter('locale', 0, '') as string) || undefined;
			const includeCount = this.getNodeParameter(
				'includeCount',
				0,
				false,
			) as boolean;
			const listOptions = this.getNodeParameter(
				'listOptions',
				0,
				{},
			) as IDataObject;
			let cursor =
				typeof listOptions.cursor === 'string' && listOptions.cursor.trim()
					? listOptions.cursor.trim()
					: undefined;

			let totalCount: number | undefined;
			if (includeCount) {
				totalCount = await countViewRecords.call(this, viewId);
			}

			const collected: Array<{ id: string; data: Record<string, unknown> }> =
				[];
			let pages = 0;
			let hasMore = false;
			let nextCursor: string | undefined;
			let truncated = false;

			do {
				const qs: IDataObject = {
					limit,
					options: optionsMode,
					relations: relationsMode,
				};
				if (locale) qs.locale = locale;
				if (cursor) qs.cursor = cursor;

				const page = await listViewRecords.call(this, viewId, qs);
				collected.push(...(page.records ?? []));
				pages += 1;
				hasMore = Boolean(page.page?.has_more);
				nextCursor = page.page?.next_cursor;
				cursor = nextCursor;

				if (pageMode !== 'all') break;
				if (!hasMore) break;
				if (pages >= MAX_PAGES) {
					truncated = true;
					break;
				}
			} while (true);

			for (const record of collected) {
				const json: IDataObject = {
					id: record.id,
					...record.data,
				};
				if (totalCount !== undefined) {
					json._view_count = totalCount;
				}
				if (pageMode === 'first' && hasMore && nextCursor) {
					json._next_cursor = nextCursor;
					json._has_more = true;
				}
				if (truncated) {
					json._truncated = true;
					json._next_cursor = nextCursor;
					json._has_more = true;
				}
				returnData.push({ json, pairedItem: { item: 0 } });
			}

			return [returnData];
		}

		if (operation === 'listRecords') {
			const entityId = this.getNodeParameter('entityId', 0) as string;
			const limit = Math.min(
				MAX_PAGE_LIMIT,
				Math.max(
					1,
					Number(this.getNodeParameter('listRecordsLimit', 0, 50)) || 50,
				),
			);
			const offset = Math.max(
				0,
				Number(this.getNodeParameter('listRecordsOffset', 0, 0)) || 0,
			);
			const qs: IDataObject = { limit, offset };
			const filtersRaw = this.getNodeParameter(
				'listRecordsFilters',
				0,
				{},
			) as IDataObject;
			const filterList = filtersRaw.filter;
			const entries = Array.isArray(filterList)
				? filterList
				: filterList
					? [filterList]
					: [];
			for (const entry of entries) {
				if (!entry || typeof entry !== 'object') continue;
				const field = String((entry as { field?: unknown }).field ?? '').trim();
				const value = String((entry as { value?: unknown }).value ?? '').trim();
				if (!field) continue;
				qs[`filter[${field}]`] = `eq.${value}`;
			}
			const records = await listEntityRecords.call(this, entityId, qs);
			for (const record of records) {
				returnData.push({ json: flattenRecordRow(record), pairedItem: { item: 0 } });
			}
			return [returnData];
		}

		const fieldMapperOps = new Set([
			'create',
			'update',
			'upsert',
			'validateDraft',
		]);

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'startWorkflow' || operation === 'getWorkflowRun') {
					const workflowId = this.getNodeParameter('workflowId', i) as string;
					if (operation === 'getWorkflowRun') {
						const runId = (this.getNodeParameter('runId', i) as string)?.trim();
						if (!runId) {
							throw new NodeOperationError(
								this.getNode(),
								'Run ID is required.',
								{ itemIndex: i },
							);
						}
						const status = await getWorkflowRunStatus.call(
							this,
							workflowId,
							runId,
						);
						returnData.push({
							json: status as IDataObject,
							pairedItem: { item: i },
						});
						continue;
					}
					const entityDataId = (
						this.getNodeParameter('entityDataId', i) as string
					)?.trim();
					if (!entityDataId) {
						throw new NodeOperationError(
							this.getNode(),
							'Record ID (entity_data_id) is required.',
							{ itemIndex: i },
						);
					}
					let workflowPayload: IDataObject | undefined;
					const rawData = this.getNodeParameter('workflowData', i, '{}');
					if (typeof rawData === 'string' && rawData.trim()) {
						workflowPayload = JSON.parse(rawData) as IDataObject;
					} else if (rawData && typeof rawData === 'object') {
						workflowPayload = rawData as IDataObject;
					}
					const started = await startWorkflowRun.call(
						this,
						workflowId,
						entityDataId,
						workflowPayload,
					);
					returnData.push({
						json: started as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

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

				if (operation === 'listDocuments') {
					const recordId = requireRecordId(this, i);
					const docs = await listRecordDocuments.call(
						this,
						entityId,
						recordId,
					);
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
					const documentId = (
						this.getNodeParameter('documentId', i) as string
					)?.trim();
					if (!documentId) {
						throw new NodeOperationError(
							this.getNode(),
							'Document ID is required.',
							{ itemIndex: i },
						);
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
					const templateId = (
						this.getNodeParameter('templateId', i) as string
					)?.trim();
					if (!templateId) {
						throw new NodeOperationError(
							this.getNode(),
							'Template ID is required.',
							{ itemIndex: i },
						);
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
						(this.getNodeParameter('binaryPropertyName', i, 'data') as string) ||
						'data';
					const uploadOptions = this.getNodeParameter(
						'uploadOptions',
						i,
						{},
					) as IDataObject;
					const buffer = await this.helpers.getBinaryDataBuffer(
						i,
						binaryProperty,
					);
					const binaryBag = items[i].binary as
						| Record<string, { fileName?: string; mimeType?: string }>
						| undefined;
					const binaryMeta = binaryBag?.[binaryProperty];
					const fileName =
						(typeof uploadOptions.fileName === 'string' &&
						uploadOptions.fileName.trim()
							? uploadOptions.fileName.trim()
							: binaryMeta?.fileName) || 'upload.bin';
					const form = new FormData();
					const mime =
						binaryMeta?.mimeType && binaryMeta.mimeType.trim()
							? binaryMeta.mimeType
							: 'application/octet-stream';
					form.append(
						'file',
						new Blob([new Uint8Array(buffer)], { type: mime }),
						fileName,
					);
					if (
						typeof uploadOptions.title === 'string' &&
						uploadOptions.title.trim()
					) {
						form.append('title', uploadOptions.title.trim());
					}
					form.append('file_name', fileName);
					const uploaded = await uploadRecordDocument.call(
						this,
						entityId,
						recordId,
						form,
					);
					returnData.push({
						json: uploaded as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'linkRecords' || operation === 'unlinkRecords') {
					const formName = this.getNodeParameter('formName', i) as string;
					const fromRecordId = requireRecordId(this, i);
					const farRecordId = (
						this.getNodeParameter('farRecordId', i) as string
					)?.trim();
					const throughField = (
						this.getNodeParameter('throughFieldName', i) as string
					)?.trim();
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
					const resolveOptions = this.getNodeParameter(
						'resolveOptions',
						i,
						{},
					) as IDataObject;
					const fieldName =
						typeof resolveOptions.fieldName === 'string' &&
						resolveOptions.fieldName.trim()
							? resolveOptions.fieldName.trim()
							: undefined;
					const resolved = await resolveNaturalKeys.call(
						this,
						entityId,
						matchField,
						values,
						fieldName,
					);
					const results = (resolved as { results?: unknown[] }).results ?? [
						resolved,
					];
					for (const row of results) {
						returnData.push({
							json: row as IDataObject,
							pairedItem: { item: i },
						});
					}
					continue;
				}

				if (!fieldMapperOps.has(operation)) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation: ${operation}`,
						{ itemIndex: i },
					);
				}

				const formName = this.getNodeParameter('formName', i) as string;
				const data = readMappedFieldData(this, items, i);

				if (operation === 'create') {
					const result = await createRecord.call(
						this,
						entityId,
						formName,
						data,
					);
					returnData.push({
						json: { id: result.id },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'validateDraft') {
					const validateOpts = this.getNodeParameter(
						'validateDraftOptions',
						i,
						{},
					) as IDataObject;
					const existingId =
						typeof validateOpts.recordId === 'string' &&
						validateOpts.recordId.trim()
							? validateOpts.recordId.trim()
							: undefined;
					const result = await validateDraft.call(
						this,
						entityId,
						formName,
						data,
						existingId,
					);
					returnData.push({
						json: result as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'upsert') {
					const matchField = this.getNodeParameter('matchField', i) as string;
					if (!matchField?.trim()) {
						throw new NodeOperationError(
							this.getNode(),
							'Match field is required.',
							{ itemIndex: i },
						);
					}
					const result = await upsertRecord.call(
						this,
						entityId,
						formName,
						matchField.trim(),
						data,
					);
					returnData.push({
						json: result as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'update') {
					if (Object.keys(data).length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Fill at least one field to update.',
							{ itemIndex: i },
						);
					}
					const recordId = requireRecordId(this, i);
					const updateOptions = this.getNodeParameter(
						'updateOptions',
						i,
						{},
					) as IDataObject;
					const expected =
						typeof updateOptions.expectedUpdatedAt === 'string' &&
						updateOptions.expectedUpdatedAt.trim()
							? updateOptions.expectedUpdatedAt.trim()
							: undefined;
					const multiValueModes = parseMultiValueModes(
						updateOptions.multiValueModes,
					);

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

		return [returnData];
}
