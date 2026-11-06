import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	countViewRecords,
	flattenRecordRow,
	listEntityRecords,
	listViewRecords,
	MAX_PAGE_LIMIT,
	MAX_PAGES,
	RELATION_SEARCH_MAX_LIMIT,
	searchRelationOptions,
} from '../GenericFunctions';

export async function executeSearchRelationBatch(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const entityId = this.getNodeParameter('entityId', 0) as string;
	const formName = this.getNodeParameter('formName', 0) as string;
	const fieldName = this.getNodeParameter('relationFieldName', 0) as string;
	const q = (this.getNodeParameter('relationQuery', 0, '') as string) || '';
	const limit = Math.min(
		RELATION_SEARCH_MAX_LIMIT,
		Math.max(1, Number(this.getNodeParameter('relationLimit', 0, 50)) || 50),
	);
	if (!fieldName?.trim()) {
		throw new NodeOperationError(this.getNode(), 'Relation field is required.');
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
	return returnData;
}

export async function executeListViewBatch(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const viewId = this.getNodeParameter('viewId', 0) as string;
	const pageMode = this.getNodeParameter('pageMode', 0) as string;
	const limit = Math.min(
		MAX_PAGE_LIMIT,
		Math.max(1, Number(this.getNodeParameter('limit', 0, 50)) || 50),
	);
	const optionsMode = this.getNodeParameter('optionsMode', 0) as string;
	const relationsMode = this.getNodeParameter('relationsMode', 0) as string;
	const locale = (this.getNodeParameter('locale', 0, '') as string) || undefined;
	const includeCount = this.getNodeParameter('includeCount', 0, false) as boolean;
	const listOptions = this.getNodeParameter('listOptions', 0, {}) as IDataObject;
	let cursor =
		typeof listOptions.cursor === 'string' && listOptions.cursor.trim()
			? listOptions.cursor.trim()
			: undefined;

	let totalCount: number | undefined;
	if (includeCount) {
		totalCount = await countViewRecords.call(this, viewId);
	}

	const collected: Array<{ id: string; data: Record<string, unknown> }> = [];
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

	return returnData;
}

export async function executeListRecordsBatch(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const entityId = this.getNodeParameter('entityId', 0) as string;
	const limit = Math.min(
		MAX_PAGE_LIMIT,
		Math.max(1, Number(this.getNodeParameter('listRecordsLimit', 0, 50)) || 50),
	);
	const offset = Math.max(
		0,
		Number(this.getNodeParameter('listRecordsOffset', 0, 0)) || 0,
	);
	const qs: IDataObject = { limit, offset };
	const filtersRaw = this.getNodeParameter('listRecordsFilters', 0, {}) as IDataObject;
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
	return returnData;
}
