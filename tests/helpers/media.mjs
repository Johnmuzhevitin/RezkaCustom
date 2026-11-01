import { expect } from '@playwright/test';

// A genuine media resource, played by HTMLVideoElement, with deterministic length.
// Silence keeps the test unobtrusive; no synthetic time/progress events are injected.
export function silentWave(seconds = 120) {
    const rate = 8000, size = seconds * rate * 2, data = Buffer.alloc(44 + size);
    data.write('RIFF'); data.writeUInt32LE(36 + size, 4); data.write('WAVEfmt ', 8);
    data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
    data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
    data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
    data.write('data', 36); data.writeUInt32LE(size, 40); return data;
}

// HTTP range responses are required for real Chromium seeking.
export function fulfillMedia(route, media) {
    const header = route.request().headers().range;
    const range = header?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1;
    if ((header && !range) || start >= media.length || end < start) {
        return route.fulfill({ status: 416, headers: { 'Content-Range': `bytes */${media.length}` }, body: '' });
    }
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: media.subarray(start, end + 1),
        headers: { 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1),
            ...(range ? { 'Content-Range': `bytes ${start}-${end}/${media.length}` } : {}) } });
}

// Assert the media precondition before spending 30 seconds testing the tracker.
export async function seekMedia(video, seconds) {
    await video.evaluate((element, seconds) => { element.currentTime = seconds; }, seconds);
    await expect.poll(() => video.evaluate(element => element.seeking)).toBe(false);
    await expect.poll(() => video.evaluate((element, target) => Math.abs(element.currentTime - target), seconds)).toBeLessThan(1);
}
