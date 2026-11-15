/**
 * The node definition is data, so mistakes in it do not fail to compile: an
 * operation without a handler, a dropdown pointing at a missing method, a
 * parameter shown for an operation that does not exist. These tests catch them.
 */
import { describe, expect, it } from 'vitest';
import type { INodeProperties } from 'n8n-workflow';

import { CervioApi } from '../../../credentials/CervioApi.credentials';
import { Cervio } from '../Cervio.node';
import { OPERATIONS } from '../execute';
import { OPERATION_RESOURCE } from '../resourceMap';

const node = new Cervio();
const { properties } = node.description;

const operationProps = properties.filter((p) => p.name === 'operation');
const declared = operationProps.flatMap((p) =>
	(p.options as Array<{ value: string }>).map((o) => ({
		operation: o.value,
		resource: (p.displayOptions?.show?.resource as string[])[0],
	})),
);

function walk(props: INodeProperties[], visit: (p: INodeProperties) => void): void {
	for (const p of props) {
		visit(p);
		const nested = (p.options ?? []) as Array<INodeProperties & { values?: INodeProperties[] }>;
		if (p.type === 'collection') walk(nested, visit);
		if (p.type === 'fixedCollection')
			walk(
				nested.flatMap((o) => o.values ?? []),
				visit,
			);
	}
}

describe('node definition', () => {
	it('declares each operation once, under the resource the runtime maps it to', () => {
		expect(declared.map((d) => d.operation).sort()).toEqual(Object.keys(OPERATION_RESOURCE).sort());
		for (const { operation, resource } of declared) {
			expect(OPERATION_RESOURCE[operation], operation).toBe(resource);
		}
	});

	it('has a handler for every declared operation, and no handler without an operation', () => {
		expect(Object.keys(OPERATIONS).sort()).toEqual(declared.map((d) => d.operation).sort());
	});

	it('shows parameters only for operations that exist', () => {
		const known = new Set(declared.map((d) => d.operation));
		for (const p of properties) {
			for (const key of ['show', 'hide'] as const) {
				for (const op of (p.displayOptions?.[key]?.operation as string[] | undefined) ?? []) {
					expect(known.has(op), `${p.name} → ${op}`).toBe(true);
				}
			}
		}
	});

	it('points every dropdown and field mapper at an existing method', () => {
		const loadOptions: Record<string, unknown> = node.methods.loadOptions;
		const resourceMapping: Record<string, unknown> = node.methods.resourceMapping;
		walk(properties, (p) => {
			const { loadOptionsMethod, resourceMapper } = p.typeOptions ?? {};
			if (loadOptionsMethod) {
				expect(loadOptions[loadOptionsMethod], loadOptionsMethod).toBeTypeOf('function');
			}
			if (resourceMapper?.resourceMapperMethod) {
				const method = resourceMapper.resourceMapperMethod;
				expect(resourceMapping[method], method).toBeTypeOf('function');
			}
		});
	});

	it('gives every visible parameter a description or an obvious meaning', () => {
		walk(properties, (p) => {
			expect(p.displayName, p.name).toMatch(/^[A-Z0-9]/);
			if (p.description)
				expect(p.description, p.name).not.toMatch(/\bslugs?\b|write-schema|UUID\[\]/);
		});
	});

	it('is a version 2 node, usable as an AI tool, tested through its own credential test', () => {
		expect(node.description.version).toBe(2);
		expect(node.description.usableAsTool).toBe(true);
		expect(node.description.credentials).toEqual([
			{ name: 'cervioApi', required: true, testedBy: 'cervioApiCredentialTest' },
		]);
		expect(node.methods.credentialTest.cervioApiCredentialTest).toBeTypeOf('function');
	});

	it('runs through executeCervio', async () => {
		const ctx = {
			getInputData: () => [],
			getNodeParameter: (name: string) => (name === 'operation' ? 'get' : 'record'),
			getNode: () => ({ name: 'Cervio' }),
		};
		expect(await node.execute.call(ctx as never)).toEqual([[]]);
	});
});

describe('Cervio API credential', () => {
	const credential = new CervioApi();

	it('sends the token as a Bearer header', () => {
		expect(credential.authenticate).toEqual({
			type: 'generic',
			properties: {
				headers: { Accept: 'application/json', Authorization: '=Bearer {{$credentials.apiKey}}' },
			},
		});
	});

	it('asks for a Base URL and a secret token, without its own unchecked test', () => {
		expect(credential.properties.map((p) => [p.name, p.required, p.typeOptions?.password])).toEqual(
			[
				['baseUrl', true, undefined],
				['apiKey', true, true],
			],
		);
		expect((credential as { test?: unknown }).test).toBeUndefined();
	});
});
