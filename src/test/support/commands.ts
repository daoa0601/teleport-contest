import type { GameObject } from '../../js/object_types.js';
import type { KeyInput } from '../../js/input.js';
import { rhack } from '../../js/cmd.js';
import { pushKey, pushKeys } from '../../js/input.js';

export function inventoryLetter(object: GameObject | string): string {
    if (typeof object === 'string') return object;
    if (!object.invlet) throw new Error('Command requires an inventory letter');
    return object.invlet;
}


export async function runExtendedCommand(command: string, answers = '') {
    pushKeys(`${command}\n${answers}`);
    await rhack('#'.charCodeAt(0));
}

export async function throwInventoryObject(
    object: GameObject,
    direction = 'l',
    answers: string | readonly KeyInput[] = [],
) {
    pushKey(inventoryLetter(object));
    pushKey(direction);
    for (const answer of answers) pushKey(answer);
    await rhack('t'.charCodeAt(0));
}

export async function applyInventoryObject(object: GameObject | string = 'a', followupKeys = '') {
    pushKey(inventoryLetter(object));
    pushKeys(followupKeys);
    await rhack('a'.charCodeAt(0));
}

export async function readInventoryObject(object: GameObject, followupKeys = '') {
    pushKey(inventoryLetter(object));
    pushKeys(followupKeys);
    await rhack('r'.charCodeAt(0));
}

export async function runMonsterAbilityCommand(followupKeys = '') {
    pushKeys(`monster\n${followupKeys}`);
    await rhack('#'.charCodeAt(0));
}

export async function invokeInventoryObject(object: GameObject | string = 'a', followupKeys = '') {
    const letter = inventoryLetter(object);
    pushKeys(`invoke\n${letter}${followupKeys}`);
    await rhack('#'.charCodeAt(0));
}

export async function dropInventoryObject(object: GameObject | string = 'a', followupKeys = '') {
    const letter = inventoryLetter(object);
    pushKey(letter);
    pushKeys(followupKeys);
    await rhack('d'.charCodeAt(0));
}

export async function kickDirection(direction = 'l', answers: string | readonly KeyInput[] = []) {
    pushKey(direction);
    for (const answer of answers) pushKey(answer);
    await rhack(4);
}
