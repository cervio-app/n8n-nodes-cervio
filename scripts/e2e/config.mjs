/**
 * End-to-end test configuration, from environment variables only: no tenant
 * address or token is ever stored in the repository.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function n8nImageFromCompose() {
	const compose = readFileSync(join(ROOT, 'compose.yaml'), 'utf8');
	return compose.match(/image:\s*(n8nio\/n8n:[^\s]+)/)?.[1] ?? 'n8nio/n8n:latest';
}

export function loadConfig() {
	const baseUrl = (process.env.CERVIO_E2E_BASE_URL ?? '').trim().replace(/\/+$/, '');
	const token = (process.env.CERVIO_E2E_TOKEN ?? '').trim();
	const missing = [];
	if (!baseUrl) missing.push('CERVIO_E2E_BASE_URL');
	if (!token) missing.push('CERVIO_E2E_TOKEN');
	if (missing.length > 0) {
		throw new Error(
			`Set ${missing.join(' and ')} (see docs/e2e.md). Use a test tenant: the run creates data there.`,
		);
	}
	const caFile = process.env.NODE_EXTRA_CA_CERTS;
	return {
		baseUrl,
		token,
		n8n: {
			image: process.env.N8N_E2E_IMAGE ?? n8nImageFromCompose(),
			container: process.env.N8N_E2E_CONTAINER ?? 'n8n-cervio-e2e',
			port: Number(process.env.N8N_E2E_PORT ?? 5678),
			// "host" when the container must reach a proxy or a tenant on localhost.
			network: process.env.N8N_E2E_DOCKER_NETWORK ?? 'bridge',
			caFile: caFile && existsSync(caFile) ? caFile : undefined,
			proxy: process.env.HTTPS_PROXY ?? process.env.https_proxy,
		},
		reportDir: join(ROOT, 'e2e-report'),
	};
}
