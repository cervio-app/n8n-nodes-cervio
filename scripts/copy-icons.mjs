import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function copyTree(srcRoot, distRoot) {
	function walk(dir, rel = '') {
		for (const name of readdirSync(dir)) {
			if (name === '__tests__' || name === 'node_modules') continue;
			const full = join(dir, name);
			const nextRel = rel ? `${rel}/${name}` : name;
			if (statSync(full).isDirectory()) {
				walk(full, nextRel);
				continue;
			}
			if (!/\.(svg|png|json)$/i.test(name)) continue;
			const dest = join(distRoot, nextRel);
			mkdirSync(dirname(dest), { recursive: true });
			copyFileSync(full, dest);
		}
	}
	walk(srcRoot);
}

copyTree(join(root, 'nodes'), join(root, 'dist', 'nodes'));
copyTree(join(root, 'credentials'), join(root, 'dist', 'credentials'));
