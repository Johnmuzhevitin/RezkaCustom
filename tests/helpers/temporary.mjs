import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export async function temporaryDirectory(t, prefix) {
    const base = resolve(tmpdir());
    const directory = await mkdtemp(join(base, prefix));
    t.after(async () => {
        assert.equal(dirname(resolve(directory)), base, 'Cleanup must stay inside the named temporary directory');
        await rm(directory, { recursive: true, force: true });
    });
    return directory;
}
