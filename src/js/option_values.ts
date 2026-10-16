// Text-entered option values. C refs: options.c:optfn_*(), botl.c:parse_status_hl1().
import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { changeInventoryOrder } from './object_sort.js';

export function textOptionValue(name: string): string | null {
    switch (name) {
    case 'pile_limit': return String(game.flags.pile_limit ?? 5);
    case 'menuinvertmode': return String(game.iflags.menuinvertmode ?? 1);
    default: return null;
    }
}

export function isTextOption(name: string): boolean {
    return ['packorder', 'pile_limit', 'menuinvertmode', 'hilite_status', 'statuslines', 'scores'].includes(name);
}

export async function setTextOption(name: string, value: string): Promise<void> {
    // Interactive parseoptions treats commas as part of this value. It also
    // checks the complete option, including its name, before parsing it.
    const option = `${name}:${value}`.trim();
    if (option.length > 128) {
        await optionError('Option too long, max length is 128 characters');
        return;
    }
    value = value.trimEnd();
    switch (name) {
    case 'pile_limit': {
        const limit = value ? cInteger(value) : 5;
        game.flags.pile_limit = limit < 0 ? 5 : limit;
        break;
    }
    case 'packorder':
        if (!value) {
            await optionError("Missing parameter for 'packorder:'");
            break;
        }
        for (const error of changeInventoryOrder(value)) await optionError(error);
        break;
    case 'menuinvertmode': {
        if (!value) break;
        const mode = cInteger(value);
        if (mode === 0 || mode === 1 || mode === 2) game.iflags.menuinvertmode = mode;
        else await optionError(`Illegal menuinvertmode parameter '${value}'`);
        break;
    }
    case 'statuslines':
        if (cInteger(value) !== 2 && cInteger(value) !== 3)
            await optionError(`'statuslines:${value}' is invalid; must be 2 or 3`);
        break;
    case 'hilite_status': await rejectInvalidStatusField(value); break;
    }
}

function cInteger(value: string): number {
    const prefix = value.match(/^\s*[+-]?\d+/)?.[0];
    return prefix ? Number(prefix) : 0;
}

// Rules with known fields require the unported status-highlight engine.
// Field resolution still owns the rejection before that engine is entered.
async function rejectInvalidStatusField(value: string): Promise<void> {
    if (!value) {
        await optionError('Value is mandatory for hilite_status');
        return;
    }
    const rule = value.toLowerCase().split(/ +/).find(part => part.includes('/'));
    if (!rule) return;
    const field = rule.split('/')[0] ?? '';
    const normalized = field.replace(/[ _-]/g, '');
    const canonical = [
        'title', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
        'alignment', 'score', 'carrying-capacity', 'gold', 'power', 'power-max',
        'experience-level', 'armor-class', 'HD', 'time', 'hunger', 'hitpoints',
        'hitpoints-max', 'dungeon-level', 'experience', 'condition', 'version', 'weapon', 'armor', 'terrain',
    ];
    const aliases = ['characteristics', 'encumbrance', 'experiencepoints', 'dx', 'co', 'con',
        'points', 'cap', 'pw', 'pwmax', 'xl', 'xplvl', 'ac', 'hitdice', 'turns', 'hp', 'hpmax',
        'dgn', 'xp', 'exp', 'flags'];
    const exact = canonical.some(name => name.replace(/-/g, '').toLowerCase() === normalized) || aliases.includes(normalized);
    if (!exact && canonical.filter(name => name.toLowerCase().startsWith(field)).length !== 1)
        await optionError(`Unknown status field '${field}'`);
}

// cfgfiles.c:config_erradd() adds punctuation at the interactive boundary.
export async function optionError(message: string): Promise<void> {
    await plineWithContinuation(/[.!?]$/.test(message) ? message : `${message}.`);
}
