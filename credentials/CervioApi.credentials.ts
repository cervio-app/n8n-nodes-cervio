import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CervioApi implements ICredentialType {
	name = 'cervioApi';

	displayName = 'Cervio API';

	icon: Icon = {
		light: 'file:cervio.mono.light.svg',
		dark: 'file:cervio.mono.dark.svg',
	};

	documentationUrl = 'https://github.com/cervio-app/n8n-nodes-cervio#readme';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://tenant.cervio.app',
			required: true,
			description:
				'Cervio tenant URL without a trailing slash (e.g. https://acme.cervio.app). Required for every credential.',
		},
		{
			displayName: 'Personal Access Token',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'cpat_…',
			description:
				'Token from Admin → API. Recommended: admin:read + admin:write + records:read + records:write (system_admin) for dropdowns, workflows, document generate, and writes.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Accept: 'application/json',
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/me',
		},
	};
}
