import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/** Output of one operation for one input item: one object, or several (lists). */
export type ItemResult = IDataObject | IDataObject[];

/** Runs one operation for the input item at `itemIndex`. */
export type OperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
) => Promise<ItemResult>;
