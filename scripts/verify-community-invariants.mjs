#!/usr/bin/env node
/**
 * Community-node invariants the official ESLint plugin cannot see after we
 * split description/execute out of Cervio.node.ts (plugin only inspects
 * ObjectExpressions inside *.node.ts). Fail CI if these regress.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import Module from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const stub = {
	NodeConnectionTypes: { Main: 'main' },
	NodeApiError: class NodeApiError extends Error {},
	NodeOperationError: class NodeOperationError extends Error {},
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
	if (request === 'n8n-workflow') return 'n8n-workflow-stub';
	return origResolve.call(this, request, parent, isMain, options);
};
Module._cache['n8n-workflow-stub'] = {
	id: 'n8n-workflow-stub',
	filename: 'n8n-workflow-stub',
	loaded: true,
	exports: stub,
};

const { cervioProperties } = require(
	join(root, 'dist/nodes/Cervio/description/index.js'),
);

function fail(msg) {
	console.error(`INVARIANT FAIL: ${msg}`);
	process.exit(1);
}

// --- description: no open-ended optional JSON fields ---
for (const prop of cervioProperties) {
	if (!prop || typeof prop !== 'object') continue;
	if (prop.type === 'json' && prop.required !== true) {
		fail(
			`open-ended optional JSON field "${prop.name}" — use typed parameters (fixedCollection / collection)`,
		);
	}
}

// --- description: resource + operation grouping (mirrors resource-operation-pattern) ---
const resource = cervioProperties.find((p) => p.name === 'resource');
if (!resource) fail('missing resource property');

const opBlocks = cervioProperties.filter((p) => p.name === 'operation');
if (opBlocks.length < 4) {
	fail(`expected ≥4 operation property blocks (one per resource), got ${opBlocks.length}`);
}

for (const block of opBlocks) {
	if (block.displayOptions?.show?.['@version']) {
		fail('operation block must not use @version (node is version 2 only)');
	}
	const res = block.displayOptions?.show?.resource;
	if (!Array.isArray(res) || res.length === 0) {
		fail('operation block missing displayOptions.show.resource');
	}
}
if (resource.displayOptions?.show?.['@version']) {
	fail('resource must not be gated by @version (node is version 2 only)');
}
// Official plugin: >5 ops is only an error when there is NO resource field.
const anyBlockOverFive = opBlocks.some((b) => (b.options || []).length > 5);
if (anyBlockOverFive && !resource) {
	fail('operation block has >5 options and no resource property');
}

// --- execute sources: every returnData.push({ json }) must include pairedItem ---
const executeDir = join(root, 'nodes/Cervio/execute');
const execFiles = readdirSync(executeDir).filter((f) => f.endsWith('.ts'));
const pushRe = /returnData\.push\(\s*\{([\s\S]*?)\}\s*\)/g;
for (const file of execFiles) {
	const src = readFileSync(join(executeDir, file), 'utf8');
	let m;
	while ((m = pushRe.exec(src))) {
		const body = m[1];
		if (!/\bjson\s*:/.test(body)) continue;
		if (!/\bpairedItem\s*:/.test(body)) {
			fail(`${file}: returnData.push with json but no pairedItem`);
		}
	}
}

console.log('VERIFY COMMUNITY INVARIANTS OK');
