import type { INodeProperties } from 'n8n-workflow';

import {
	operationPropertiesByResource,
	operationPropertyV1,
	resourceProperty,
} from './operations';
import { sharedFields } from './sharedFields';

export const cervioProperties: INodeProperties[] = [
	resourceProperty,
	...operationPropertiesByResource,
	operationPropertyV1,
	...sharedFields,
];
