import { rhack } from '../../js/cmd.js';
import { pushKey, pushKeys } from '../../js/input.js';

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

export async function applyInventoryObject(object) {
    pushKey(typeof object === 'string' ? object : object.invlet);
    await rhack('a'.charCodeAt(0));
}

export async function runMonsterAbilityCommand(followupKeys = '') {
    pushKeys(`monster\n${followupKeys}`);
    await rhack('#'.charCodeAt(0));
}
