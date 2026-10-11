import { itemAt } from './session-types.mjs';
import type { Cursor, DriverConfig, PolicyConfig, SessionAction, SessionDriver } from './session-types.mjs';

function visibleLines(lines: readonly string[]) {
    return (lines || []).map(line => String(line)
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/[\x0e\x0f]/g, ''));
}
function validateActions(actions: readonly SessionAction[]) {
    if (actions.length === 0) throw new Error('session driver needs at least one action');
    for (const action of actions) {
        if (action.type === 'select-menu-entry' && !action.target.trim()) {
            throw new Error('driver menu action needs a target');
        }
    }
}

export function createSessionDriver(actions: SessionAction[]): SessionDriver;
export function createSessionDriver(actions: PolicyConfig): Promise<SessionDriver>;
export function createSessionDriver(actions: DriverConfig): SessionDriver | Promise<SessionDriver>;
export function createSessionDriver(actions: DriverConfig): SessionDriver | Promise<SessionDriver> {
    if (!Array.isArray(actions)) {
        return import('./holdout-policy.mjs').then(({ createHoldoutPolicy }) => {
            const policy = createHoldoutPolicy(actions);
            if (!actions.setup) return policy;
            const setup = createSessionDriver(actions.setup);
            let settingUp = true;
            return {
                nextKey(lines: readonly string[], info?: { cursor?: Cursor }) {
                    if (settingUp) {
                        const key = setup.nextKey(lines, info);
                        if (key !== null) return key;
                        settingUp = false;
                    }
                    return policy.nextKey(lines, info);
                },
                get exhausted() { return !settingUp && policy.exhausted; },
                get acceptsGameExit() { return !settingUp && policy.acceptsGameExit === true; },
                get summary() { return { ...policy.summary, setupComplete: !settingUp }; },
            };
        });
    }
    validateActions(actions);
    let actionIndex = 0;
    let keyIndex = 0;
    let menuPages = 0;
    let morePages = 0;

    const nextKey = (lines: readonly string[]) => {
        const pending = actions[actionIndex] ?? itemAt(actions, actions.length - 1);
        if (pending.dismissMore && visibleLines(lines).some(line => line.includes('--More--'))) {
            if (++morePages > 1024) throw new Error('session message pagination did not finish');
            return ' ';
        }
        morePages = 0;
        while (actionIndex < actions.length) {
            const action = itemAt(actions, actionIndex);
            if (action.type === 'keys') {
                if (keyIndex >= action.value.length) {
                    actionIndex++;
                    keyIndex = 0;
                    continue;
                }
                const key = action.value.charAt(keyIndex++);
                if (keyIndex >= action.value.length) {
                    actionIndex++;
                    keyIndex = 0;
                }
                return key;
            }

            const openKeys = action.openKeys ?? `m\x16`;
            if (keyIndex < openKeys.length) return openKeys.charAt(keyIndex++);
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
        get expectsExit() { return actionIndex >= actions.length && actions.at(-1)?.expectExit === true; },
    };
}
