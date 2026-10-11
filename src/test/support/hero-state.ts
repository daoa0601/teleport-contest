import type { Hero, HeroSkill } from '../../js/hero_types.js';
import type { Monster } from '../../js/monster_types.js';
import type { AttributeValues } from '../../js/roles.js';
import { roles, races } from '../../js/roles.js';
import type { ObjectRoomOptions } from './object-room.js';
import { game, requirePlayingGame } from '../../js/gstate.js';
import { wearHeroAccessory } from '../../js/accessory.js';
import { setHeroSpecies } from '../../js/hero_species.js';
import { addBuriedObject } from '../../js/buried_object.js';
import { unplaceBallAndChain } from '../../js/ball.js';
import { swallowed } from '../../js/display.js';
import { vision_recalc } from '../../js/vision.js';
import { refreshMovementProperties } from '../../js/properties.js';
import {
    A_INT, A_WIS, P_EXPERT, P_NUM_SKILLS, TT_BURIEDBALL, W_BALL, W_CHAIN,
} from '../../js/const.js';
import { placeCreatedObject } from '../../js/floor_object.js';
import { MONSTER_NAME } from '../../js/monster_data.js';
import {
    HEAVY_IRON_BALL, IRON_CHAIN, RIN_POLYMORPH_CONTROL,
} from '../../js/object_data.js';
import { addInventoryObject, knownObject } from './game-objects.js';
import { freshObjectRoom } from './object-room.js';

export interface PolymorphedHeroOptions extends Partial<Pick<Hero,
    'uen' | 'uenmax' | 'blindTurns' | 'halfPhysicalDamage' | 'unchanging'>> {
    turns?: number; hitPoints?: number; maxHitPoints?: number;
}
export interface PolymorphedRoomOptions extends ObjectRoomOptions {
    polymorph?: PolymorphedHeroOptions;
}
export interface MonsterAbilityRoomOptions extends PolymorphedRoomOptions { energy?: number }


const PM_WEREWOLF = 21;
const PM_HUMAN_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');

export function freshCasterRoom({ role = 'wizard', energy = 40, ...room }: ObjectRoomOptions & { energy?: number } = {}) {
    const level = freshObjectRoom({
        ...room, role,
        hero: { ulevel: 30, uen: energy, uenmax: energy },
    });
    requirePlayingGame(game);
    for (const attribute of [A_INT, A_WIS]) {
        game.u.acurr.a[attribute] = 18;
        game.u.amax.a[attribute] = 18;
    }
    return level;
}

export function installHeroWeaponSkills(levelBySkill: Readonly<Partial<Record<number, number>>>, maximumLevel = P_EXPERT) {
    requirePlayingGame(game);
    const skills: HeroSkill[] = Array.from({ length: P_NUM_SKILLS }, () => ({
        skill: 0,
        maxSkill: 0,
        advance: 0,
    }));
    for (const [skill, level] of Object.entries(levelBySkill)) {
        if (level === undefined) continue;
        skills[Number(skill)] = {
            skill: level,
            maxSkill: maximumLevel,
            advance: 0,
        };
    }
    game.u.weaponSkills = skills;
    return skills;
}

export function installPolymorphedHero(formName: string, {
    turns = 100,
    hitPoints = 40,
    maxHitPoints = hitPoints,
    uen, uenmax, blindTurns, halfPhysicalDamage, unchanging,
}: PolymorphedHeroOptions = {}) {
    requirePlayingGame(game);
    game.u.mtimedone = turns;
    game.u.mh = hitPoints;
    game.u.mhmax = maxHitPoints;
    if (uen !== undefined) game.u.uen = uen;
    if (uenmax !== undefined) game.u.uenmax = uenmax;
    if (blindTurns !== undefined) game.u.blindTurns = blindTurns;
    if (halfPhysicalDamage !== undefined) game.u.halfPhysicalDamage = halfPhysicalDamage;
    if (unchanging !== undefined) game.u.unchanging = unchanging;
    setHeroSpecies(MONSTER_NAME.indexOf(formName), game);
    return game.u;
}

export function freshRoomWithPolymorphedHero(formName: string, {
    polymorph = {},
    ...room
}: PolymorphedRoomOptions = {}) {
    const level = freshObjectRoom(room);
    installPolymorphedHero(formName, polymorph);
    game.context.move = 0;
    return level;
}

export function freshMonsterAbilityRoom(formName: string, {
    energy,
    polymorph = {},
    ...room
}: MonsterAbilityRoomOptions = {}) {
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

export function freshHeroConditionRoom(options: ObjectRoomOptions = {}) {
    return freshObjectRoom({
        heroX: 13,
        heroY: 10,
        recalculateVision: false,
        ...options,
    });
}

export function installHumanWerewolfHero({ beast = false } = {}) {
    requirePlayingGame(game);
    const attributes: AttributeValues = [12, 12, 12, 12, 12, 12];
    const role = roles.find(candidate => candidate.key === 'archeologist');
    const race = races.find(candidate => candidate.name === 'human');
    if (!role || !race) throw new Error('The native archeologist and human records are required');
    game.urole = role;
    game.urace = race;
    game.flags = { ...game.flags, female: false };
    game.u.umonster = PM_HUMAN_ARCHEOLOGIST;
    game.u.umonnum = beast ? PM_WEREWOLF : PM_HUMAN_ARCHEOLOGIST;
    game.u.ulycn = PM_WEREWOLF;
    game.u.mtimedone = beast ? 350 : 0;
    game.u.mh = beast ? 18 : 0;
    game.u.mhmax = beast ? 24 : 0;
    game.u.uhp = 40;
    game.u.uhpmax = 40;
    game.u.acurr = { a: [...attributes] };
    game.u.amax = { a: [...attributes] };
    game.u.macurr = { a: [...attributes] };
    game.u.mamax = { a: [...attributes] };
    setHeroSpecies(game.u.umonnum, game);
    return game.u;
}

export async function wearPolymorphControlRing() {
    const ring = await addInventoryObject(RIN_POLYMORPH_CONTROL);
    await wearHeroAccessory(ring, 'uright');
    return ring;
}

export async function installPunishedHero() {
    const ball = await knownObject(HEAVY_IRON_BALL, { owornmask: W_BALL });
    const chain = await knownObject(IRON_CHAIN, { owornmask: W_CHAIN });
    placeCreatedObject(ball, game.u.ux, game.u.uy);
    placeCreatedObject(chain, game.u.ux, game.u.uy);
    game.uball = game.u.uball = ball;
    game.uchain = game.u.uchain = chain;
    game.u.punished = true;
    return { ball, chain };
}

export async function installHeroChainedToBuriedBall({
    x = game.u.ux,
    y = game.u.uy,
    turns = 40,
} = {}) {
    const ball = await knownObject(HEAVY_IRON_BALL);
    addBuriedObject(ball, x, y);
    game.u.utrap = turns;
    game.u.utraptype = TT_BURIEDBALL;
    refreshMovementProperties(game);
    return ball;
}

export function installSwallowedHero(monster: Monster, turns = 10) {
    unplaceBallAndChain();
    monster.mx = game.u.ux;
    monster.my = game.u.uy;
    monster.mtrapped = 0;
    vision_recalc(2);
    game.u.ustuck = monster;
    game.u.uswallow = 1;
    game.u.uswldtim = turns;
    game.vision_full_recalc = 1;
    swallowed(true);
}
