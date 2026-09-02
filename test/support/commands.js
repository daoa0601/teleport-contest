import { rhack } from '../../js/cmd.js';
import { pushKey } from '../../js/input.js';

export async function throwInventoryObject(
    object,
    direction = 'l',
    answers = [],
) {
    pushKey(object.invlet);
    pushKey(direction);
    for (const answer of answers) pushKey(answer);
    await rhack('t'.charCodeAt(0));
}
