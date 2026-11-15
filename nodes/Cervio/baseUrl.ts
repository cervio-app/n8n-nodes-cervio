/* eslint-disable @n8n/community-nodes/require-node-api-error -- pure URL validation without an INode */
/**
 * Validate Cervio credential Base URL before any HTTP call.
 * Blocks cloud-metadata / link-local targets that would turn a misconfigured
 * PAT into an SSRF foothold. Private (RFC 1918) and loopback hosts stay allowed
 * for on-premises and local installs.
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
		throw new Error(`Cervio Base URL is not a valid absolute URL: ${JSON.stringify(raw)}`);
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error(`Cervio Base URL must use http or https (got ${url.protocol})`);
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

/** IPv4 dotted quad → its four numbers, or undefined. WHATWG URL already turns decimal/hex hosts into dotted form. */
function ipv4Parts(host: string): number[] | undefined {
	const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	return m ? m.slice(1).map(Number) : undefined;
}

/** 169.254.0.0/16: link-local, including the AWS/GCP/Azure metadata address 169.254.169.254. */
function isLinkLocalIpv4(parts: number[]): boolean {
	return parts[0] === 169 && parts[1] === 254;
}

/**
 * IPv6 literal (URL hostnames keep the brackets, e.g. `[fe80::1]`). Blocks
 * link-local fe80::/10, the AWS metadata address fd00:ec2::254, and IPv4-mapped
 * addresses (`::ffff:169.254.169.254`, normalised by URL to `::ffff:a9fe:a9fe`).
 */
function isLinkLocalOrMetadataIpv6(host: string): boolean {
	if (/^fe[89ab][0-9a-f]:/.test(host)) return true;
	if (host === 'fd00:ec2::254') return true;
	const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
	if (mapped) {
		const [hi, lo] = [parseInt(mapped[1], 16), parseInt(mapped[2], 16)];
		return isLinkLocalIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
	}
	return false;
}

function isLinkLocalOrMetadataIp(hostname: string): boolean {
	if (hostname.startsWith('[') && hostname.endsWith(']')) {
		return isLinkLocalOrMetadataIpv6(hostname.slice(1, -1));
	}
	const parts = ipv4Parts(hostname);
	return parts ? isLinkLocalIpv4(parts) : false;
}
