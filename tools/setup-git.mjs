import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
if (!existsSync(join(root, '.git'))) git(['init', '--initial-branch=main']);
if (resolve(git(['rev-parse', '--show-toplevel'])) !== resolve(root)) throw new Error('Refusing to configure a different repository.');
let previous = '';
try { previous = git(['config', '--get', 'core.hooksPath']); } catch { /* No effective hook configuration. */ }
if (previous && previous !== '.githooks') throw new Error(`Existing hooks path must be reviewed before replacement: ${previous}`);
if (previous !== '.githooks') git(['config', '--local', 'core.hooksPath', '.githooks']);
console.log('Local Git repository ready; pre-commit runs the offline check. No remote was created.');
