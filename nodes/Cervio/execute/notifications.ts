import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { notifySelf, notifyUsers } from '../GenericFunctions';

function readNotifyPayload(
	ctx: IExecuteFunctions,
	itemIndex: number,
): {
	title: string;
	body?: string;
	href?: string;
	category?: string;
	source_type?: string;
	source_id?: string;
} {
	const title = (ctx.getNodeParameter('notificationTitle', itemIndex) as string)?.trim();
	if (!title) {
		throw new NodeOperationError(ctx.getNode(), 'Title is required.', { itemIndex });
	}
	if (title.length > 200) {
		throw new NodeOperationError(ctx.getNode(), 'Title must be at most 200 characters.', {
			itemIndex,
		});
	}

	const body = (ctx.getNodeParameter('notificationBody', itemIndex, '') as string)?.trim();
	const href = (ctx.getNodeParameter('notificationHref', itemIndex, '') as string)?.trim();
	const category = (ctx.getNodeParameter('notificationCategory', itemIndex, 'plugin') as string)
		?.trim();
	const sourceType = (
		ctx.getNodeParameter('notificationSourceType', itemIndex, '') as string
	)?.trim();
	const sourceId = (
		ctx.getNodeParameter('notificationSourceId', itemIndex, '') as string
	)?.trim();

	const payload: {
		title: string;
		body?: string;
		href?: string;
		category?: string;
		source_type?: string;
		source_id?: string;
	} = { title, category: category || 'plugin' };

	if (body) payload.body = body.slice(0, 2000);
	if (href) payload.href = href.slice(0, 500);
	if (sourceType) payload.source_type = sourceType.slice(0, 100);
	if (sourceId) payload.source_id = sourceId.slice(0, 200);
	return payload;
}

function readUserIds(ctx: IExecuteFunctions, itemIndex: number): string[] {
	const raw = ctx.getNodeParameter('notificationUserIds', itemIndex, {}) as {
		user?: Array<{ id?: string }> | { id?: string };
	};
	const rows = Array.isArray(raw.user) ? raw.user : raw.user ? [raw.user] : [];
	const ids = rows
		.map((r) => String(r?.id ?? '').trim())
		.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
	const unique = [...new Set(ids)];
	if (unique.length === 0) {
		throw new NodeOperationError(
			ctx.getNode(),
			'At least one valid user UUID is required.',
			{ itemIndex },
		);
	}
	if (unique.length > 50) {
		throw new NodeOperationError(
			ctx.getNode(),
			'At most 50 recipients per request.',
			{ itemIndex },
		);
	}
	return unique;
}

export async function executeNotificationOperations(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	operation: string,
	returnData: INodeExecutionData[],
): Promise<void> {
	for (let i = 0; i < items.length; i++) {
		try {
			const payload = readNotifyPayload(this, i);
			let result: unknown;
			if (operation === 'notifySelf') {
				result = await notifySelf.call(this, payload);
			} else if (operation === 'notifyUsers') {
				const userIds = readUserIds(this, i);
				result = await notifyUsers.call(this, userIds, payload);
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`Unsupported notification operation: ${operation}`,
					{ itemIndex: i },
				);
			}
			returnData.push({
				json: result as IDataObject,
				pairedItem: { item: i },
			});
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
			if (error instanceof NodeOperationError || error instanceof NodeApiError) {
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error -- preserve subclass
				throw error;
			}
			throw new NodeOperationError(
				this.getNode(),
				error instanceof Error ? error.message : String(error),
				{ itemIndex: i },
			);
		}
	}
}
