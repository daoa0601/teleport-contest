// C options.c:msgtype_parse_add(), msgtype_type(), hide_unhide_msgtypes().
import { PosixRegex } from './posix_regex.js';
import { MSGTYP_NORMAL, MSGTYP_NOREP, MSGTYP_NOSHOW, MSGTYP_STOP } from './const.js';

type MessageType = typeof MSGTYP_NORMAL | typeof MSGTYP_NOREP
    | typeof MSGTYP_NOSHOW | typeof MSGTYP_STOP;

export interface MessageTypeRule {
    type: MessageType;
    pattern: PosixRegex;
    disabled: boolean;
}

const MESSAGE_TYPES: ReadonlyArray<readonly [string, MessageType]> = [
    ['show', MSGTYP_NORMAL], ['hide', MSGTYP_NOSHOW], ['noshow', MSGTYP_NOSHOW],
    ['stop', MSGTYP_STOP], ['more', MSGTYP_STOP], ['norep', MSGTYP_NOREP],
];

export function addMessageTypeRule(value: string, rules: MessageTypeRule[]): string | null {
    // sscanf() accepts a ten-character type and up to 255 pattern characters;
    // the closing quote and trailing input do not affect its two conversions.
    const match = value.match(/^\s*(\S{1,10})\s+"([^"]{1,255})/);
    if (!match?.[1] || !match[2]) return 'Malformed MSGTYPE';
    const name = match[1];
    const entry = MESSAGE_TYPES.find(([type]) => type.startsWith(name.toLowerCase()));
    if (!entry) return `Unknown message type '${name}'`;
    try {
        rules.unshift({ type: entry[1], pattern: new PosixRegex(match[2]), disabled: false });
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return `MSGTYPE regex error: ${error.message}`;
    }
    return null;
}

export function messageTypeFor(
    text: string, noRepeat: boolean, rules: readonly MessageTypeRule[] = [],
): MessageType {
    const rule = rules.find(entry => entry.pattern.test(text));
    if (!rule) return noRepeat ? MSGTYP_NOREP : MSGTYP_NORMAL;
    // A disabled matching rule still wins over older rules and Norep().
    return rule.disabled ? MSGTYP_NORMAL : rule.type;
}

export function hideUnhideMessageTypes(
    hide: boolean, mask: number, rules: readonly MessageTypeRule[] = [],
): void {
    for (const rule of rules) {
        if (rule.type !== MSGTYP_NORMAL && ((1 << rule.type) & mask)) rule.disabled = hide;
    }
}
