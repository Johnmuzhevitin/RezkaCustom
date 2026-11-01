import { test } from 'node:test';
import assert from 'node:assert/strict';
import { silentWave, fulfillMedia } from './helpers/media.mjs';

test('media fixture serves seekable ranges, exact lengths and rejects out-of-range requests', async () => {
    const media = silentWave(120);
    assert.equal(media.readUInt32LE(24), 8000);
    assert.equal(media.readUInt32LE(40), 120 * 8000 * 2);
    const fetch = async range => {
        let response;
        await fulfillMedia({ request: () => ({ headers: () => range ? { range } : {} }), fulfill: value => { response = value; } }, media);
        return response;
    };
    const first = await fetch(); assert.equal(first.status, 200); assert.equal(first.headers['Accept-Ranges'], 'bytes');
    for (const range of ['bytes=0-43', 'bytes=1000-', 'bytes=1000-1099']) {
        const response = await fetch(range);
        assert.equal(response.status, 206);
        assert.equal(Number(response.headers['Content-Length']), response.body.length);
        assert.match(response.headers['Content-Range'], /^bytes \d+-\d+\/1920044$/);
    }
    assert.equal((await fetch('bytes=9999999-')).status, 416);
    assert.equal((await fetch('bytes=100-50')).status, 416);
});
