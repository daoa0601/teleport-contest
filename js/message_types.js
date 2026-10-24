// C options.c:msgtype_parse_add(), msgtype_type(), hide_unhide_msgtypes().
import { PosixRegex } from './posix_regex.js';
import { MSGTYP_NORMAL, MSGTYP_NOREP, MSGTYP_NOSHOW, MSGTYP_STOP } from './const.js';
const MESSAGE_TYPES = [
    ['show', MSGTYP_NORMAL], ['hide', MSGTYP_NOSHOW], ['noshow', MSGTYP_NOSHOW],
    ['stop', MSGTYP_STOP], ['more', MSGTYP_STOP], ['norep', MSGTYP_NOREP],
];
export function addMessageTypeRule(value, rules) {
    // sscanf() accepts a ten-character type and up to 255 pattern characters;
    // the closing quote and trailing input do not affect its two conversions.
    const match = value.match(/^\s*(\S{1,10})\s+"([^"]{1,255})/);
    if (!match?.[1] || !match[2])
        return 'Malformed MSGTYPE';
    const name = match[1];
    const entry = MESSAGE_TYPES.find(([type]) => type.startsWith(name.toLowerCase()));
    if (!entry)
        return `Unknown message type '${name}'`;
    try {
        rules.unshift({ type: entry[1], pattern: new PosixRegex(match[2]), disabled: false });
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        return `MSGTYPE regex error: ${error.message}`;
    }
    return null;
}
export function messageTypeFor(text, noRepeat, rules = []) {
    const rule = rules.find(entry => entry.pattern.test(text));
    if (!rule)
        return noRepeat ? MSGTYP_NOREP : MSGTYP_NORMAL;
    // A disabled matching rule still wins over older rules and Norep().
    return rule.disabled ? MSGTYP_NORMAL : rule.type;
}
export function hideUnhideMessageTypes(hide, mask, rules = []) {
    for (const rule of rules) {
        if (rule.type !== MSGTYP_NORMAL && ((1 << rule.type) & mask))
            rule.disabled = hide;
    }
}
//# sourceMappingURL=message_types.js.map