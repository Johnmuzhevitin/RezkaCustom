import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const origin = 'https://rezka.fi';
const read = file => readFileSync(new URL('../extension/' + file, import.meta.url), 'utf8');
const rule = (field, op, values) => ({ kind: 'rule', field, op, values });
const group = (children, mode = 'all', not = false) => ({ kind: 'group', children, mode, not });
const url = id => `${origin}/cartoons/fiction/${id}-title.html`;
// Reduced from the observed title table: genre, ratings and release exist, country does not.
// Synthetic title/IDs; no account markup is retained.
const partial = `<h1 itemprop="name">Test animation</h1><table class="b-post__info">
<tr><td><h2>Рейтинги</h2>:</td><td><span class="b-post__info_rates imdb"><span>9.1</span><i>(2 572)</i></span></td></tr>
<tr><td><h2>Дата выхода</h2>:</td><td>26 марта <a href="/year/2018/">2018 года</a></td></tr>
<tr><td><h2>Жанр</h2>:</td><td><a href="/cartoons/fiction/"><span itemprop="genre">Фантастика</span></a></td></tr></table>`;
const full = partial.replace('</table>', '<tr><td>Страна:</td><td>США</td></tr></table>');
const listing = `<div class="b-content__inline_items">${[1, 2, 3].map(id => `<div class="b-content__inline_item"><div class="b-content__inline_item-link"><a href="${url(id)}">Test ${id}</a><div>2018, Фантастика</div></div></div>`).join('')}</div>`;
function environment(t) {
    const dom = new JSDOM('', { url: origin, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    dom.window.eval(read('search-rules.js') + '\n' + read('search-core.js') + '\nglobalThis.S = RezkaSearch;');
    return { S: dom.window.S, w: dom.window };
}

test('a real title with no country retains usable genres and leaves country predicates unknown', t => {
    const { S } = environment(t), item = S.parseList(listing, origin).items[0];
    const data = S.parseDetails(partial, item.url);
    assert.equal(data.countriesComplete, false); assert.equal(data.genresComplete, true);
    assert.equal(data.ratings.imdb, 9.1); assert.equal(data.year, 2018);
    const matches = advanced => S.matches(item, S.normalize({ advanced }), {}, data);
    assert.equal(matches(group([rule('genre', 'any', ['fiction'])])), true);
    for (const op of ['any', 'all', 'none']) {
        assert.equal(matches(group([rule('country', op, ['Россия'])])), false);
        assert.equal(matches(group([rule('country', op, ['Россия'])], 'all', true)), false);
    }
    assert.equal(matches(group([rule('country', 'any', ['Фантастика'])])), false, 'a genre in a country-less card is not a country');
    assert.equal(matches(group([rule('country', 'none', ['Россия']), rule('genre', 'any', ['fiction'])], 'any')), true);
});

test('partial details do not stop scanning or enter results through exclusions, including after cache reload', async t => {
    const first = environment(t); let reads = 0;
    const state = { advanced: group([rule('country', 'none', ['Россия']), rule('genre', 'none', ['multseries'])]) };
    const fetch = async target => {
        if (!target.endsWith('.html')) return listing;
        reads++;
        return target === url(1) ? partial.replace('/cartoons/fiction/', '/cartoons/multseries/') : target === url(2) ? partial : full;
    };
    const check = async S => {
        const search = new S.Search(state, origin, fetch);
        await search.load();
        assert.equal(search.scanned, 3); assert.equal(search.done, true); assert.equal(search.unknown, 1);
        assert.deepEqual(Array.from(search.items, item => item.id), ['3']);
    };
    await check(first.S); await check(first.S); assert.equal(reads, 3);
    const second = environment(t);
    for (const key of Object.keys(first.w.sessionStorage)) second.w.sessionStorage.setItem(key, first.w.sessionStorage.getItem(key));
    await check(second.S); assert.equal(reads, 3, 'partial completeness must survive tab-cache reuse');
});

test('missing or empty genre/country fields cannot prove exclusion and malformed pages still fail', t => {
    const { S } = environment(t), item = S.parseList(listing, origin).items[0];
    const missingGenre = '<h1>Title</h1><table><tr><td>Страна:</td><td>США</td></tr></table>';
    for (const html of [missingGenre, missingGenre.replace('</table>', '<tr><td>Жанр:</td><td></td></tr></table>')]) {
        const data = S.parseDetails(html, item.url);
        assert.equal(data.genresComplete, false); assert.equal(data.countriesComplete, true);
        assert.equal(S.matches(item, S.normalize({ advanced: group([rule('genre', 'none', ['horror'])]) }), {}, data), false);
    }
    const data = S.parseDetails(partial.replace('</table>', '<tr><td>Страна:</td><td> </td></tr></table>'), item.url);
    assert.equal(data.countriesComplete, false);
    for (const html of ['<h1>Вход</h1>', '<h1>Service unavailable</h1>', '<table><tr><td>Unknown:</td><td>data</td></tr></table>']) {
        assert.throws(() => S.parseDetails(html, item.url), /Не удалось прочитать/);
    }
});

test('detail cache accepts legacy complete records and rejects invalid completeness flags', t => {
    const { S, w } = environment(t), metadata = S.parseDetails(full, url(1));
    delete metadata.countriesComplete; delete metadata.genresComplete;
    S.rememberDetails(url(1), metadata);
    const item = S.parseList(listing, origin).items[0];
    assert.equal(S.matches(item, S.normalize({ advanced: group([rule('country', 'none', ['Россия'])]) }), {}, S.cachedDetails(url(1))), true);
    for (const field of ['countriesComplete', 'genresComplete']) {
        w.sessionStorage.setItem('rc-search:detail:v2:' + url(2), JSON.stringify({ at: Date.now(), data: { ...metadata, [field]: 'false' } }));
        assert.equal(S.cachedDetails(url(2)), undefined);
    }
});
