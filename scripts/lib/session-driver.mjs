function visibleLines(lines) {
    return (lines || []).map(line => String(line)
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/[\x0e\x0f]/g, ''));
}
function validateActions(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
        throw new Error('session driver needs at least one action');
    }
    for (const action of actions) {
        if (action?.type === 'keys') {
            if (typeof action.value !== 'string') {
                throw new Error('driver keys action needs a string value');
            }
        } else if (action?.type === 'select-menu-entry') {
            if (typeof action.target !== 'string' || !action.target.trim()) {
                throw new Error('driver menu action needs a target');
            }
            if (action.openKeys !== undefined && typeof action.openKeys !== 'string') {
                throw new Error('driver menu openKeys must be a string');
            }
        } else {
            throw new Error(`unsupported session driver action: ${action?.type}`);
        }
    }
}

export function createSessionDriver(actions) {
    validateActions(actions);
    let actionIndex = 0;
    let keyIndex = 0;
    let menuPages = 0;

    const nextKey = lines => {
        while (actionIndex < actions.length) {
            const action = actions[actionIndex];
            if (action.type === 'keys') {
                if (keyIndex >= action.value.length) {
                    actionIndex++;
                    keyIndex = 0;
                    continue;
                }
                const key = action.value[keyIndex++];
                if (keyIndex >= action.value.length) {
                    actionIndex++;
                    keyIndex = 0;
                }
                return key;
            }

            const openKeys = action.openKeys ?? `m\x16`;
            if (keyIndex < openKeys.length) return openKeys[keyIndex++];
            const rendered = visibleLines(lines);
            const target = action.target.toLowerCase();
            for (const line of rendered) {
                if (!line.toLowerCase().includes(target)) continue;
                const selector = line.match(/^\s*([a-zA-Z])\s*-\s+/)?.[1];
                if (!selector) {
                    throw new Error('named dungeon destination is not selectable');
                }
                actionIndex++;
                keyIndex = 0;
                menuPages = 0;
                return selector;
            }
            const page = rendered.join('\n').match(/\((\d+)\s+of\s+(\d+)\)/i);
            if (!page) throw new Error('dungeon destination menu did not open');
            if (Number(page[1]) >= Number(page[2])) {
                throw new Error('named dungeon destination is absent from the menu');
            }
            if (++menuPages > 8) throw new Error('dungeon destination menu pagination loop');
            return ' ';
        }
        return null;
    };

    return {
        nextKey,
        get exhausted() { return actionIndex >= actions.length; },
    };
}
