import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const ignoredDirectories = new Set(['.git', 'node_modules']);

function collectJavaScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectJavaScriptFiles(join(directory, entry.name)));
      }

      continue;
    }

    if (entry.isFile() && extname(entry.name) === '.js') {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}

const files = collectJavaScriptFiles(process.cwd());
let hasFailure = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log(`Checked ${files.length} JavaScript files.`);
