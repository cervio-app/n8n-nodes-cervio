import type { IDataObject } from 'n8n-workflow';

import {
	countViewRecords,
	flattenRecordRow,
	listEntityRecords,
	listViewRecords,
	MAX_PAGE_LIMIT,
	MAX_PAGES,
} from '../GenericFunctions';
import { optionalString } from './helpers';
import type { OperationHandler } from './types';

function pageLimit(raw: unknown): number {
	return Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(raw) || 50));
}

export const listOperations: Record<string, OperationHandler> = {
	async listView(i) {
		const viewId = this.getNodeParameter('viewId', i) as string;
		const pageMode = this.getNodeParameter('pageMode', i) as string;
		const limit = pageLimit(this.getNodeParameter('limit', i, 50));
		const optionsMode = this.getNodeParameter('optionsMode', i) as string;
		const relationsMode = this.getNodeParameter('relationsMode', i) as string;
		const locale = optionalString(this.getNodeParameter('locale', i, ''));
		const includeCount = this.getNodeParameter('includeCount', i, false) as boolean;
		const listOptions = this.getNodeParameter('listOptions', i, {}) as IDataObject;
		let cursor = optionalString(listOptions.cursor);

		const totalCount = includeCount ? await countViewRecords.call(this, viewId) : undefined;

		const collected: Array<{ id: string; data: Record<string, unknown> }> = [];
		let pages = 0;
		let hasMore = false;
		let truncated = false;
		for (;;) {
			const qs: IDataObject = { limit, options: optionsMode, relations: relationsMode };
			if (locale) qs.locale = locale;
			if (cursor) qs.cursor = cursor;

			const page = await listViewRecords.call(this, viewId, qs);
			collected.push(...(page.records ?? []));
			pages += 1;
			hasMore = Boolean(page.page?.has_more);
			cursor = page.page?.next_cursor;

			if (pageMode !== 'all' || !hasMore) break;
			if (pages >= MAX_PAGES) {
				truncated = true;
				break;
			}
		}

		return collected.map((record) => {
			const json: IDataObject = { id: record.id, ...record.data };
			if (totalCount !== undefined) json._view_count = totalCount;
			if (hasMore && cursor && (pageMode === 'first' || truncated)) {
				json._has_more = true;
				json._next_cursor = cursor;
			}
			if (truncated) json._truncated = true;
			return json;
		});
	},

	async listRecords(i) {
		const entityId = this.getNodeParameter('entityId', i) as string;
		const limit = pageLimit(this.getNodeParameter('listRecordsLimit', i, 50));
		const offset = Math.max(0, Number(this.getNodeParameter('listRecordsOffset', i, 0)) || 0);
		const qs: IDataObject = { limit, offset };
		const filters = this.getNodeParameter('listRecordsFilters', i, {}) as IDataObject;
		const rows = Array.isArray(filters.filter)
			? filters.filter
			: filters.filter
				? [filters.filter]
				: [];
		for (const row of rows as IDataObject[]) {
			const field = optionalString(row?.field);
			if (!field) continue;
			qs[`filter[${field}]`] = `eq.${String(row.value ?? '').trim()}`;
		}
		const records = await listEntityRecords.call(this, entityId, qs);
		return records.map((record) => flattenRecordRow(record));
	},
};
