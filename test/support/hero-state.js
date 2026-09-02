import { game } from '../../js/gstate.js';
import { MONSTER_NAME } from '../../js/monster_data.js';

const PM_WEREWOLF = 21;
const PM_HUMAN_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');

export function installPolymorphedHero(formName, {
    turns = 100,
    hitPoints = 40,
    maxHitPoints = hitPoints,
    ...overrides
} = {}) {
    Object.assign(game.u, {
        umonster: PM_HUMAN_ARCHEOLOGIST,
        umonnum: MONSTER_NAME.indexOf(formName),
        mtimedone: turns,
        mh: hitPoints,
        mhmax: maxHitPoints,
        ...overrides,
    });
    return game.u;
}

export function installHumanWerewolfHero({ beast = false } = {}) {
    const attributes = Array(6).fill(12);
    game.urole = { key: 'archeologist', mnum: 0 };
    game.urace = {
        name: 'human', noun: 'human', adj: 'human', mnum: 260,
    };
    game.flags = { ...game.flags, female: false };
    Object.assign(game.u, {
        umonster: PM_HUMAN_ARCHEOLOGIST,
        umonnum: beast ? PM_WEREWOLF : PM_HUMAN_ARCHEOLOGIST,
        ulycn: PM_WEREWOLF,
        mtimedone: beast ? 350 : 0,
        mh: beast ? 18 : 0,
        mhmax: beast ? 24 : 0,
        uhp: 40,
        uhpmax: 40,
        acurr: { a: attributes.slice() },
        amax: { a: attributes.slice() },
        macurr: { a: attributes.slice() },
        mamax: { a: attributes.slice() },
    });
    return game.u;
}

export function wearHeroObject(object, slot, mask) {
    object.worn = true;
    object.wornSlot = slot;
    object.owornmask = mask;
    game[slot] = object;
    game.u[slot] = object;
    return object;
}
