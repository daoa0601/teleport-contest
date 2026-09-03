import { game } from '../../js/gstate.js';
import {
    P_EXPERT, P_NUM_SKILLS, W_BALL, W_CHAIN, W_RINGR,
} from '../../js/const.js';
import { place_object } from '../../js/floor_object.js';
import { MONSTER_NAME } from '../../js/monster_data.js';
import {
    HEAVY_IRON_BALL, IRON_CHAIN, RIN_POLYMORPH_CONTROL,
} from '../../js/object_data.js';
import { addInventoryObject, knownObject } from './game-objects.js';
import { freshObjectRoom } from './object-room.js';

const PM_WEREWOLF = 21;
const PM_HUMAN_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');

export function installHeroWeaponSkills(levelBySkill, maximumLevel = P_EXPERT) {
    const skills = Array.from({ length: P_NUM_SKILLS }, () => ({
        skill: 0,
        maxSkill: 0,
        advance: 0,
    }));
    for (const [skill, level] of Object.entries(levelBySkill)) {
        skills[skill] = {
            skill: level,
            maxSkill: maximumLevel,
            advance: 0,
        };
    }
    game.u.weaponSkills = skills;
    return skills;
}

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

export function freshRoomWithPolymorphedHero(formName, {
    polymorph = {},
    ...room
} = {}) {
    const level = freshObjectRoom(room);
    installPolymorphedHero(formName, polymorph);
    game.context.move = 0;
    return level;
}

export function freshMonsterAbilityRoom(formName, {
    energy,
    polymorph = {},
    ...room
} = {}) {
    const energyState = energy === undefined ? {} : {
        uen: energy,
        uenmax: energy,
    };
    return freshRoomWithPolymorphedHero(formName, {
        left: 2,
        right: 30,
        top: 4,
        bottom: 16,
        heroX: 10,
        heroY: 10,
        ...room,
        polymorph: {
            ...energyState,
            ...polymorph,
        },
    });
}

export function freshHeroConditionRoom(options = {}) {
    return freshObjectRoom({
        heroX: 13,
        heroY: 10,
        recalculateVision: false,
        ...options,
    });
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

export function wearPolymorphControlRing() {
    return wearHeroObject(
        addInventoryObject(RIN_POLYMORPH_CONTROL),
        'uright',
        W_RINGR,
    );
}

export function installPunishedHero() {
    const ball = knownObject(HEAVY_IRON_BALL, { owornmask: W_BALL });
    const chain = knownObject(IRON_CHAIN, { owornmask: W_CHAIN });
    place_object(ball, game.u.ux, game.u.uy);
    place_object(chain, game.u.ux, game.u.uy);
    game.uball = game.u.uball = ball;
    game.uchain = game.u.uchain = chain;
    game.u.punished = true;
    return { ball, chain };
}
