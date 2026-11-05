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

	documentationUrl = 'https://dev.cervio.app/admin/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://dev.cervio.app',
			placeholder: 'https://tenant.cervio.app',
			required: true,
			description:
				'URL dell’istanza Cervio, senza slash finale. Ogni tenant ha il proprio dominio.',
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
				'Token creato in Admin → API. Consigliato: admin:read + admin:write + records:read + records:write (system_admin) per tendine, workflow, generate documento e scritture.',
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
