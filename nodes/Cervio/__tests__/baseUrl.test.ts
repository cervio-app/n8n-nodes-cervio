import { describe, expect, it } from 'vitest';

import { assertSafeCervioBaseUrl, normalizeBaseUrl } from '../baseUrl';

describe('normalizeBaseUrl', () => {
	it('trims and strips trailing slashes', () => {
		expect(normalizeBaseUrl(' https://acme.cervio.app/ ')).toBe(
			'https://acme.cervio.app',
		);
	});
});

describe('assertSafeCervioBaseUrl', () => {
	it('accepts https tenant hosts', () => {
		expect(assertSafeCervioBaseUrl('https://acme.cervio.app')).toBe(
			'https://acme.cervio.app',
		);
	});

	it('accepts http for on-prem / local smoke', () => {
		expect(assertSafeCervioBaseUrl('http://127.0.0.1:3000')).toBe(
			'http://127.0.0.1:3000',
		);
	});

	it('rejects empty / invalid URLs', () => {
		expect(() => assertSafeCervioBaseUrl('')).toThrow(/missing/i);
		expect(() => assertSafeCervioBaseUrl('not-a-url')).toThrow(/valid absolute URL/i);
	});

	it('rejects non-http(s) schemes and embedded credentials', () => {
		expect(() => assertSafeCervioBaseUrl('file:///etc/passwd')).toThrow(/http or https/i);
		expect(() =>
			assertSafeCervioBaseUrl('https://user:pass@acme.cervio.app'),
		).toThrow(/must not include credentials/i);
	});

	it('rejects cloud-metadata / link-local targets', () => {
		expect(() => assertSafeCervioBaseUrl('http://169.254.169.254/latest')).toThrow(
			/link-local|cloud-metadata/i,
		);
		expect(() =>
			assertSafeCervioBaseUrl('http://metadata.google.internal/computeMetadata/v1'),
		).toThrow(/not allowed/i);
	});
});
