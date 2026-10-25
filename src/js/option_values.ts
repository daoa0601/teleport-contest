// Text-entered option values. C refs: options.c:optfn_*(), botl.c:parse_status_hl1().
import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { planInventoryOrder } from './object_sort.js';

export function textOptionValue(name: string): string | null {
    switch (name) {
    case 'pile_limit': return String(game.flags.pile_limit ?? 5);
    case 'menuinvertmode': return String(game.iflags.menuinvertmode ?? 1);
    case 'suppress_alert': return game.flags.suppress_alert || '(none)';
    default: return null;
    }
}

export function isTextOption(name: string): boolean {
    return ['packorder', 'pile_limit', 'menuinvertmode', 'hilite_status', 'statuslines',
        'scores', 'suppress_alert', 'statushilites'].includes(name);
}

export async function setTextOption(name: string, value: string): Promise<void> {
    if (name.length + 1 + value.length > 128) {
        await optionError('Option too long, max length is 128 characters');
        return;
    }
    value = value.trimEnd();
    switch (name) {
    case 'pile_limit': {
        if (!value) await optionError("Missing parameter for 'pile_limit:'");
        const limit = value ? cInteger(value) : 5;
        game.flags.pile_limit = limit < 0 ? 5 : limit;
        break;
    }
    case 'packorder': {
        if (!value) break;
        const change = planInventoryOrder(value);
        for (const error of change.errors) await optionError(error);
        game.flags.inv_order = change.order;
        break;
    }
    case 'menuinvertmode': {
        if (!value) break;
        const mode = cInteger(value);
        if (mode === 0 || mode === 1 || mode === 2) game.iflags.menuinvertmode = mode;
        else await optionError(`Illegal menuinvertmode parameter '${value}'`);
        break;
    }
    case 'statuslines':
        if (!value) await optionError("Missing parameter for 'statuslines:'");
        if (cInteger(value) !== 2 && cInteger(value) !== 3)
            await optionError(`'statuslines:${value}' is invalid; must be 2 or 3`);
        break;
    case 'statushilites': {
        // optfn_statushilites(): a missing value means the 3-turn default,
        // atol() of junk is 0 (off), and negative durations clamp to 1. The
        // highlight rules themselves are not part of this port, so only the
        // duration is kept; the status refresh that reset_status_hilites()
        // forces happens with the next bot().
        const delta = value ? cInteger(value) : 3;
        game.iflags.hiliteDelta = delta < 0 ? 1 : delta;
        break;
    }
    case 'hilite_status': await rejectInvalidStatusField(value); break;
    case 'suppress_alert': {
        const parsed = featureAlertVersion(value);
        if (!parsed) break;
        if (parsed.future) {
            await plineWithContinuation("You can't disable new feature alerts for future versions.");
            break;
        }
        game.flags.suppress_alert = parsed.version;
        await plineWithContinuation(`Feature change alerts disabled for NetHack ${parsed.version} features and prior.`);
        break;
    }
    }
}

export function cInteger(value: string): number {
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

export function parsePickupTypes(value: string): { symbols: string; invalid: boolean } {
    value = value.replace(/^ +/, '');
    if (/^[aA]/.test(value)) return { symbols: '', invalid: false };
    let symbols = '';
    let invalid = false;
    for (const symbol of value) {
        if (!OBJECT_CLASS_SYMBOLS.includes(symbol) || symbols.includes(symbol)) invalid = true;
        else symbols += symbol;
    }
    return { symbols, invalid };
}

// version.c:get_feature_notice_ver() validates the first two components,
// then reads the patch component with atoi. hack.h stores them in bit fields.
export function featureAlertVersion(value: string): { version: string; future: boolean } | null {
    const parts = value.match(/^(\d*)\.(\d*)\.(.*)$/);
    if (!parts) return null;
    const major = cInteger(parts[1] ?? '');
    const minor = cInteger(parts[2] ?? '');
    const patch = cInteger(parts[3] ?? '');
    if (![major, minor, patch].every(Number.isSafeInteger)) return null;
    const encoded = BigInt.asUintN(64, BigInt(major) << 24n | BigInt(minor) << 16n | BigInt(patch) << 8n);
    if (!encoded) return null;
    return {
        version: `${encoded >> 24n}.${encoded >> 16n & 255n}.${encoded >> 8n & 255n}`,
        future: encoded > 5n << 24n,
    };
}
