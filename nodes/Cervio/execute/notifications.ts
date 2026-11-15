import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { isUuid, notifySelf, notifyUsers, type CervioNotifyPayload } from '../GenericFunctions';
import { optionalString } from './parameters';
import type { OperationHandler } from './types';

/** Lengths are capped by Cervio (body 2000, href 500, source fields 100/200). */
function readNotifyPayload(ctx: IExecuteFunctions, itemIndex: number): CervioNotifyPayload {
	const title = optionalString(ctx.getNodeParameter('notificationTitle', itemIndex));
	if (!title) {
		throw new NodeOperationError(ctx.getNode(), 'Title is required.', { itemIndex });
	}
	if (title.length > 200) {
		throw new NodeOperationError(ctx.getNode(), 'Title must be at most 200 characters.', {
			itemIndex,
		});
	}
	const payload: CervioNotifyPayload = {
		title,
		category:
			optionalString(ctx.getNodeParameter('notificationCategory', itemIndex, 'plugin')) ?? 'plugin',
	};
	const body = optionalString(ctx.getNodeParameter('notificationBody', itemIndex, ''));
	const href = optionalString(ctx.getNodeParameter('notificationHref', itemIndex, ''));
	const sourceType = optionalString(ctx.getNodeParameter('notificationSourceType', itemIndex, ''));
	const sourceId = optionalString(ctx.getNodeParameter('notificationSourceId', itemIndex, ''));
	if (body) payload.body = body;
	if (href) payload.href = href;
	if (sourceType) payload.source_type = sourceType;
	if (sourceId) payload.source_id = sourceId;
	return payload;
}

function readUserIds(ctx: IExecuteFunctions, itemIndex: number): string[] {
	const raw = ctx.getNodeParameter('notificationUserIds', itemIndex, {}) as {
		user?: Array<{ id?: string }> | { id?: string };
	};
	const rows = Array.isArray(raw.user) ? raw.user : raw.user ? [raw.user] : [];
	const ids = [...new Set(rows.map((r) => String(r?.id ?? '').trim()).filter(Boolean))];
	const invalid = ids.filter((id) => !isUuid(id));
	if (invalid.length > 0) {
		throw new NodeOperationError(
			ctx.getNode(),
			`User IDs must be UUIDs: ${invalid.map((id) => `"${id.slice(0, 60)}"`).join(', ')}.`,
			{ itemIndex },
		);
	}
	if (ids.length === 0) {
		throw new NodeOperationError(ctx.getNode(), 'Add at least one user ID.', { itemIndex });
	}
	if (ids.length > 50) {
		throw new NodeOperationError(ctx.getNode(), 'At most 50 users per notification.', {
			itemIndex,
		});
	}
	return ids;
}

export const notificationOperations: Record<string, OperationHandler> = {
	async notifySelf(i) {
		return (await notifySelf.call(this, readNotifyPayload(this, i))) as IDataObject;
	},

	async notifyUsers(i) {
		const payload = readNotifyPayload(this, i);
		return (await notifyUsers.call(this, readUserIds(this, i), payload)) as IDataObject;
	},
};
