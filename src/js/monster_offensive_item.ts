// Native muse.c:use_offensive(). Selection belongs to find_offensive(); each
// selected object is still carried until its own effect consumes or throws it.
import { heroResistsBlindingLight } from './blinding_attack.js';
import { DOOR, D_CLOSED, D_LOCKED, IS_AIR, IS_OBSTRUCTED, isok } from './const.js';
import { canSeeMonster, canSpotMonster, map_invisible, plineWithContinuation } from './display.js';
import { dropBoulderOnHero, dropBoulderOnMonster } from './falling_boulder.js';
import { requireLiveGame } from './gstate.js';
import { distmin } from './hacklib.js';
import { inventoryItemDescription } from './invent.js';
import { lightDamage } from './light.js';
import {
    checkMonsterWandBackfire, consumeMonsterItem, presentMonsterHornUse,
    presentMonsterScrollRead, presentMonsterWandUse,
} from './monster_item_use.js';
import { monsterName } from './monster_name.js';
import { throwMonsterProjectile } from './monster_throw.js';
import { resolveMonsterImmediateWand } from './monster_wand_ray.js';
import { FIRE_HORN, FROST_HORN, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_STRIKING } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { objectCombatName, observeObjectForNaming } from './objnam.js';
import { castNativeRay } from './ray_attack.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { ceilingName } from './terrain_name.js';
import { cansee } from './vision.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';
import type { MonsterOffensiveChoice, MonsterOffensiveOptions, MonsterOffensiveResult } from './monster_offensive_types.js';

export async function useMonsterOffensiveItem(
    monster: Monster, choice: MonsterOffensiveChoice, options: MonsterOffensiveOptions,
): Promise<MonsterOffensiveResult> {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    requireLiveGame(state);
    const object = choice.object;
    const forceMiss = !monster.mwandexp;
    if (object.oclass !== 8) {
        const backfire = await checkMonsterWandBackfire(monster, object, options);
        if (backfire.exploded)
            return { nativeResult: backfire.nativeResult, heroDied: backfire.heroDied };
    }
    const seen = canSeeMonster(monster);
    switch (choice.kind) {
    case 'ray-wand': case 'horn': {
        let rayType: number;
        let dice: number;
        if (choice.kind === 'ray-wand') {
            if (object.otyp < WAN_MAGIC_MISSILE || object.otyp > WAN_LIGHTNING)
                throw new RangeError(`Selected offensive wand ${object.otyp} is not a ray wand`);
            await presentMonsterWandUse(monster, object, options);
            if (seen) learnObjectType(object.otyp, state);
            rayType = object.otyp - WAN_MAGIC_MISSILE;
            dice = object.otyp === WAN_MAGIC_MISSILE ? 2 : 6;
        } else {
            if (object.otyp !== FIRE_HORN && object.otyp !== FROST_HORN)
                throw new RangeError(`Selected offensive horn ${object.otyp} cannot emit a ray`);
            await presentMonsterHornUse(monster, object, options);
            rayType = object.otyp === FROST_HORN ? 2 : 1;
            dice = 6 + random(6);
        }
        const direction = aimedDirection(monster);
        const ray = await castNativeRay(-30 - rayType, dice, direction, {
            state, sourceMonster: monster, sourceObject: object,
            originX: monster.mx, originY: monster.my,
            publish, random, rollOne, rollDice, forceMiss,
        });
        if (!ray.heroDied) monster.mwandexp = true;
        return { nativeResult: monster.mhp <= 0 || monster.dead ? 1 : 2, heroDied: ray.heroDied };
    }
    case 'immediate-wand': {
        const previousSeen = state.context.zap_oseen;
        state.context.zap_oseen = seen;
        try {
            await presentMonsterWandUse(monster, object, options);
            const result = await resolveMonsterImmediateWand(monster, object, options);
            if (!result.heroDied && object.otyp === WAN_STRIKING) monster.mwandexp = true;
            return { nativeResult: 2, heroDied: result.heroDied };
        } finally {
            if (previousSeen === undefined) delete state.context.zap_oseen;
            else state.context.zap_oseen = previousSeen;
        }
    }
    case 'potion': {
        if (cansee(monster.mx, monster.my)) {
            observeObject(object, state);
            const subject = monsterName(monster, { state, capitalized: true });
            observeObjectForNaming(object, { state });
            const name = inventoryItemDescription({ ...object, quan: 1, quantity: 1 });
            await publish(`${subject} hurls ${name}!`);
        }
        const target = aimedPosition(monster);
        const shot = await throwMonsterProjectile(monster, object, {
            state, dx: Math.sign(target.x - monster.mx), dy: Math.sign(target.y - monster.my),
            range: distmin(monster.mx, monster.my, target.x, target.y),
            publish, random, rollOne, rollDice,
        });
        return { nativeResult: 2, heroDied: shot.heroDied };
    }
    case 'earth-scroll': return await readMonsterEarthScroll(monster, object, seen, options);
    case 'camera': return await photographHero(monster, object, options);
    }
}

async function readMonsterEarthScroll(
    monster: Monster, scroll: GameObject, seen: boolean, options: MonsterOffensiveOptions,
): Promise<MonsterOffensiveResult> {
    const { state, publish = plineWithContinuation } = options;
    const confused = !!monster.mconf;
    const x = monster.mx, y = monster.my;
    const cursed = !!scroll.cursed, blessed = !!scroll.blessed;
    await presentMonsterScrollRead(monster, scroll, options);
    if (canSpotMonster(monster)) {
        await publish(`The ${ceilingName(x, y, state)} rumbles ${blessed ? 'around' : 'above'} ${monsterName(monster, { state })}!`);
        if (seen) learnObjectType(scroll.otyp, state);
    } else if (cansee(x, y)) {
        await publish(`The ${ceilingName(x, y, state)} rumbles in the middle of nowhere!`);
        if (monster.minvis) map_invisible(x, y);
        if (seen) learnObjectType(scroll.otyp, state);
    }
    // The caster can die under the central boulder. Consume before drops so
    // its death cannot put the used scroll back onto the floor.
    await consumeMonsterItem(monster, scroll, state);
    for (let column = x - 1; column <= x + 1; column++) {
        for (let row = y - 1; row <= y + 1; row++) {
            if (!isok(column, row) || column === state.u.ux && row === state.u.uy) continue;
            const location = state.level.at(column, row);
            if (!location || IS_OBSTRUCTED(location.typ) || IS_AIR(location.typ)
                || location.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED))) continue;
            if (column === x && row === y ? blessed : cursed) continue;
            const drop = await dropBoulderOnMonster(column, row, { state, confused, heroCaused: false });
            if (drop.heroDied) return { nativeResult: 1, heroDied: true };
        }
    }
    if (distmin(x, y, state.u.ux, state.u.uy) === 1 && !cursed) {
        const drop = await dropBoulderOnHero({ state, confused, helmetProtects: true, heroCaused: false, skipSwallower: true });
        if (drop.heroDied) return { nativeResult: 1, heroDied: true };
    }
    return { nativeResult: monster.mhp <= 0 || monster.dead ? 1 : 2, heroDied: false };
}

async function photographHero(
    monster: Monster, camera: GameObject, { state, publish = plineWithContinuation, rollOne = rnd }: MonsterOffensiveOptions,
): Promise<MonsterOffensiveResult> {
    if (heroIsHallucinating(state)) await publish('"Say cheese!"');
    else if (!heroIsBlind(state)) {
        const subject = monsterName(monster, { state, capitalized: true });
        const name = withIndefiniteArticle(objectCombatName(camera, { state }));
        await publish(`${subject} takes a picture of you with ${name}!`);
    }
    if (!heroIsBlind(state) && !heroResistsBlindingLight(state)) {
        await publish('You are blinded by the flash of light!');
        await makeBlinded((state.u.blindTurns ?? 0) + rollOne(51), { state, talk: false, publish });
    }
    await lightDamage(camera, true, 5, { state });
    if (!state.program_state.gameover) camera.spe--;
    // Native use_offensive returns one here even if the photographer lives.
    return { nativeResult: 1, heroDied: !!state.program_state.gameover };
}

function aimedDirection(monster: Monster): string {
    const target = aimedPosition(monster);
    const dx = Math.sign(target.x - monster.mx), dy = Math.sign(target.y - monster.my);
    if (dy < 0) return dx < 0 ? 'y' : dx > 0 ? 'u' : 'k';
    if (dy > 0) return dx < 0 ? 'b' : dx > 0 ? 'n' : 'j';
    return dx < 0 ? 'h' : dx > 0 ? 'l' : '>';
}

function aimedPosition(monster: Monster): Position {
    if (monster.mux === undefined || monster.muy === undefined)
        throw new Error('An offensive item user must have its remembered hero position');
    return { x: monster.mux, y: monster.muy };
}
