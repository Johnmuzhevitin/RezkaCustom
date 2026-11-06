// A bounded, data-only expression language. null means that a fact is unknown.
const RezkaSearchRules = (() => {
    const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
    const fold = value => clean(value).toLocaleLowerCase('ru').replaceAll('ё', 'е');
    const KINDS = { dub: 'Дубляж', multi: 'Многоголосый закадровый', dual: 'Двухголосый закадровый',
        single: 'Одноголосый закадровый', original: 'Оригинал', subtitles: 'Оригинал с субтитрами' };
    const STATUSES = { watching: 'Смотрю', completed: 'Завершённые', excluded: 'Исключённые', unwatched: 'Не смотрел' };
    const FIELDS = {
        type: { label: 'Тип', kind: 'list' }, genre: { label: 'Жанр', kind: 'list' },
        year: { label: 'Год выхода', kind: 'number', min: 1890, max: 2100, step: 1 },
        country: { label: 'Страна', kind: 'list' }, voice: { label: 'Озвучка', kind: 'list' },
        translation: { label: 'Вид перевода', kind: 'list' },
        status: { label: 'Мой список', kind: 'list' }, actor: { label: 'Актёры', kind: 'list' }
    };
    for (const [id, name] of [['imdb', 'IMDb'], ['kp', 'Кинопоиск'], ['rezka', 'HDrezka']]) {
        FIELDS[id] = { label: 'Рейтинг ' + name, kind: 'number', min: 0, max: 10, step: 0.01, rating: true };
        FIELDS[id + 'Votes'] = { label: 'Голосов ' + name, kind: 'number', min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, rating: true };
    }
    const OPS = { any: 'Есть любое из', all: 'Есть все из', none: 'Нет ни одного из', eq: 'Равно', ne: 'Не равно',
        gte: 'Не меньше', gt: 'Больше', lte: 'Не больше', lt: 'Меньше', between: 'От и до', exists: 'Есть данные', missing: 'Нет данных' };
    const operations = field => FIELDS[field]?.kind === 'list' ? ['any', 'all', 'none']
        : ['gte', 'lte', 'between', 'eq', 'ne', 'gt', 'lt', ...(FIELDS[field]?.rating ? ['exists', 'missing'] : [])];
    const fail = (message, path, control) => { const error = new Error(message); error.path = path; error.control = control; throw error; };
    function validate(tree, { allowEmpty = false } = {}) {
        let count = 0;
        function visit(node, path, depth) {
            if (++count > 200 || depth > 12) fail('Слишком много условий: не более 200 элементов и 12 уровней групп.', path);
            if (!node || typeof node !== 'object' || Array.isArray(node)) fail('Повреждённое условие поиска.', path);
            if (node.kind === 'group') {
                if (!['all', 'any'].includes(node.mode) || typeof node.not !== 'boolean' || !Array.isArray(node.children)) fail('Повреждённая группа условий.', path);
                if (!node.children.length && !(allowEmpty && depth === 0)) fail('Добавьте условие в группу или удалите её.', path, 'children');
                return { kind: 'group', mode: node.mode, not: node.not, children: node.children.map((child, i) => visit(child, path + '.' + i, depth + 1)) };
            }
            const spec = Object.hasOwn(FIELDS, node.field) && FIELDS[node.field];
            if (node.kind !== 'rule' || !spec || !operations(node.field).includes(node.op)) fail('Неизвестное поле или операция в условии.', path);
            const result = { kind: 'rule', field: node.field, op: node.op };
            if (['exists', 'missing'].includes(node.op)) return result;
            if (spec.kind === 'list') {
                if (!Array.isArray(node.values) || !node.values.length || node.values.length > 100
                    || node.values.some(v => typeof v !== 'string' || !clean(v) || v.length > 120)) fail('Выберите хотя бы одно значение.', path, 'values');
                result.values = [...new Map(node.values.map(v => [fold(v), clean(v)])).values()];
                if (node.field === 'type' && result.values.some(v => !['films', 'series', 'cartoons', 'animation', 'show'].includes(v))) fail('Неизвестный тип контента.', path);
                if (node.field === 'translation' && result.values.some(v => !Object.hasOwn(KINDS, v))) fail('Неизвестный вид перевода.', path);
                if (node.field === 'status' && result.values.some(v => !Object.hasOwn(STATUSES, v))) fail('Неизвестный статус просмотра.', path);
            } else {
                const valid = v => typeof v === 'number' && Number.isFinite(v) && v >= spec.min && v <= spec.max && (spec.step !== 1 || Number.isSafeInteger(v));
                if (!valid(node.value)) fail(`Введите значение для «${spec.label}» от ${spec.min} до ${spec.max}.`, path, 'value');
                result.value = node.value;
                if (node.op === 'between') {
                    if (!valid(node.to)) fail(`Введите верхнюю границу для «${spec.label}» от ${spec.min} до ${spec.max}.`, path, 'to');
                    if (node.to < node.value) fail('Верхняя граница должна быть не меньше нижней.', path, 'to');
                    result.to = node.to;
                }
            }
            return result;
        }
        return visit(tree, 'root', 0);
    }
    const group = (children = [], mode = 'all', not = false) => ({ kind: 'group', mode, not, children });
    function combine(values, mode) {
        if (mode === 'all') return values.includes(false) ? false : values.includes(null) ? null : true;
        return values.includes(true) ? true : values.includes(null) ? null : false;
    }
    function evaluate(node, facts) {
        if (!node) return true;
        if (node.kind === 'group') {
            const answer = combine(node.children.map(child => evaluate(child, facts)), node.mode);
            return node.not && answer !== null ? !answer : answer;
        }
        const actual = facts[node.field];
        if (FIELDS[node.field].kind === 'list') {
            const values = actual?.values?.map(fold) || [];
            const matches = node.values.map(value => values.includes(fold(value)) ? true : actual?.complete ? false : null);
            const answer = combine(matches, node.op === 'all' ? 'all' : 'any');
            return node.op === 'none' && answer !== null ? !answer : answer;
        }
        if (node.op === 'exists') return actual === undefined ? null : actual !== null;
        if (node.op === 'missing') return actual === undefined ? null : actual === null;
        if (actual == null) return null;
        switch (node.op) {
            case 'eq': return actual === node.value;
            case 'ne': return actual !== node.value;
            case 'gte': return actual >= node.value;
            case 'gt': return actual > node.value;
            case 'lte': return actual <= node.value;
            case 'lt': return actual < node.value;
            case 'between': return actual >= node.value && actual <= node.to;
            default: return null;
        }
    }
    function fields(tree, found = new Set()) {
        if (tree?.kind === 'rule') found.add(tree.field);
        else for (const child of tree?.children || []) fields(child, found);
        return found;
    }
    function describe(node, label = (field, value) => field === 'translation' ? KINDS[value] : field === 'status' ? STATUSES[value] : value) {
        if (!node) return '';
        if (node.kind === 'group') {
            if (!node.children.length) return 'Пока без условий';
            const parts = node.children.map(child => describe(child, label));
            return (node.not ? 'Исключить: ' : '') + (parts.length > 1 ? '(' + parts.join(node.mode === 'all' ? ' И ' : ' ИЛИ ') + ')' : parts[0]);
        }
        const spec = FIELDS[node.field];
        if (!spec) return 'Выберите поле';
        const value = spec.kind === 'list' ? (node.values || []).map(v => label(node.field, v)).join(', ')
            : node.value == null || node.value === '' ? '…' : String(node.value) + (node.op === 'between' ? ' — ' + (node.to ?? '…') : '');
        const operator = { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=', ne: '≠', any: '— любое:', all: '— все:', none: '— исключить:', between: '—' }[node.op];
        return spec.label + ' ' + (operator ? operator + ' ' + (value || '…') : OPS[node.op]);
    }
    function translationKinds(name) {
        const text = fold(name), kinds = [];
        if (/дубляж/.test(text)) kinds.push('dub');
        if (/многоголос/.test(text)) kinds.push('multi');
        if (/двухголос/.test(text)) kinds.push('dual');
        if (/одноголос/.test(text)) kinds.push('single');
        if (/оригинал/.test(text)) { kinds.push('original'); if (/субтитр/.test(text)) kinds.push('subtitles'); }
        return kinds;
    }
    function includesExcluded(node, negated = false) {
        if (node?.kind === 'group') return node.children.some(child => includesExcluded(child, negated !== node.not));
        return node?.field === 'status' && node.values.includes('excluded') && (node.op === 'none') === negated;
    }
    return { FIELDS, OPS, KINDS, STATUSES, clean, fold, operations, validate, group, combine, evaluate, fields, describe, translationKinds, includesExcluded };
})();
