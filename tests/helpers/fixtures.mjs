import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
export function nativeNavigation({ activeCollections = false } = {}) {
    const entry = activeCollections
        ? '<span class="b-topnav__item-link single active">Подборки</span>'
        : '<a class="b-topnav__item-link single" href="/collections/">Подборки</a>';
    return read('fixtures/navigation.html').replace('<!-- fixture:collections -->', entry);
}
export const nativeCards = ({ withRating = false } = {}) => read('fixtures/cards.html').replace('<!-- fixture:rating -->',
    withRating ? '<div class="rating"><span class="rating-value">8.4</span><span class="rating-votes"> / 123</span></div>' : '');
export function fixturePage(options) {
    return read('browser/fixture.html')
        .replace('/* fixture:native-cards */', read('fixtures/native-cards.css'))
        .replace('<!-- fixture:navigation -->', nativeNavigation(options))
        .replace('<!-- fixture:cards -->', nativeCards(options));
}
