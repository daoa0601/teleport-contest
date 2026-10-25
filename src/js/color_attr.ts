// The wintype.h ATR_* enumeration stored in color_attr values (menu
// headings, pet highlighting). Kept here rather than terminal.js because the
// frozen replay adapters substitute their own terminal module.
import { ATR_BOLD, ATR_INVERSE, ATR_NONE, ATR_UNDERLINE } from './terminal.js';
import { ATR_BLINK } from './terminal_attributes.js';

export const C_ATR_NONE = 0;
export const C_ATR_BOLD = 1;
export const C_ATR_DIM = 2;
export const C_ATR_ITALIC = 3;
export const C_ATR_ULINE = 4;
export const C_ATR_BLINK = 5;
export const C_ATR_INVERSE = 7;

// That enumeration mapped onto this terminal's attribute bits; C's dim and
// italic have no representation in the recorded grid.
const C_ATTR_TERMINAL_BITS: Readonly<Record<number, number>> = {
    [C_ATR_NONE]: ATR_NONE,
    [C_ATR_BOLD]: ATR_BOLD,
    [C_ATR_DIM]: ATR_NONE,
    [C_ATR_ITALIC]: ATR_NONE,
    [C_ATR_ULINE]: ATR_UNDERLINE,
    [C_ATR_BLINK]: ATR_BLINK,
    [C_ATR_INVERSE]: ATR_INVERSE,
};

export function terminalAttrFromCAttr(attr: number): number {
    return C_ATTR_TERMINAL_BITS[attr] ?? ATR_NONE;
}
