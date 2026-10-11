// C mthrowu.c:return_from_mtoss(). A failed catch can hurt the thrower.

import { heroArmName, monsterFootName, monsterHandName } from './body_parts.js';
import { IS_POOL, LAVAPOOL, W_WEP } from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { landFloorObject } from './floor_effects.js';
import { game, requireInitializedGame } from './gstate.js';
import { finishMonsterKilled } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { makePlural } from './object_grammar.js';
import { shipObject } from './object_migration.js';
import { rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';

interface WeaponOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
    animateReturn?: () => Promise<void>;
}

export async function returnMonsterWeapon(monster: Monster, weapon: GameObject, impactX: number, impactY: number, {
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
    animateReturn,
}: WeaponOptions = {}): Promise<void> {
    const impaired = monster.mconf || monster.mstun || monster.mblinded;
    const visible = canSeeMonster(monster);
    const name = visible
        ? monsterSentenceSubject(monster).replace(/^The /, 'the ') : 'it';
    const possessive = /s$/i.test(name) ? `${name}'` : `${name}'s`;
    const pronoun = monster.female ? 'her' : 'his';
    let x = impactX, y = impactY;

    if (random(100)) {
        await animateReturn?.();
        x = monster.mx;
        y = monster.my;
        if (!impaired && random(100)) {
            const lastMessage = state.lastMonsterWeaponReturnMessage;
            if (!lastMessage || state.moves - lastMessage > 500) {
                await publish(`The aklys returns to ${possessive} ${
                    monsterHandName(monster.mnum)
                }!`);
                state.lastMonsterWeaponReturnMessage = state.moves;
            }
            const carried = await linkObjectToMonsterInventory(monster, weapon, { state });
            if (!carried) throw new Error('A caught returning weapon must enter monster inventory');
            monster.mw = carried;
            carried.owornmask = (carried.owornmask ?? 0) | W_WEP;
            carried.worn = true;
            carried.wielded = true;
            monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_WEP;
            if (cansee(x, y)) newsym(x, y);
            return;
        }

        let damage = random(2);
        if (!damage) {
            if (visible) {
                const feet = makePlural(monsterFootName(monster.mnum));
                await publish(`The aklys returns back to ${name}, landing at ${pronoun} ${feet}.`);
            } else if (!heroIsDeaf(state)) {
                await publish(`You hear something land near ${name}.`);
            }
        } else {
            damage += rollOne(3);
            if (visible) {
                // C uses body_part(ARM), which describes the hero's form.
                await publish(`The aklys flies back toward ${name}, hitting ${pronoun} ${
                    heroArmName(state)
                }!`);
            } else if (!heroIsDeaf(state)) {
                await publish(`You hear something hit ${name} with a thud!`);
            }
            monster.mhp -= damage;
            if (monster.mhp <= 0) {
                await finishMonsterKilled(monster, state, {
                    publish, random, damageType: AD_PHYS,
                    cause: canSpotMonster(monster) ? '' : null,
                });
            }
        }
    } else if (!heroIsDeaf(state)) {
        await publish('You hear a loud snap!');
    }

    const options = { state: requireInitializedGame(state), publish, random };
    if (!await shipObject(weapon, x, y, options)) {
        const landed = await landFloorObject(weapon, x, y, options);
        if (!landed) {
            if (cansee(x, y)) newsym(x, y);
            return;
        }
    }
    if (!heroIsDeaf(state) && !state.underwater && !state.u.uinwater) {
        const terrain = state.level?.at(x, y)?.typ;
        if (terrain === undefined) throw new Error('A returning weapon must land on the current level');
        if (IS_POOL(terrain) || terrain === LAVAPOOL)
            await publish(objectWeight(weapon) > 9 ? 'Splash!' : 'Plop!');
    }
    if (cansee(x, y)) newsym(x, y);
}
