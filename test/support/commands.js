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

export async function applyInventoryObject(object = 'a', followupKeys = '') {
    pushKey(typeof object === 'string' ? object : object.invlet);
    pushKeys(followupKeys);
    await rhack('a'.charCodeAt(0));
}

export async function runMonsterAbilityCommand(followupKeys = '') {
    pushKeys(`monster\n${followupKeys}`);
    await rhack('#'.charCodeAt(0));
}

export async function invokeInventoryObject(object = 'a', followupKeys = '') {
    const letter = typeof object === 'string' ? object : object.invlet;
    pushKeys(`invoke\n${letter}${followupKeys}`);
    await rhack('#'.charCodeAt(0));
}

export async function dropInventoryObject(object = 'a', followupKeys = '') {
    const letter = typeof object === 'string' ? object : object.invlet;
    pushKey(letter);
    pushKeys(followupKeys);
    await rhack('d'.charCodeAt(0));
}

export async function kickDirection(direction = 'l', answers = []) {
    pushKey(direction);
    for (const answer of answers) pushKey(answer);
    await rhack(4);
}
