// C pline.c:vpline(): shorten prose while retaining its last three bytes.
import { BUFSZ } from './const.js';
export function truncatePlineMessage(message) {
    const text = message.split('\0', 1)[0] ?? '';
    const bytes = new TextEncoder().encode(text);
    if (bytes.length <= BUFSZ - 1)
        return text;
    const decoder = new TextDecoder();
    return `${decoder.decode(bytes.subarray(0, BUFSZ - 7))}...${decoder.decode(bytes.subarray(-3))}`;
}
//# sourceMappingURL=pline_text.js.map