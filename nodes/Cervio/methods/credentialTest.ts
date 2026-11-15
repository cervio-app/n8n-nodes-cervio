import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
} from 'n8n-workflow';

import { assertSafeCervioBaseUrl } from '../baseUrl';
import { cervioErrorMessage } from '../GenericFunctions';

/**
 * "Test credential" for Cervio API. It lives on the node (not as a declarative
 * test on the credential) so the Base URL goes through the same safety check as
 * every other request before n8n calls it.
 */
export async function cervioApiCredentialTest(
	this: ICredentialTestFunctions,
	credential: ICredentialsDecrypted,
): Promise<INodeCredentialTestResult> {
	const data = credential.data ?? {};
	let baseUrl: string;
	try {
		baseUrl = assertSafeCervioBaseUrl(String(data.baseUrl ?? ''));
	} catch (error) {
		return { status: 'Error', message: (error as Error).message };
	}
	try {
		// ICredentialTestFunctions exposes only `request` (no httpRequest) in this context.
		// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions
		await this.helpers.request({
			method: 'GET',
			uri: `${baseUrl}/api/v1/me`,
			headers: { Accept: 'application/json', Authorization: `Bearer ${String(data.apiKey ?? '')}` },
			json: true,
		});
		return { status: 'OK', message: 'Connection successful' };
	} catch (error) {
		const status = (error as { statusCode?: number }).statusCode;
		if (status === 401) {
			return {
				status: 'Error',
				message:
					'Cervio rejected the token: check that it is complete, not revoked and not expired.',
			};
		}
		return { status: 'Error', message: cervioErrorMessage(error) ?? (error as Error).message };
	}
}
