#!/usr/bin/env node
/**
 * End-to-end test of the packed node in a local n8n against a Cervio tenant.
 *
 *   npm run e2e                      run all cases; test data stays in Cervio to inspect
 *   npm run e2e -- --cleanup <run>   remove the data of a previous run
 *   npm run e2e -- --stop            also stop the local n8n at the end
 *
 * Configuration and the list of cases: docs/e2e.md.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runCases } from './cases.mjs';
import { cervioClient } from './cervio.mjs';
import { ROOT, loadConfig } from './config.mjs';
import { createFixture, removeFixture } from './fixture.mjs';
import { createSuite } from './harness.mjs';
import { n8nInstance } from './n8n.mjs';

const args = process.argv.slice(2);
const config = loadConfig();
const cervio = cervioClient(config);

if (args[0] === '--cleanup') {
	const runId = args[1];
	if (!runId) throw new Error('Usage: npm run e2e -- --cleanup <run id>');
	const report = JSON.parse(readFileSync(join(config.reportDir, `${runId}.json`), 'utf8'));
	const removed = await removeFixture(cervio, report.fixture);
	console.log(
		`Run ${runId}: records removed, ${removed.length} entities and the workflow deactivated.`,
	);
	process.exit(0);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const runId = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-${Math.random().toString(36).slice(2, 6)}`;
console.log(`Cervio n8n node e2e — run ${runId} on ${config.baseUrl}\n`);

console.log('1/4 Build and pack the node');
execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' });
const packed = execFileSync('npm', ['pack', '--silent', '--pack-destination', '/tmp'], {
	cwd: ROOT,
	encoding: 'utf8',
})
	.trim()
	.split('\n')
	.pop();
const tarball = join('/tmp', packed);

console.log(`2/4 Start n8n (${config.n8n.image}) with the package installed`);
const n8n = n8nInstance(config.n8n);
await n8n.start(tarball);
const credential = await n8n.createCredential(config.baseUrl, config.token);
const owner = await cervio.me();

console.log('3/4 Create test data in Cervio');
const fx = await createFixture(cervio, runId, owner.user_id);

console.log('4/4 Run the cases\n');
const suite = createSuite();
try {
	await runCases({ suite, n8n, cervio, credential, fx, config, owner });
} catch (error) {
	suite.results.push({
		id: '!',
		title: 'Run stopped',
		onCervio: '-',
		ok: false,
		detail: error.stack ?? error.message,
	});
	console.error(error);
}

const failed = suite.results.filter((r) => !r.ok);
mkdirSync(config.reportDir, { recursive: true });
const md = [
	`# Cervio n8n node e2e — run ${runId}`,
	'',
	`Tenant: ${config.baseUrl} · n8n: ${config.n8n.image} · ${suite.results.length - failed.length}/${suite.results.length} passed`,
	'',
	`Test data in Cervio: entities named **n8n e2e ${runId} …** (People, Companies, Projects, Assignments), workflow **n8n e2e ${runId} Set status**, template **n8n e2e ${runId} Badge**.`,
	'',
	'| ID | Check | Result | What to look at in Cervio | Detail |',
	'|----|-------|--------|---------------------------|--------|',
	...suite.results.map(
		(r) =>
			`| ${r.id} | ${r.title} | ${r.ok ? 'PASS' : '**FAIL**'} | ${r.onCervio} | ${String(r.detail).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 160)} |`,
	),
	'',
	`Remove the data: \`npm run e2e -- --cleanup ${runId}\``,
].join('\n');
writeFileSync(join(config.reportDir, `${runId}.md`), `${md}\n`);
writeFileSync(
	join(config.reportDir, `${runId}.json`),
	JSON.stringify({ runId, baseUrl: config.baseUrl, fixture: fx, results: suite.results }, null, 2),
);

console.log(
	`\n${suite.results.length - failed.length}/${suite.results.length} passed. Report: e2e-report/${runId}.md`,
);
console.log(`Test data kept in Cervio. Remove it with: npm run e2e -- --cleanup ${runId}`);
if (args.includes('--stop')) n8n.stop();
else console.log(`Local n8n: ${n8n.url} (${n8n.owner.email} / ${n8n.owner.password})`);
process.exit(failed.length > 0 ? 1 : 0);
