/** Tiny test recorder: each check has an id, a title and what to look at in Cervio. */
export function createSuite() {
	const results = [];
	return {
		results,
		async test(id, title, onCervio, fn) {
			const started = Date.now();
			try {
				const detail = (await fn()) ?? '';
				results.push({
					id,
					title,
					onCervio,
					ok: true,
					detail: String(detail),
					ms: Date.now() - started,
				});
			} catch (error) {
				results.push({
					id,
					title,
					onCervio,
					ok: false,
					detail: error.message,
					ms: Date.now() - started,
				});
			}
			const last = results.at(-1);
			console.log(
				`${last.ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${last.ok ? '' : `\n      ${last.detail}`}`,
			);
		},
	};
}

export function check(condition, message) {
	if (!condition) throw new Error(message);
}

export function equal(actual, expected, what) {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

/** The output items of a node in a run, or a clear error when the node failed. */
export function output(run, nodeName) {
	const node = run.nodes[nodeName];
	if (!node) throw new Error(`node "${nodeName}" did not run`);
	if (node.error) throw new Error(`node "${nodeName}" failed: ${node.error}`);
	return node.items;
}
