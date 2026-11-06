/**
 * Shared env helpers for live smoke scripts (not used by CI).
 * No lab/tenant UUIDs live in the repo — pass them via environment.
 */

export function requireEnv(name) {
	const v = (process.env[name] || '').trim();
	if (!v) {
		console.error(`Set ${name}=… (see .env.example)`);
		process.exit(1);
	}
	return v;
}

/** Returns trimmed value or empty string when unset. */
export function optionalEnv(name) {
	return (process.env[name] || '').trim();
}

/**
 * Build a map of required env keys → values.
 * Exits with a single message listing every missing key.
 */
export function requireEnvs(keys) {
	const missing = [];
	const out = {};
	for (const key of keys) {
		const v = (process.env[key] || '').trim();
		if (!v) missing.push(key);
		else out[key] = v;
	}
	if (missing.length) {
		console.error(
			`Missing required env for this smoke script:\n  ${missing.join('\n  ')}\nSee .env.example`,
		);
		process.exit(1);
	}
	return out;
}
