// C mhitu.c:mattacku() lines 551-706: a monster that reaches a concealed
// hero reveals the hero instead of attacking. Two separate branches:
//   u.uundetected — a hiding hero; ceiling hiders (piercer, lurker above)
//     drop on the attacker and swap squares, surface hiders are merely
//     pointed out;
//   S_MIMIC with an appearance — a hero polymorphed into a mimic that
//     mimicked something via #monster; sticky forms grab the attacker.

import { objectIsHardHelmet } from './armor.js';
import { M_AP_NOTHING, W_ARMH } from './const.js';
import type { MessagePublisher } from './display.js';
import { canSeeMonster, canSpotMonster, map_invisible, newsym, plineWithContinuation } from './display.js';
import { impossible } from './diagnostics.js';
import type { GameState } from './game_state.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { setHeroGrip } from './hero_grip.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import type { MonsterCallLog, RandomBelow, RollDice, RollOne } from './monster_action_types.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { findMonsterArmorClass } from './monworn.js';
import { observeObjectForNaming } from './objnam.js';
import { objectDescription } from './object_description.js';
import type { Monster } from './monster_types.js';
import { EGG } from './object_data.js';
import { d, rn2, rnd } from './rng.js';
import { isPoolAt } from './terrain_properties.js';
import { ceilingName } from './terrain_name.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { moveHeroByTeleport } from './teleport.js';
import { advanceMonsterWormBody } from './monster_worm.js';
import { finishTeleportArrival } from './location_effects.js';

const M1_HIDE = 0x00000100;
const S_EEL = 57;
const S_MIMIC = 13;
const S_PIERCER = 16;
const PM_TRAPPER = MONSTER_NAME.indexOf('trapper');
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');

// C hacklib.c:s_suffix().
function sSuffix(name: string): string {
    if (name.toLowerCase() === 'it') return `${name}s`;
    if (name.toLowerCase() === 'you') return `${name}r`;
    return `${name}${name.endsWith('s') ? "'" : "'s"}`;
}

export interface HeroHiderRevealOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: RandomBelow;
    rollOne?: RollOne;
    rollDice?: RollDice;
    calls?: MonsterCallLog | null;
}

// Returns true when mattacku() must stop without attacking (C `return 0`).
export async function revealConcealedHeroToAttacker(
    monster: Monster, {
        state = game, publish = plineWithContinuation,
        random = rn2, rollOne = rnd, rollDice = d, calls = null,
    }: HeroHiderRevealOptions = {},
): Promise<boolean> {
    const hero = state.u;
    const apparentDistance = dist2(monster.mx, monster.my, monster.mux ?? hero.ux, monster.muy ?? hero.uy);
    const attackerLooksAdjacent = apparentDistance < 3
        && !(apparentDistance === 2 && monster.mnum === PM_GRID_BUG);
    const foundYou = monster.mux === hero.ux && monster.muy === hero.uy;
    if (hero.uswallow || !attackerLooksAdjacent || !foundYou) return false;

    const species = heroSpecies(state);
    const flags1 = MONSTER_FLAGS1[species] ?? 0;
    const symbol = MONSTER_SYMBOL[species];
    const attacker = () => monsterName(monster, { state, article: 'none', exact: true });
    const seenByHero = canSeeMonster(monster);
    const formName = () => monsterTypeName(species, state.flags.female);

    if (hero.uundetected) {
        if (!canSpotMonster(monster)) map_invisible(monster.mx, monster.my);
        hero.uundetected = 0;

        if ((flags1 & M1_HIDE) && species !== PM_TRAPPER) {
            // ceiling hider drops onto the attacker's square
            await publish(`You fall from the ${ceilingName(hero.ux, hero.uy, state)}!`);
            const oldx = monster.mx;
            const oldy = monster.my;
            // C remove_monster() takes the attacker off the map before the
            // search so that its own square — usually the closest free one —
            // is eligible for the hero; the monster remembers its old spot.
            monster.mx = 0;
            monster.my = 0;
            const spot = findNearbyMonsterPosition(species, hero.ux, hero.uy, {
                state, random,
            });
            // a fish won't voluntarily swap positions when it's in water
            // and the hero is over land
            const eelStays = MONSTER_SYMBOL[monster.mnum] === S_EEL
                && isPoolAt(oldx, oldy, state) && !isPoolAt(hero.ux, hero.uy, state);
            if (!spot || eelStays) {
                placeMonsterAt(monster, oldx, oldy); /* put back */
                newsym(hero.ux, hero.uy);
                await publish(`${monsterName(monster, { state, capitalized: true })} draws back as you drop!`);
                return true;
            }

            newsym(oldx, oldy); /* finish removal; the square is empty now */
            placeMonsterAt(monster, hero.ux, hero.uy);
            let landing = spot;
            if (monster.wormno) {
                advanceMonsterWormBody(monster, { state, random, rollOne, rollDice });
                // the tail has not grown, so if it now occupies the landing
                // square then one of the worm's original spots is free
                if (state.level && monsterAtPosition(state.level, spot.x, spot.y)) {
                    landing = findNearbyMonsterPosition(species, hero.ux, hero.uy, {
                        state, random,
                    }) ?? spot;
                }
            }
            // C teleds() ends with spoteffects(), so the landing square's
            // trap and autopickup take effect before the piercer strikes.
            const movement = await moveHeroByTeleport(landing.x, landing.y, state, { allowDrag: true });
            const arrival = await finishTeleportArrival(movement, { announceTeleport: false });
            if (arrival.died || state.program_state?.gameover) return true;
            setMonsterApparentHeroPosition(monster, state, random, calls);
            newsym(hero.ux, hero.uy);

            if (symbol !== S_PIERCER) return true; /* lurkers don't attack */

            const helmet = (monster.minvent || monster.inventory || [])
                .find(object => ((object.owornmask ?? 0) & W_ARMH) !== 0);
            if (helmet && objectIsHardHelmet(helmet)) {
                await publish(`Your blow glances off ${sSuffix(monsterName(monster, { state }))} helm.`);
            } else {
                calls?.push('rnd(20)');
                if (3 + findMonsterArmorClass(monster) <= rollOne(20)) {
                    await publish(`${monsterName(monster, { state, capitalized: true })} is hit by a falling piercer (you)!`);
                    calls?.push('d(3,6)');
                    monster.mhp -= rollDice(3, 6);
                    if (monster.mhp < 1) {
                        await finishHeroMonsterKill(monster, monster.mx, monster.my, { publish });
                    }
                } else {
                    await publish(`${monsterName(monster, { state, capitalized: true })} is almost hit by a falling piercer (you)!`);
                }
            }
        } else {
            // surface hider
            if (!seenByHero) {
                await publish('It tries to move where you are hiding.');
            } else {
                const cover = state.level?.objects?.[hero.ux]?.[hero.uy]?.[0];
                const hiddenSomewhere = !!cover
                    || species === PM_TRAPPER
                    || (symbol === S_EEL && isPoolAt(hero.ux, hero.uy, state));
                if (!hiddenSomewhere) {
                    await impossible('hiding under nothing?', { state });
                } else {
                    // C zeroes a covering egg's spe so "laid by you" cannot
                    // leak into the message, then restores it.
                    const savedSpe = cover ? cover.spe : 0;
                    if (cover && cover.otyp === EGG) cover.spe = 0;
                    if (symbol === S_EEL || species === PM_TRAPPER) {
                        await publish(`Wait, ${attacker()}!  There's a hidden ${formName()} named ${state.plname} there!`);
                    } else if (cover) {
                        observeObjectForNaming(cover, { state });
                        await publish(`Wait, ${attacker()}!  There's a ${formName()} named ${state.plname} hiding under ${await objectDescription(cover, { state })}!`);
                    }
                    if (cover) cover.spe = savedSpe;
                }
            }
            newsym(hero.ux, hero.uy);
        }
        return true;
    }

    if (symbol === S_MIMIC && (hero.m_ap_type ?? M_AP_NOTHING) !== M_AP_NOTHING) {
        const sticky = heroFormSticks(state);
        if (!canSpotMonster(monster)) map_invisible(monster.mx, monster.my);
        if (sticky && !seenByHero) {
            await publish('It gets stuck on you.');
        } else {
            await publish(`Wait, ${attacker()}!  That's a ${formName()} named ${state.plname}!`);
        }
        if (sticky) setHeroGrip(monster, state);
        hero.m_ap_type = M_AP_NOTHING;
        hero.mappearance = 0;
        newsym(hero.ux, hero.uy);
        return true;
    }

    return false;
}
