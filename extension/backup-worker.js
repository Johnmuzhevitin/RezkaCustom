// Import shares the settings write queue and uses one set, without clearing other data.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rezka:backup') return;
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
    const run = async () => {
        if (message.action === 'preview') return RezkaBackup.summary(RezkaBackup.parse(message.text));
        if (message.action === 'export') {
            let stored;
            try { stored = await chrome.storage.local.get(null); }
            catch { throw new Error('Не удалось прочитать данные. Попробуйте скачать копию ещё раз.'); }
            const backup = RezkaBackup.snapshot(stored, REZKA_BUILD.version);
            const text = RezkaBackup.boundedText(JSON.stringify(backup, null, 2));
            return { text, filename: `rezka-custom-${backup.exportedAt.slice(0, 10)}.json` };
        }
        if (message.action === 'import') {
            const backup = RezkaBackup.parse(message.text);
            const updates = RezkaBackup.plan(backup, message.sections);
            try { await chrome.storage.local.set(updates); }
            catch { throw new Error('Не удалось сохранить копию. Возможно, недостаточно места. Повторите попытку.'); }
            return { sections: message.sections };
        }
        throw new Error('Неизвестное действие с резервной копией.');
    };
    const result = message.action === 'preview' ? Promise.resolve().then(run)
        : (settingsWrites = settingsWrites.catch(() => {}).then(run));
    result.then(value => respond({ ok: true, ...value }), error => respond({ ok: false, error: error.message }));
    return true;
});
