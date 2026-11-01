import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

// Hash the shipped bytes, not timestamps. Exclude the output to avoid recursion.
export async function describeBuild(directory) {
    const files = [];
    async function walk(path) {
        for (const entry of await readdir(path, { withFileTypes: true })) {
            const file = join(path, entry.name);
            if (entry.isDirectory()) await walk(file);
            else if (entry.isFile() && relative(directory, file) !== 'build-info.js') files.push(file);
            else if (entry.isSymbolicLink()) throw new Error('Build inputs must not be symbolic links: ' + file);
        }
    }
    await walk(directory);
    const hash = createHash('sha256');
    for (const file of files.sort()) {
        const bytes = await readFile(file);
        hash.update(relative(directory, file).replaceAll('\\', '/') + '\0' + bytes.length + '\0');
        hash.update(bytes);
    }
    const { version } = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    return { version, id: hash.digest('hex') };
}

export async function writeBuildInfo(directory) {
    const build = await describeBuild(directory);
    await writeFile(join(directory, 'build-info.js'),
        '// Generated last by tools/build.mjs from all other shipped files.\n'
        + 'const REZKA_BUILD = Object.freeze(' + JSON.stringify(build) + ');\n');
    return build;
}
