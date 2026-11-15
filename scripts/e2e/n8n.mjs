/**
 * Local n8n in Docker with the packed node installed as a community package,
 * as a user would install it from npm. Workflows run with `n8n execute`.
 */
import { execFileSync } from 'node:child_process';

const OWNER = { email: 'e2e-owner@example.com', password: 'E2e-Local-Passw0rd!' };
const NODE_TYPE = '@cervio/n8n-nodes-cervio.cervio';

function docker(args, opts = {}) {
	return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 1 << 26, ...opts });
}

/** Docker command whose failure is fine (removing something that is not there). */
function dockerQuiet(args) {
	try {
		docker(args, { stdio: 'ignore' });
	} catch {
		/* nothing to remove */
	}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function n8nInstance(config) {
	const { image, container, port, network, caFile, proxy } = config;
	const volume = `${container}-data`;
	const base = `http://localhost:${port}`;
	let cookie = '';

	function runArgs() {
		const env = {
			N8N_PORT: String(port),
			N8N_LISTEN_ADDRESS: '0.0.0.0',
			N8N_DIAGNOSTICS_ENABLED: 'false',
			N8N_PERSONALIZATION_ENABLED: 'false',
			N8N_SECURE_COOKIE: 'false',
			N8N_COMMUNITY_PACKAGES_ENABLED: 'true',
			GENERIC_TIMEZONE: 'Europe/Rome',
			...(proxy ? { HTTPS_PROXY: proxy, HTTP_PROXY: proxy, NO_PROXY: 'localhost,127.0.0.1' } : {}),
			...(caFile ? { NODE_EXTRA_CA_CERTS: '/e2e/ca.crt' } : {}),
		};
		return [
			...(network === 'host' ? ['--network', 'host'] : ['-p', `${port}:${port}`]),
			...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
			...(caFile ? ['-v', `${caFile}:/e2e/ca.crt:ro`] : []),
			'-v',
			`${volume}:/home/node/.n8n`,
		];
	}

	async function request(method, path, body) {
		const res = await fetch(`${base}/rest${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', Cookie: cookie, 'browser-id': 'cervio-e2e' },
			body: body ? JSON.stringify(body) : undefined,
		});
		const text = await res.text();
		const json = text ? JSON.parse(text) : {};
		if (!res.ok) throw new Error(`n8n ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
		if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
		return json.data ?? json;
	}

	return {
		nodeType: NODE_TYPE,
		owner: OWNER,
		url: base,

		/** Fresh volume, package installed, n8n started, owner created and signed in. */
		async start(tarball) {
			try {
				docker(['info'], { stdio: 'ignore' });
			} catch {
				throw new Error('Docker is not available: start Docker and run again.');
			}
			dockerQuiet(['rm', '-f', container]);
			dockerQuiet(['volume', 'rm', '-f', volume]);
			docker([
				'run',
				'--rm',
				...runArgs(),
				'-v',
				`${tarball}:/e2e/pkg.tgz:ro`,
				'--entrypoint',
				'sh',
				image,
				'-c',
				'mkdir -p /home/node/.n8n/nodes && cd /home/node/.n8n/nodes && echo \'{"name":"installed-nodes","private":true}\' > package.json && npm install --no-audit --no-fund /e2e/pkg.tgz >/dev/null',
			]);
			docker(['run', '-d', '--name', container, ...runArgs(), image]);
			for (let i = 0; i < 90; i++) {
				try {
					if ((await fetch(`${base}/healthz`)).ok) break;
				} catch {
					/* starting */
				}
				await sleep(2000);
			}
			for (let i = 0; i < 30; i++) {
				try {
					await request('POST', '/owner/setup', { ...OWNER, firstName: 'E2E', lastName: 'Owner' });
					break;
				} catch (error) {
					if (i === 29) throw error;
					await sleep(2000);
				}
			}
			await request('POST', '/login', {
				emailOrLdapLoginId: OWNER.email,
				password: OWNER.password,
			});
		},

		stop() {
			dockerQuiet(['rm', '-f', container]);
		},

		request,

		async createCredential(baseUrl, token) {
			const cred = await request('POST', '/credentials', {
				name: 'Cervio (e2e)',
				type: 'cervioApi',
				data: { baseUrl, apiKey: token },
			});
			return { id: cred.id, name: cred.name };
		},

		testCredential: (credential, data) =>
			request('POST', '/credentials/test', {
				credentials: { id: credential.id, name: credential.name, type: 'cervioApi', data },
			}),

		/** A dropdown of the node, as the editor loads it. */
		loadOptions: (credential, methodName, parameters) =>
			request('POST', '/dynamic-node-parameters/options', {
				nodeTypeAndVersion: { name: NODE_TYPE, version: 2 },
				path: 'parameters.x',
				methodName,
				currentNodeParameters: parameters,
				credentials: { cervioApi: credential },
			}),

		mapperFields: async (credential, methodName, parameters) =>
			(
				await request('POST', '/dynamic-node-parameters/resource-mapper-fields', {
					nodeTypeAndVersion: { name: NODE_TYPE, version: 2 },
					path: 'parameters.fields',
					methodName,
					currentNodeParameters: parameters,
					credentials: { cervioApi: credential },
				})
			).fields,

		/**
		 * Saves a linear workflow (nodes run in order) and executes it.
		 * Returns each node's output items, or its error.
		 */
		async run(name, nodes) {
			const connections = {};
			nodes.forEach((n, i) => {
				n.id ??= `n${i}`;
				n.position ??= [i * 240, 0];
				n.typeVersion ??= n.type === NODE_TYPE ? 2 : 1;
				if (i > 0)
					connections[nodes[i - 1].name] = { main: [[{ node: n.name, type: 'main', index: 0 }]] };
			});
			const wf = await request('POST', '/workflows', {
				name,
				nodes,
				connections,
				settings: { executionOrder: 'v1' },
				active: false,
			});
			let out;
			try {
				out = docker([
					'exec',
					'-e',
					'N8N_RUNNERS_BROKER_PORT=5690',
					'-e',
					`N8N_PORT=${port + 1}`,
					container,
					'n8n',
					'execute',
					'--id',
					wf.id,
					'--rawOutput',
				]);
			} catch (error) {
				out = String(error.stdout ?? '');
			}
			const body = out.slice(out.indexOf('{'));
			const run = JSON.parse(body.slice(0, body.lastIndexOf('}') + 1));
			const runData = (run.data ?? run).resultData.runData;
			const result = { workflowId: wf.id, nodes: {} };
			for (const [nodeName, runs] of Object.entries(runData)) {
				const r = runs[0];
				result.nodes[nodeName] = {
					items: (r.data?.main?.[0] ?? []).map((i) => ({ json: i.json, item: i.pairedItem?.item })),
					error: r.error ? r.error.message : undefined,
				};
			}
			return result;
		},
	};
}
