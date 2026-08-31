// Messages caused by monster traps. Movement changes stay in monmove.js.

import { monsterArmName } from './body_parts.js';
import { OBJECT_NAMES } from './object_data.js';

function resolveSubject(subject, monster) {
    return typeof subject === 'function' ? subject(monster) : subject;
}

export async function presentMonsterWebTrap({
    event,
    monster,
    visible = false,
    subject = 'The monster',
    announce = async () => {},
}) {
    if (event?.kind !== 'web-trap')
        return { handled: false, presented: false, message: '' };
    if (!visible)
        return { handled: true, presented: false, message: '' };

    const message = `${resolveSubject(subject, monster)
        || 'The monster'} is caught in a spider web.`;
    await announce(message);
    return { handled: true, presented: true, message };
}

function lowerFirst(text) {
    return text[0].toLowerCase() + text.slice(1);
}

function possessive(text) {
    return /s$/i.test(text) ? `${text}'` : `${text}'s`;
}

export async function presentMonsterRustTrap({
    event,
    monster,
    visible = false,
    subject = 'The monster',
    announce = async () => {},
}) {
    if (event?.kind !== 'rust-trap') return false;
    if (!visible) return true;

    const name = resolveSubject(subject, monster) || 'The monster';
    const lowerName = lowerFirst(name);
    const owner = possessive(name);
    const lowerOwner = lowerFirst(owner);
    const arm = monsterArmName(monster.mnum);
    const hit = event.target === 'head'
        ? `A gush of water hits ${lowerName} on the head!`
        : event.target === 'left-arm'
            ? `A gush of water hits ${lowerOwner} left ${arm}!`
            : event.target === 'right-arm'
                ? `A gush of water hits ${lowerOwner} right ${arm}!`
                : `A gush of water hits ${lowerName}!`;
    await announce(hit);

    for (const effect of event.effects) {
        const objectName = effect.description
            || OBJECT_NAMES[effect.object?.otyp]
            || effect.object?.name || 'object';
        if (effect.kind === 'grease-protected') {
            await announce(
                `${owner} ${objectName} is protected by the layer of grease!`,
            );
        } else if (effect.kind === 'rustproof') {
            await announce(
                `Somehow, ${lowerOwner} ${objectName} is not affected by the oxidation.`,
            );
        } else if (effect.kind === 'rusted') {
            const adverb = effect.erosion === 3
                ? ' completely' : effect.erosion > 1 ? ' further' : '';
            await announce(`${owner} ${objectName} rusts${adverb}!`);
        } else if (effect.kind === 'lantern-flickers') {
            await announce(`${owner} ${objectName} crackles and flickers.`);
        } else if (effect.kind === 'extinguished') {
            await announce(`${owner} ${objectName} goes out!`);
        }
    }
    if (event.completelyRusted) {
        await announce(`${name} falls to pieces!`);
    } else if (event.clone) {
        await announce(`${name} multiplies!`);
    }
    return true;
}
