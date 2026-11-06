// DOM-only controls shared by the compact filters and the nested rule editor.
const RezkaSearchEditor = (() => {
    const R = RezkaSearchRules, S = RezkaSearch, Store = RezkaSearchStore;
    const clone = value => JSON.parse(JSON.stringify(value));
    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const button = (text, action, className = '') => {
        const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node;
    };
    const select = (entries, value, label) => {
        const node = el('select'); node.setAttribute('aria-label', label);
        const groups = new Map();
        for (const [key, name, group] of entries) {
            if (group && !groups.has(group)) { const item = el('optgroup'); item.label = group; groups.set(group, item); node.append(item); }
            const option = el('option', '', name); option.value = key; (groups.get(group) || node).append(option);
        }
        node.value = value; return node;
    };
    const fieldEntries = () => Object.entries(R.FIELDS).map(([id, spec]) => [id, spec.label,
        id === 'status' ? 'Мои списки' : ['type', 'genre', 'year', 'country', 'actor'].includes(id) ? 'О тайтле' : ['voice', 'translation'].includes(id) ? 'Перевод' : 'Рейтинги и голоса']);
    function choices(field) {
        if (field === 'type') return Object.entries(S.TYPES);
        if (field === 'genre') return Object.entries(S.GENRES).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
        if (field === 'translation') return Object.entries(R.KINDS);
        if (field === 'status') return Object.entries(R.STATUSES);
        return S.suggestions(field).map(name => [name, name]);
    }
    const valueLabel = (field, value) => choices(field).find(([key]) => key === value)?.[1] || value;
    const describe = node => R.describe(node, valueLabel);
    function commonSummary(state) {
        const year = state.from && state.to ? (state.from === state.to ? state.from : state.from + '–' + state.to)
            : state.from ? 'с ' + state.from : state.to ? 'до ' + state.to : '';
        return [S.TYPES[state.type], S.GENRES[state.genre], state.country, year, ...(state.extra || []).map(describe)].filter(Boolean).join(' · ');
    }
    function create({ root, changed, apply, base, validateBase, fillBase, removeAdvanced }) {
        const $ = selector => root.querySelector(selector);
        let extra = [], advanced = null, working, selectedPreset = '', records = [], storageBusy = false, refreshId = 0;
        let serial = 0, focusReturn;
        const editors = new Set();
        const collapsed = new WeakSet();
        const groupNodes = new WeakMap();
        function clearConditionError(target) {
            const message = [...target.children].find(node => node.classList.contains('condition-error'));
            if (!message) return;
            for (const control of target.querySelectorAll('[aria-describedby]')) {
                const ids = control.getAttribute('aria-describedby').split(/\s+/);
                if (!ids.includes(message.id)) continue;
                const remaining = ids.filter(id => id !== message.id).join(' ');
                if (remaining) control.setAttribute('aria-describedby', remaining); else control.removeAttribute('aria-describedby');
                control.removeAttribute('aria-invalid');
            }
            message.remove(); target.classList.remove('invalid-condition');
        }
        function clearConditionErrors(container) {
            for (const message of container.querySelectorAll('.condition-error')) clearConditionError(message.parentElement);
        }
        function conditionError(target, problem, focus = true) {
            if (!target) return false;
            clearConditionError(target);
            const message = el('p', 'condition-error', problem.message); message.id = 'condition-error-' + ++serial;
            message.setAttribute('role', 'alert'); target.append(message); target.classList.add('invalid-condition');
            const control = [...target.querySelectorAll('[data-error-control]')].find(node => node.dataset.errorControl === (problem.control || 'values'))
                || target.querySelector('.condition-values input, input, select, button');
            if (control) {
                control.setAttribute('aria-invalid', 'true');
                control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' '));
                if (focus) control.focus();
            }
            return true;
        }
        function validation(problem) {
            if (problem.scope !== 'extra' && !problem.path?.startsWith('extra.')) return false;
            const path = problem.path?.replace(/^root/, 'extra');
            const target = [...$('#extra-filters').querySelectorAll('[data-path]')].find(row => row.dataset.path === path);
            clearConditionErrors($('#extra-filters'));
            return conditionError(target, problem, !dialog.open);
        }
        const dialog = el('dialog', 'search-dialog'); dialog.id = 'conditions-dialog';
        dialog.setAttribute('aria-labelledby', 'conditions-heading');
        const dialogHeader = el('header', 'dialog-header');
        const heading = el('h2', '', 'Сложные условия'); heading.id = 'conditions-heading';
        const closeButton = button('Закрыть', () => close(), 'text-button');
        dialogHeader.append(heading, closeButton);
        const context = el('div', 'conditions-context');
        const scope = el('p', 'conditions-scope'); scope.id = 'conditions-scope';
        const common = el('p', 'conditions-filters'); context.append(scope, common);
        dialog.setAttribute('aria-describedby', scope.id);
        const help = el('p', 'field-help', 'Общие фильтры действуют для всех групп. Здесь можно задать дополнительные варианты и исключения.');
        const body = el('div', 'conditions-body');
        const error = el('p', 'error'); error.hidden = true; error.setAttribute('role', 'alert');
        const footer = el('footer', 'dialog-actions');
        footer.append(button('Отмена', () => close()), button('Применить', () => {
            try {
                flush(body);
                const next = working.children.length ? R.validate(working) : null;
                if (apply(next)) close();
                else showError('Проверьте общие фильтры: год, значения и диапазоны.');
            } catch (problem) { showError(problem.message, problem.path, problem.control); }
        }, 'primary'));
        dialog.append(dialogHeader, context, help, body, error, footer); root.append(dialog);
        const presetDialog = el('dialog', 'search-dialog preset-dialog'); presetDialog.setAttribute('aria-label', 'Сохранение набора'); root.append(presetDialog);

        function show(node, opener) {
            focusReturn = opener || root.activeElement;
            if (typeof node.showModal === 'function') node.showModal(); else node.setAttribute('open', '');
            node.querySelector('input, select, button')?.focus();
        }
        function close(node = dialog) {
            if (!node.open) return;
            if (typeof node.close === 'function') node.close(); else node.removeAttribute('open');
            (focusReturn?.isConnected ? focusReturn : $(node === dialog ? '#advanced-filter' : '#preset-select'))?.focus();
        }
        for (const node of [dialog, presetDialog]) {
            node.addEventListener('cancel', event => { event.preventDefault(); close(node); });
            node.addEventListener('keydown', event => {
                if (event.defaultPrevented) return;
                if (event.key === 'Escape') { event.preventDefault(); close(node); }
                if (event.key !== 'Tab') return;
                const focusable = [...node.querySelectorAll('button, input, select, summary, [tabindex="0"]')].filter(control => !control.disabled && !control.closest('[hidden]'));
                if (!focusable.length) return;
                const first = focusable[0], last = focusable.at(-1);
                if (event.shiftKey && root.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && root.activeElement === last) { event.preventDefault(); first.focus(); }
            });
        }
        function showError(message, path, control) {
            clearConditionErrors(body);
            const target = [...body.querySelectorAll('[data-path]')].find(row => row.dataset.path === path);
            for (let group = target; group && group !== body; group = group.parentElement) {
                if (group.classList.contains('condition-group')) {
                    [...group.children].find(child => child.classList.contains('group-content')).hidden = false;
                    collapsed.delete(groupNodes.get(group));
                    [...group.children].find(child => child.classList.contains('group-summary')).hidden = true;
                    const toggle = [...group.children].find(child => child.classList.contains('group-header')).querySelector('[data-collapse]');
                    toggle.textContent = 'Свернуть'; toggle.setAttribute('aria-expanded', 'true');
                    toggle.setAttribute('aria-label', 'Свернуть: ' + group.getAttribute('aria-label'));
                }
            }
            error.hidden = conditionError(target, { message, control });
            if (!error.hidden) error.textContent = message;
        }
        function flush(container, skip) {
            for (const editor of editors) {
                if (!editor.node.isConnected) { editors.delete(editor); continue; }
                if (container.contains(editor.node) && !skip?.contains(editor.node)) {
                    try { editor.commit(); }
                    catch (problem) { problem.path = editor.node.closest('[data-path]')?.dataset.path; problem.control = 'values'; throw problem; }
                }
            }
        }
        const prune = () => { for (const editor of editors) if (!editor.node.isConnected) editors.delete(editor); };
        function editTree(action, focus) {
            try { flush(body); action(); renderTree(); if (focus) focusPath(focus); }
            catch (problem) { showError(problem.message, problem.path, problem.control); }
        }
        function multivalue(rule) {
            const wrapper = el('div', 'value-picker'), chips = el('div', 'value-chips');
            const inputRow = el('div', 'value-input-row'), input = el('input');
            input.type = 'text'; input.autocomplete = 'off'; input.maxLength = 120;
            input.dataset.errorControl = 'values';
            input.placeholder = rule.field === 'voice' ? 'Введите название озвучки' : rule.field === 'actor' ? 'Введите имя актёра' : 'Выберите значение';
            input.setAttribute('aria-label', 'Значения: ' + R.FIELDS[rule.field].label);
            input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false');
            const list = el('div', 'value-options'); list.id = 'rule-options-' + ++serial; list.hidden = true;
            list.setAttribute('role', 'listbox'); input.setAttribute('aria-controls', list.id);
            let entries = [], index = -1;
            const free = ['voice', 'country', 'actor'].includes(rule.field);
            const dismiss = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); index = -1; };
            function renderChips() {
                chips.replaceChildren();
                for (const value of rule.values || []) {
                    const chip = button(valueLabel(rule.field, value) + ' ×', () => {
                        rule.values = rule.values.filter(v => v !== value); renderChips(); changed(); input.focus();
                    }, 'value-chip'); chip.setAttribute('aria-label', 'Убрать: ' + valueLabel(rule.field, value)); chips.append(chip);
                }
            }
            function add(value) {
                if (!(rule.values || []).some(v => R.fold(v) === R.fold(value))) (rule.values ||= []).push(value);
                input.value = ''; input.setCustomValidity(''); dismiss(); renderChips(); changed();
                input.dispatchEvent(new Event('change', { bubbles: true })); input.focus();
            }
            function commit() {
                const value = R.clean(input.value); if (!value) return;
                const exact = choices(rule.field).find(([key, name]) => R.fold(name) === R.fold(value) || R.fold(key) === R.fold(value));
                if (exact) add(exact[0]);
                else if (free) add(value);
                else { input.setCustomValidity('Выберите значение из списка.'); input.reportValidity(); throw new Error('Выберите значение из списка: ' + R.FIELDS[rule.field].label); }
            }
            function open() {
                for (const other of editors) if (other.node !== wrapper) other.dismiss?.();
                entries = choices(rule.field).filter(([value, name]) => !(rule.values || []).some(v => R.fold(v) === R.fold(value)) && R.fold(name).includes(R.fold(input.value)));
                list.replaceChildren(); index = -1;
                for (const [i, [value, name]] of entries.entries()) {
                    const option = el('div', 'value-option', name); option.id = list.id + '-' + i; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
                    option.addEventListener('mousedown', event => event.preventDefault()); option.addEventListener('click', () => add(value)); list.append(option);
                }
                if (!entries.length) list.append(el('p', 'picker-empty', free ? 'Можно ввести точное название и нажать Enter.' : 'Нет других значений.'));
                list.hidden = false; input.setAttribute('aria-expanded', 'true'); input.removeAttribute('aria-activedescendant');
                const rect = inputRow.getBoundingClientRect(), boundary = wrapper.closest('dialog')?.getBoundingClientRect();
                const below = Math.min(window.innerHeight, boundary?.bottom || window.innerHeight) - rect.bottom - 18;
                const above = rect.top - Math.max(0, boundary?.top || 0) - 18;
                const upward = below < 220 && above > below;
                list.classList.toggle('above', upward); list.style.maxHeight = Math.max(90, Math.min(240, upward ? above : below)) + 'px';
            }
            function highlight(next) {
                index = Math.max(0, Math.min(entries.length - 1, next));
                for (const [i, node] of [...list.querySelectorAll('[role="option"]')].entries()) node.setAttribute('aria-selected', String(i === index));
                if (entries[index]) { input.setAttribute('aria-activedescendant', list.id + '-' + index); list.children[index].scrollIntoView?.({ block: 'nearest' }); }
            }
            input.addEventListener('focus', open);
            input.addEventListener('input', () => { input.setCustomValidity(''); open(); changed(); });
            input.addEventListener('keydown', event => {
                if (event.isComposing) return;
                if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
                    event.preventDefault(); if (list.hidden) open(); highlight(index < 0 ? 0 : index + (event.key === 'ArrowDown' ? 1 : -1));
                } else if (event.key === 'Enter') {
                    event.preventDefault(); if (!list.hidden && entries[index]) add(entries[index][0]);
                    else { try { commit(); } catch { /* Inline validity describes the action. */ } }
                } else if (event.key === 'Escape' && !list.hidden) { event.preventDefault(); dismiss(); }
                else if (event.key === 'Tab') dismiss();
            });
            wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) dismiss(); });
            const addButton = button('Добавить', () => { try { commit(); } catch { /* Keep the input available. */ } }, 'small-button');
            addButton.setAttribute('aria-label', 'Добавить значение: ' + R.FIELDS[rule.field].label);
            inputRow.append(input, list); wrapper.append(inputRow, addButton, chips); renderChips();
            if (rule.field === 'voice') {
                const help = el('details', 'voice-help');
                const text = el('p', '', 'Подсказки пополняются со страниц тайтлов и сохраняются между вкладками. Если озвучки нет в списке, введите её точное название с языком и версией перевода. Для сериала наличие озвучки в списке не гарантирует её во всех сериях.');
                text.id = 'voice-help-' + ++serial; input.setAttribute('aria-describedby', text.id);
                help.append(el('summary', '', 'Об озвучках и подсказках'), text); wrapper.append(help);
            }
            if (rule.field === 'actor' || rule.field === 'status') {
                const help = el('p', 'field-help', rule.field === 'actor'
                    ? 'Введите имя как в блоке «В ролях» на сайте. «Нет ни одного из» исключает тайтлы с выбранными актёрами. Проверяются актёры, указанные на странице тайтла.'
                    : '«Смотрю» и «Завершённые» — из вашей истории Rezka; нужен вход на сайт. «Исключённые» — локальный список расширения.');
                help.id = 'rule-help-' + ++serial; input.setAttribute('aria-describedby', help.id); wrapper.append(help);
            }
            editors.add({ node: wrapper, commit, dismiss, input }); return wrapper;
        }
        function ruleRow(rule, remove, compact = false, path = '') {
            const row = el('div', compact ? 'condition-row compact-condition' : 'condition-row'); row.dataset.path = path;
            const clearError = () => {
                if (!row.classList.contains('invalid-condition')) return;
                try { R.validate(rule); clearConditionError(row); } catch { /* Keep the explanation until the condition is valid. */ }
            };
            row.addEventListener('input', clearError); row.addEventListener('change', clearError);
            function render() {
                clearConditionError(row);
                row.replaceChildren();
                const field = select(fieldEntries(), rule.field, 'Поле условия');
                if (compact) row.append(el('strong', 'condition-label', R.FIELDS[rule.field].label)); else row.append(field);
                field.addEventListener('change', () => {
                    rule.field = field.value; rule.op = R.operations(rule.field)[0]; delete rule.value; delete rule.to; rule.values = [];
                    render(); changed(); row.querySelector('select')?.focus();
                });
                const operators = select(R.operations(rule.field).map(op => [op, R.OPS[op]]), rule.op, 'Условие: ' + R.FIELDS[rule.field].label);
                operators.addEventListener('change', () => {
                    try { flush(row); rule.op = operators.value; render(); prune(); changed(); row.querySelectorAll('select')[compact ? 0 : 1]?.focus(); }
                    catch (problem) { operators.value = rule.op; conditionError(row, problem); }
                });
                row.append(operators);
                const values = el('div', 'condition-values');
                if (R.FIELDS[rule.field].kind === 'list') values.append(multivalue(rule));
                else if (!['exists', 'missing'].includes(rule.op)) {
                    for (const key of rule.op === 'between' ? ['value', 'to'] : ['value']) {
                        const input = el('input'); input.type = 'number';
                        input.dataset.errorControl = key;
                        const spec = R.FIELDS[rule.field]; input.min = spec.min; input.max = spec.max; input.step = spec.step;
                        input.value = rule[key] ?? ''; input.placeholder = key === 'to' ? 'До' : rule.op === 'between' ? 'От' : 'Значение';
                        input.setAttribute('aria-label', spec.label + ': ' + input.placeholder);
                        input.addEventListener('input', () => { rule[key] = input.value === '' ? null : Number(input.value); changed(); }); values.append(input);
                    }
                } else values.append(el('span', 'field-help', rule.op === 'exists' ? 'Источник указал значение' : 'Источник не указал значение'));
                row.append(values);
                const removeButton = button('×', () => {
                    try { flush(compact ? $('#extra-filters') : body, row); remove(); }
                    catch (problem) { compact ? validation(problem) : showError(problem.message, problem.path, problem.control); }
                }, 'remove-condition'); removeButton.setAttribute('aria-label', 'Удалить условие: ' + R.FIELDS[rule.field].label); row.append(removeButton);
            }
            render(); return row;
        }
        const newRule = field => ({ kind: 'rule', field, op: R.operations(field)[0], ...(R.FIELDS[field].kind === 'list' ? { values: [] } : { value: null }) });
        function renderExtras() {
            $('#extra-filters').replaceChildren();
            extra.forEach((rule, index) => $('#extra-filters').append(ruleRow(rule, () => {
                extra.splice(extra.indexOf(rule), 1); renderExtras(); changed(); $('#add-filter').focus();
            }, true, 'extra.' + index)));
            prune();
        }
        function removeAppliedExtra(applied) {
            const index = extra.findIndex(rule => {
                try { return JSON.stringify(R.validate(rule)) === JSON.stringify(applied); } catch { return false; }
            });
            if (index < 0) return;
            const row = $('#extra-filters').children[index];
            if ([...editors].some(editor => row.contains(editor.node) && editor.input?.value.trim())) return;
            extra.splice(index, 1); row.remove(); prune();
            // Keep neighbouring DOM controls and their uncommitted text intact.
            [...$('#extra-filters').children].forEach((node, i) => { node.dataset.path = 'extra.' + i; });
        }
        const extraChoices = fieldEntries().filter(([id]) => !['type', 'genre', 'year', 'country'].includes(id));
        const addSelect = select([['', 'Выберите фильтр'], ...extraChoices], '', 'Добавить фильтр'); addSelect.id = 'add-filter-choice'; addSelect.hidden = true;
        $('#add-filter').after(addSelect);
        $('#add-filter').addEventListener('click', () => { addSelect.hidden = !addSelect.hidden; if (!addSelect.hidden) addSelect.focus(); });
        addSelect.addEventListener('change', () => {
            if (!addSelect.value) return;
            try { flush($('#extra-filters')); } catch (problem) { validation(problem); addSelect.value = ''; return; }
            extra.push(newRule(addSelect.value)); renderExtras(); addSelect.value = ''; addSelect.hidden = true; changed();
            $('#extra-filters').lastElementChild?.querySelector('input, select')?.focus();
        });
        function renderGroup(node, path = 'root', depth = 0, groupPath = []) {
            const group = el('section', 'condition-group'); group.dataset.path = path;
            const groupName = groupPath.length ? 'Группа ' + groupPath.join('.') : 'Основная группа';
            group.setAttribute('role', 'group'); group.setAttribute('aria-label', groupName);
            groupNodes.set(group, node);
            const header = el('div', 'group-header');
            const mode = select([['all', 'Все условия'], ['any', 'Любое условие']], node.mode, 'Совпадение группы: ' + groupName);
            mode.addEventListener('change', () => { node.mode = mode.value; updateSummary(); });
            const exclusion = el('label', 'group-exclusion'), check = el('input'); check.type = 'checkbox'; check.checked = node.not;
            check.setAttribute('aria-label', 'Исключить совпадения: ' + groupName);
            check.addEventListener('change', () => { node.not = check.checked; updateSummary(); }); exclusion.append(check, document.createTextNode('Исключить совпадения'));
            const summary = el('p', 'group-summary'); summary.hidden = true;
            const contents = el('div', 'group-content');
            const toggle = button('Свернуть', () => {
                contents.hidden = !contents.hidden; summary.hidden = !contents.hidden; updateSummary();
                if (contents.hidden) collapsed.add(node); else collapsed.delete(node);
                toggle.textContent = contents.hidden ? 'Развернуть' : 'Свернуть'; toggle.setAttribute('aria-expanded', String(!contents.hidden));
                toggle.setAttribute('aria-label', toggle.textContent + ': ' + groupName);
            }, 'text-button'); toggle.setAttribute('aria-expanded', 'true');
            toggle.dataset.collapse = 'true';
            if (collapsed.has(node)) { contents.hidden = true; summary.hidden = false; toggle.textContent = 'Развернуть'; toggle.setAttribute('aria-expanded', 'false'); }
            toggle.setAttribute('aria-label', toggle.textContent + ': ' + groupName);
            const groupTools = el('div', 'group-tools'); groupTools.append(toggle);
            header.append(mode, exclusion, groupTools);
            if (path !== 'root') {
                const remove = button('Удалить группу', () => {
                    try { flush(body, group); } catch (problem) { showError(problem.message, problem.path, problem.control); return; }
                    const parts = path.split('.').slice(1).map(Number), index = parts.pop(); let parent = working;
                    for (const part of parts) parent = parent.children[part]; parent.children.splice(index, 1); renderTree();
                    body.querySelector('select, button')?.focus();
                }, 'text-button');
                remove.setAttribute('aria-label', 'Удалить группу: ' + groupName); groupTools.append(remove);
            }
            const children = el('div', 'group-children');
            let groupIndex = 0;
            node.children.forEach((child, index) => children.append(child.kind === 'group' ? renderGroup(child, path + '.' + index, depth + 1, [...groupPath, ++groupIndex])
                : ruleRow(child, () => { node.children.splice(index, 1); renderTree(); body.querySelector('select, button')?.focus(); }, false, path + '.' + index)));
            const actions = el('div', 'group-actions');
            actions.append(button('+ Условие', () => editTree(() => node.children.push(newRule('imdb')), path + '.' + node.children.length), 'small-button'),
                button('+ Группа', () => editTree(() => node.children.push(R.group()), path + '.' + node.children.length), 'small-button'));
            actions.firstElementChild.dataset.errorControl = 'children';
            actions.firstElementChild.setAttribute('aria-label', 'Добавить условие: ' + groupName);
            actions.lastElementChild.setAttribute('aria-label', 'Добавить группу: ' + groupName);
            if (depth >= 11) actions.lastElementChild.disabled = true;
            if (!node.children.length) children.append(el('p', 'field-help', 'Добавьте условие или группу альтернатив.'));
            contents.append(children, actions); group.append(header, summary, contents);
            function updateSummary() { summary.textContent = describe(node); }
            updateSummary(); return group;
        }
        function focusPath(path) { [...body.querySelectorAll('[data-path]')].find(node => node.dataset.path === path)?.querySelector('select, input, button')?.focus(); }
        function renderTree() { error.hidden = true; body.replaceChildren(renderGroup(working)); prune(); }
        function open(opener) {
            if (!validateBase()) return;
            try { flush($('#extra-filters')); } catch (problem) { validation(problem); return; }
            working = clone(advanced || R.group());
            const state = { ...base(), extra, advanced: null };
            const query = String(state.q || '').trim();
            scope.textContent = query ? 'Поиск по названию: ' + query : 'По всему каталогу';
            const summary = commonSummary(state); common.textContent = summary ? 'Общие фильтры: ' + summary : 'Общие фильтры не заданы.';
            renderTree(); show(dialog, opener); body.querySelector('select, button')?.focus();
        }
        $('#advanced-filter').addEventListener('click', event => open(event.currentTarget));
        function renderApplied(state) {
            const target = $('#advanced-summary'); target.replaceChildren(); target.hidden = !state.advanced;
            if (state.advanced) {
                const disclosure = el('details'); const summary = el('summary', '', 'Сложные условия');
                disclosure.append(summary, el('p', 'logic-description', describe(state.advanced)));
                target.append(disclosure, button('Изменить', event => open(event.currentTarget), 'text-button'), button('Убрать', removeAdvanced, 'text-button'));
            }
            $('#advanced-filter').textContent = advanced ? 'Сложные условия · настроены' : 'Сложные условия';
        }
        function notice(message, bad = false) { const node = $('#preset-notice'); node.textContent = message; node.classList.toggle('notice-error', bad); }
        const presetSelect = select([['', 'Сохранённые наборы']], '', 'Сохранённые наборы'); presetSelect.id = 'preset-select';
        const presetField = el('div', 'preset-field');
        presetField.innerHTML = '<svg class="preset-chevron" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5 7.5 5 5 5-5"/></svg>';
        presetField.prepend(presetSelect);
        const saveButton = button('Сохранить набор фильтров', () => nameDialog('create'), 'text-button');
        const manage = el('details', 'preset-manage'); manage.hidden = true; manage.append(el('summary', '', 'Действия с набором'));
        const updateButton = button('Обновить условия', () => run(async () => {
            flush($('#extra-filters')); const current = records.find(record => record.id === selectedPreset);
            await Store.save(current.name, S.normalize({ ...base(), extra, advanced }), selectedPreset); await refresh(); notice('Условия набора обновлены.');
        }), 'text-button');
        const renameButton = button('Переименовать', () => nameDialog('rename'), 'text-button');
        const removeButton = button('Удалить набор', () => nameDialog('delete'), 'text-button');
        manage.append(updateButton, renameButton, removeButton);
        $('#preset-controls').append(presetField, saveButton, manage);
        async function refresh() {
            const id = ++refreshId;
            let next;
            try { next = await Store.list(); }
            catch (error) { if (id !== refreshId) return; throw error; }
            if (id !== refreshId) return;
            records = next;
            presetSelect.replaceChildren();
            for (const [id, name] of [['', 'Сохранённые наборы'], ...records.map(record => [record.id, record.name + (record.error ? ' — ошибка' : '')])]) {
                const option = el('option', '', name); option.value = id; presetSelect.append(option);
            }
            if (!records.some(record => record.id === selectedPreset)) selectedPreset = '';
            presetSelect.value = selectedPreset; manage.hidden = !selectedPreset;
        }
        async function run(action) {
            if (storageBusy) return;
            storageBusy = true; $('#preset-controls').setAttribute('aria-busy', 'true');
            for (const node of $('#preset-controls').querySelectorAll('button, select')) node.disabled = true;
            try { await action(); } catch (problem) { if (!validation(problem)) notice(problem.message || 'Не удалось сохранить набор. Попробуйте ещё раз.', true); }
            finally {
                storageBusy = false; $('#preset-controls').removeAttribute('aria-busy');
                for (const node of $('#preset-controls').querySelectorAll('button, select')) node.disabled = false;
            }
        }
        presetSelect.addEventListener('change', () => {
            const current = records.find(record => record.id === presetSelect.value);
            selectedPreset = presetSelect.value; manage.hidden = !current;
            if (!current) return;
            if (current.error) { notice(current.error, true); return; }
            try { fillBase(S.normalize({ ...current.state, q: base().q })); notice('Набор выбран. Нажмите «Применить фильтры».'); }
            catch (problem) { notice(problem.message, true); }
        });
        function nameDialog(action) {
            if (storageBusy) return;
            const current = records.find(record => record.id === selectedPreset);
            if (action !== 'create' && !current) return;
            let state;
            if (action === 'create') {
                try { flush($('#extra-filters')); state = S.normalize({ ...base(), extra, advanced }); }
                catch (problem) { if (!validation(problem)) notice(problem.message, true); return; }
            }
            presetDialog.replaceChildren();
            const title = { create: 'Сохранить набор фильтров', rename: 'Переименовать набор', delete: 'Удалить набор?' }[action];
            const input = el('input'); input.id = 'preset-name'; input.maxLength = 80; input.value = action === 'create' ? '' : current.name;
            const label = el('label', '', 'Название набора'); label.htmlFor = input.id;
            presetDialog.append(el('h2', '', title));
            if (action === 'create') {
                const scope = el('p', 'field-help', 'Сохранятся фильтры и порядок. Название фильма не сохраняется.');
                const filters = [commonSummary(state), state.advanced ? 'Сложные условия: ' + describe(state.advanced) : ''].filter(Boolean).join(' · ');
                const summary = el('p', 'preset-summary', (filters || 'Без ограничений по фильтрам.') + ' Порядок: ' + S.SORTS[state.sort] + '.');
                scope.id = 'preset-scope'; presetDialog.setAttribute('aria-describedby', scope.id); presetDialog.append(scope, summary);
            } else presetDialog.removeAttribute('aria-describedby');
            if (action === 'delete') presetDialog.append(el('p', '', 'Будет удалён набор «' + current.name + '». Текущие фильтры останутся.'));
            else presetDialog.append(label, input);
            const feedback = el('p', 'notice-error'); feedback.setAttribute('role', 'alert'); presetDialog.append(feedback);
            const controls = el('div', 'dialog-actions');
            const cancel = button('Отмена', () => close(presetDialog));
            const confirm = button(action === 'delete' ? 'Удалить' : 'Сохранить', async () => {
                if (storageBusy) return;
                if (action !== 'delete' && !input.value.trim()) { input.setCustomValidity('Введите название набора.'); input.reportValidity(); return; }
                storageBusy = true; confirm.disabled = true; cancel.disabled = true;
                try {
                    if (action === 'delete') { await Store.remove(current.id); selectedPreset = ''; }
                    else if (action === 'rename') {
                        if (current.error) throw new Error('Повреждённый набор нельзя переименовать. Удалите его и сохраните новый.');
                        await Store.save(input.value.trim(), current.state, current.id);
                    } else { const saved = await Store.save(input.value.trim(), state); selectedPreset = saved.id; }
                    await refresh(); close(presetDialog); notice(action === 'delete' ? 'Набор удалён.' : 'Набор сохранён.');
                } catch (problem) { feedback.textContent = problem.message || 'Не удалось сохранить набор. Попробуйте ещё раз.'; }
                finally { storageBusy = false; confirm.disabled = false; cancel.disabled = false; }
            }, 'primary');
            input.addEventListener('input', () => input.setCustomValidity(''));
            input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); confirm.click(); } });
            controls.append(cancel, confirm); presetDialog.append(controls); show(presetDialog);
            if (action !== 'delete') input.focus();
        }
        void run(refresh);
        // Restored sets appear in existing search tabs without replacing their current filter drafts.
        if (typeof chrome !== 'undefined') chrome.storage?.onChanged?.addListener((changes, area) => {
            if (area !== 'local' || !Object.keys(changes).some(key => key.startsWith('rc-search:preset:v2:'))) return;
            refresh().catch(error => notice(error.message || 'Не удалось обновить список наборов.', true));
        });
        return {
            read: () => ({ extra: clone(extra), advanced: clone(advanced) }),
            fill(state) { extra = clone(state.extra || []); advanced = clone(state.advanced || null); renderExtras(); $('#advanced-filter').textContent = advanced ? 'Сложные условия · настроены' : 'Сложные условия'; },
            flush: () => flush($('#extra-filters')),
            pending: () => [...editors].some(editor => editor.node.isConnected && $('#extra-filters').contains(editor.node) && editor.input?.value.trim()),
            removeAppliedExtra,
            removeAppliedAdvanced(applied) { if (JSON.stringify(advanced) === JSON.stringify(applied)) advanced = null; },
            close() { close(); close(presetDialog); for (const editor of editors) editor.dismiss?.(); },
            renderApplied, describe, validation
        };
    }
    function cardFacts(item, state) {
        const fields = R.fields(S.expression(state)), details = item.details;
        if (!details) return [];
        const lines = [];
        for (const [key, label] of [['imdb', 'IMDb'], ['kp', 'Кинопоиск'], ['rezka', 'HDrezka']]) {
            if (!fields.has(key) && !fields.has(key + 'Votes')) continue;
            const score = details.ratings?.[key], votes = details.ratings?.[key + 'Votes'];
            lines.push(label + ': ' + (score == null ? 'нет оценки' : score) + (votes == null ? '' : ' (' + votes.toLocaleString('ru') + ' голосов)'));
        }
        const requested = new Set();
        function visit(node) {
            if (node?.kind === 'rule' && node.field === 'voice' && node.op !== 'none') for (const value of node.values) requested.add(R.fold(value));
            for (const child of node?.children || []) visit(child);
        }
        visit(S.expression(state));
        const voices = (details.voices || []).filter(voice => requested.has(R.fold(voice.name))).map(voice => voice.name);
        if (voices.length) lines.push('Озвучка: ' + voices.join(', '));
        if (fields.has('actor') && details.actors?.length) lines.push('В ролях: ' + details.actors.join(', '));
        if (fields.has('translation') && details.kinds?.length) lines.push('Перевод: ' + details.kinds.map(kind => R.KINDS[kind]).join(', '));
        return lines;
    }
    return { create, describe, cardFacts };
})();
