/* eslint-disable @n8n/community-nodes/require-node-api-error -- pure URL validation without an INode */
/**
 * Validate Cervio credential Base URL before any HTTP call.
 * Blocks cloud-metadata / link-local targets that would turn a misconfigured
 * PAT into an SSRF foothold. Private RFC1918 hosts stay allowed for on-prem.
 */

const BLOCKED_HOSTNAMES = new Set([
	'metadata.google.internal',
	'metadata',
	'metadata.azure.com',
	'instance-data',
]);

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/, '');
}

export function assertSafeCervioBaseUrl(raw: string): string {
	const normalized = normalizeBaseUrl(raw);
	if (!normalized) {
		throw new Error('Cervio credential Base URL is missing');
	}

	let url: URL;
	try {
		url = new URL(normalized);
	} catch {
		throw new Error(
			`Cervio Base URL is not a valid absolute URL: ${JSON.stringify(raw)}`,
		);
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error(
			`Cervio Base URL must use http or https (got ${url.protocol})`,
		);
	}

	if (url.username || url.password) {
		throw new Error('Cervio Base URL must not include credentials');
	}

	const hostname = url.hostname.toLowerCase();
	if (!hostname) {
		throw new Error('Cervio Base URL is missing a hostname');
	}

	if (BLOCKED_HOSTNAMES.has(hostname)) {
		throw new Error(`Cervio Base URL host is not allowed: ${hostname}`);
	}

	if (isLinkLocalOrMetadataIp(hostname)) {
		throw new Error(
			`Cervio Base URL must not target link-local / cloud-metadata addresses (${hostname})`,
		);
	}

	return normalized;
}

function isLinkLocalOrMetadataIp(hostname: string): boolean {
	// IPv6 link-local / unique-local metadata-ish
	if (hostname === '::1' || hostname.startsWith('fe80:')) return true;

	const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!ipv4) return false;
	const parts = ipv4.slice(1).map((p) => Number(p));
	if (parts.some((n) => n > 255)) return true;

	const [a, b] = parts;
	// 169.254.0.0/16 link-local (incl. AWS/GCP metadata 169.254.169.254)
	if (a === 169 && b === 254) return true;
	return false;
}
