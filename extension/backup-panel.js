(() => {
    'use strict';
    const $ = selector => document.querySelector(selector);
    const dialog = $('#backup-dialog'), fileInput = $('#backup-file'), preview = $('#backup-preview');
    const choices = [...dialog.querySelectorAll('[data-backup-section]')];
    const maxBytes = 2 * 1024 * 1024;
    let text = '', busy = false, generation = 0;
    function announce(message = '', error = false) {
        $('#backup-status').textContent = message;
        $('#backup-status').dataset.error = String(error);
    }
    function update() {
        dialog.setAttribute('aria-busy', String(busy));
        $('#backup-export').disabled = busy;
        $('#backup-choose').disabled = busy;
        fileInput.disabled = busy;
        for (const choice of choices) choice.disabled = busy || choice.dataset.available !== 'true';
        $('#backup-restore').disabled = busy || !text || !choices.some(choice => choice.checked && !choice.disabled);
    }
    function resetPreview() {
        text = ''; preview.hidden = true;
        for (const choice of choices) { choice.checked = false; choice.dataset.available = 'false'; }
        update();
    }
    async function request(action, payload = {}) {
        let result;
        try { result = await chrome.runtime.sendMessage({ type: 'rezka:backup', action, ...payload }); }
        catch { throw new Error(action === 'import'
            ? 'Не удалось подтвердить восстановление. Проверьте настройки; импорт можно повторить.'
            : 'Нет связи с расширением. Откройте панель заново и повторите попытку.'); }
        if (!result?.ok) throw new Error(result?.error || 'Расширение не ответило. Откройте панель заново и повторите попытку.');
        return result;
    }
    $('#backup-button').addEventListener('click', () => {
        ++generation; busy = false; resetPreview(); fileInput.value = ''; announce();
        dialog.showModal();
        $('#backup-export').focus();
    });
    $('#backup-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
        ++generation; busy = false; resetPreview(); fileInput.value = '';
        $('#backup-button').focus();
    });
    // Panel search shortcuts must not steal focus or consume Escape from the modal.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    $('#backup-choose').addEventListener('click', () => fileInput.click());
    $('#backup-export').addEventListener('click', async () => {
        if (busy) return;
        const current = ++generation;
        busy = true; update(); announce('Готовим копию…');
        try {
            const result = await request('export');
            if (current !== generation) return;
            const url = URL.createObjectURL(new Blob([result.text], { type: 'application/json;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url; link.download = result.filename; dialog.append(link);
            try { link.click(); }
            finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
            announce('Файл передан браузеру для сохранения.');
        } catch (error) { if (current === generation) announce(error.message, true); }
        finally { if (current === generation) { busy = false; update(); } }
    });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file || busy) return;
        const current = ++generation;
        resetPreview(); busy = true; update(); announce('Проверяем файл…');
        try {
            if (file.size > maxBytes) throw new Error('Файл слишком большой. Максимальный размер копии — 2 МБ.');
            let loaded;
            try { loaded = await file.text(); }
            catch { throw new Error('Не удалось прочитать файл. Выберите его ещё раз.'); }
            if (current !== generation) return;
            const result = await request('preview', { text: loaded });
            if (current !== generation) return;
            text = loaded;
            $('#backup-filename').textContent = file.name;
            $('#backup-meta').textContent = `Создана ${new Date(result.exportedAt).toLocaleString('ru-RU')} · версия ${result.extensionVersion}`;
            for (const choice of choices) {
                const count = result.counts[choice.dataset.backupSection];
                choice.dataset.available = String(count > 0);
                choice.checked = count > 0;
                choice.closest('label').querySelector('output').textContent = count === undefined ? 'Нет в файле' : String(count);
            }
            preview.hidden = false;
            announce(choices.some(choice => choice.checked) ? 'Файл проверен. Выберите, что восстановить.' : 'В копии нет данных для восстановления.');
            busy = false; update();
            (choices.find(choice => !choice.disabled) || $('#backup-choose')).focus();
        } catch (error) { if (current === generation) announce(error.message, true); }
        finally { if (current === generation) { busy = false; update(); } }
    });
    choices.forEach(choice => choice.addEventListener('change', update));
    $('#backup-restore').addEventListener('click', async () => {
        if (busy || !text) return;
        const sections = choices.filter(choice => choice.checked && !choice.disabled).map(choice => choice.dataset.backupSection);
        if (!sections.length) return;
        const current = ++generation;
        busy = true; update(); announce('Восстанавливаем выбранные разделы…');
        try {
            await request('import', { text, sections });
            document.dispatchEvent(new Event('rezka:backup-restored'));
            if (current !== generation) return;
            resetPreview();
            announce('Выбранные разделы восстановлены. Если странице потребуется обновление, панель предложит его после закрытия этого окна.');
            busy = false; update(); $('#backup-close').focus();
        } catch (error) { if (current === generation) announce(error.message, true); }
        finally { if (current === generation) { busy = false; update(); } }
    });
})();
