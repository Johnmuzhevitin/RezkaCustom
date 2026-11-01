import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporaryDirectory } from './helpers/temporary.mjs';

test('the real package entry point preserves the archive on test or syntax failure', async t => {
    const directory = await temporaryDirectory(t, 'rezka-gate-');
    for (const folder of ['tools', 'extension', 'tests', 'dist']) await mkdir(join(directory, folder));
    for (const script of ['check.mjs', 'package.mjs']) {
        await copyFile(new URL('../tools/' + script, import.meta.url), join(directory, 'tools', script));
    }
    // Isolate the gate from this project's large upstream input and test suite.
    await writeFile(join(directory, 'tools/build.mjs'), `import { writeFileSync } from 'node:fs';
        writeFileSync(new URL('../rebuilt', import.meta.url), 'yes');`);
    await writeFile(join(directory, 'extension/manifest.json'), '{"version":"1.0.0"}');
    const archive = join(directory, 'dist/rezka-custom-1.0.0.zip');
    await writeFile(archive, 'previous verified archive');
    const run = script => spawnSync(process.execPath, [join(directory, 'tools', script)], { cwd: directory, encoding: 'utf8' });
    const testFile = join(directory, 'tests/example.test.mjs');
    await writeFile(testFile, "import { test } from 'node:test'; test('regression', () => { throw new Error('intentional regression'); });");
    const failedTest = run('package.mjs');
    assert.notEqual(failedTest.status, 0);
    assert.match(failedTest.stdout + failedTest.stderr, /intentional regression/);
    assert.equal(await readFile(join(directory, 'rebuilt'), 'utf8'), 'yes');
    assert.equal(await readFile(archive, 'utf8'), 'previous verified archive');

    await writeFile(testFile, "import { test } from 'node:test'; test('passes', () => {});");
    const script = join(directory, 'extension/broken.js');
    await writeFile(script, 'const invalid = ;');
    const failedSyntax = run('package.mjs');
    assert.notEqual(failedSyntax.status, 0);
    assert.match(failedSyntax.stderr, /SyntaxError/);
    assert.equal(await readFile(archive, 'utf8'), 'previous verified archive');
    await unlink(script);
    const passed = run('check.mjs');
    assert.equal(passed.status, 0, passed.stdout + passed.stderr);
    assert.match(passed.stdout, /Offline checks passed/);
    await unlink(testFile);
    assert.notEqual(run('check.mjs').status, 0, 'An empty suite must not silently pass');
});
