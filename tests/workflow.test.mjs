import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporaryDirectory } from './helpers/temporary.mjs';

test('the configured Git hook runs the check and propagates its failure', async t => {
    const root = await temporaryDirectory(t, 'rezka-hook-');
    for (const folder of ['.githooks', 'tools']) await mkdir(join(root, folder));
    await copyFile(new URL('../.githooks/pre-commit', import.meta.url), join(root, '.githooks/pre-commit'));
    const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(git(['init', '--quiet']).status, 0);
    const run = () => git(['-c', 'core.hooksPath=.githooks', 'hook', 'run', 'pre-commit']);
    await writeFile(join(root, 'tools/check.mjs'), 'process.exit(7);');
    const failed = run();
    assert.equal(failed.status, 7, failed.stdout + failed.stderr);
    await writeFile(join(root, 'tools/check.mjs'), 'console.log("fixture check passed");');
    const passed = run();
    assert.equal(passed.status, 0, passed.stderr);
    assert.match(passed.stdout + passed.stderr, /fixture check passed/);
});
