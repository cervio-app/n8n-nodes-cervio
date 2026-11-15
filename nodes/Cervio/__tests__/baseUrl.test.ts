import { describe, expect, it } from 'vitest';

import { assertSafeCervioBaseUrl, normalizeBaseUrl } from '../baseUrl';

describe('normalizeBaseUrl', () => {
	it('trims and strips trailing slashes', () => {
		expect(normalizeBaseUrl(' https://acme.cervio.app/ ')).toBe('https://acme.cervio.app');
	});
});

describe('assertSafeCervioBaseUrl', () => {
	it('accepts https tenant hosts', () => {
		expect(assertSafeCervioBaseUrl('https://acme.cervio.app')).toBe('https://acme.cervio.app');
	});

	it('accepts http for on-prem / local smoke', () => {
		expect(assertSafeCervioBaseUrl('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
	});

	it('rejects empty / invalid URLs', () => {
		expect(() => assertSafeCervioBaseUrl('')).toThrow(/missing/i);
		expect(() => assertSafeCervioBaseUrl('not-a-url')).toThrow(/valid absolute URL/i);
	});

	it('rejects non-http(s) schemes and embedded credentials', () => {
		expect(() => assertSafeCervioBaseUrl('file:///etc/passwd')).toThrow(/http or https/i);
		expect(() => assertSafeCervioBaseUrl('https://user:pass@acme.cervio.app')).toThrow(
			/must not include credentials/i,
		);
	});

	it('rejects cloud-metadata / link-local targets', () => {
		expect(() => assertSafeCervioBaseUrl('http://169.254.169.254/latest')).toThrow(
			/link-local|cloud-metadata/i,
		);
		expect(() =>
			assertSafeCervioBaseUrl('http://metadata.google.internal/computeMetadata/v1'),
		).toThrow(/not allowed/i);
	});

	it.each([
		'http://[fe80::1]',
		'http://[febf::abcd]',
		'http://[fd00:ec2::254]',
		'http://[::ffff:169.254.169.254]',
		'http://2852039166',
		'http://0xa9fea9fe',
	])('rejects IPv6 and encoded forms of link-local / metadata: %s', (url) => {
		expect(() => assertSafeCervioBaseUrl(url)).toThrow(/link-local|cloud-metadata/i);
	});

	it.each(['http://[::1]:3000', 'http://[fec0::1]', 'http://[::ffff:10.0.0.1]', 'http://10.0.0.5'])(
		'keeps loopback and private addresses usable for on-prem: %s',
		(url) => {
			expect(assertSafeCervioBaseUrl(url)).toBe(url);
		},
	);
});
