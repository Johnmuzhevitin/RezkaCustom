import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function checkScripts(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) checkScripts(file);
        else if (entry.isFile() && entry.name.endsWith('.js')) new vm.Script(readFileSync(file, 'utf8'), { filename: file });
    }
}
checkScripts(join(root, 'extension'));
const tests = readdirSync(join(root, 'tests')).filter(file => file.endsWith('.test.mjs')).sort();
if (!tests.length) throw new Error('No offline tests found; refusing to certify this build.');
// A caller running under node:test must still start an independent test runner.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
execFileSync(process.execPath, ['--test', ...tests.map(file => join(root, 'tests', file))], { cwd: root, stdio: 'inherit', env });
console.log('Offline checks passed. No browser was launched.');
