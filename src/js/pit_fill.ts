// C trap.c:fill_pit() and do.c:flooreffects()'s boulder/pit branch.
import { buryFloorObjectsAt } from './buried_object.js';
import { TRAPDOOR, HOLE, is_hole, is_pit } from './const.js';
import { canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import type { FloorEffectResult } from './floor_effects.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Trap } from './map_types.js';
import { useUpFloorObject } from './floor_consumption.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { hitMonsterWithSettlingBoulder } from './hero_ranged_attack.js';
import { heroSpecies } from './hero_species.js';
import { formatHeardMessage } from './hero_speech.js';
import { deleteFloorTrap } from './mklev.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, monsterIsNonliving, monsterIsVampireShifter } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { BOULDER } from './object_data.js';
import { unlinkObject } from './object_location.js';
import { rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { resetHeroTrap } from './terrain_movement.js';
import { cansee } from './vision.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';

const M1_WALLWALK = 0x08;
const M2_ROCKTHROW = 0x08000000;

export async function fillPitWithBoulderAt(x: number, y: number, state: GameState = game, {
    publish = plineWithContinuation,
}: { publish?: MessagePublisher } = {}): Promise<{
    filled: boolean; trap: Trap | null; boulder: GameObject | null;
    buriedFloorObjects: GameObject[]; heroDied?: boolean;
}> {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate =>
        candidate.tx === x && candidate.ty === y
        && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)));
    const boulder = level.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
    if (!trap || !boulder)
        return { filled: false, trap: trap || null, boulder: boulder || null, buriedFloorObjects: [] };

    // Extraction prevents a monster's death from finding this same boulder
    // recursively when departure cleanup tries to fill its pit.
    unlinkObject(boulder, state);
    const result = await applyFloorEffects(boulder, x, y, { state, publish, verb: 'settle' });
    return {
        filled: !level.traps.includes(trap), trap, boulder,
        buriedFloorObjects: result.buriedFloorObjects || [],
        heroDied: !!result.heroDied || !!state.program_state.gameover,
    };
}

export async function applyBoulderPitEffects(boulder: GameObject, trap: Trap, x: number, y: number, {
    state = game, publish = plineWithContinuation, verb = '',
}: { state?: GameState; publish?: MessagePublisher; verb?: string } = {}): Promise<FloorEffectResult> {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    if (boulder.where !== 'free') throw new Error('boulder pit effects require a free object');
    const trapType = trap.ttyp;
    const seen = !!trap.tseen;
    const heroHere = state.u.ux === x && state.u.uy === y;
    const monster = monsterAtPosition(level, x, y);
    let squishedHero = false;
    if (monster?.mtrapped || state.u.utrap && heroHere) {
        if (verb && (cansee(x, y) || heroHere))
            await publish(`${heroIsBlind(state) ? 'A' : 'The'} boulder ${verb}s into the pit${monster ? '' : ' with you'}.`);
        if (monster) {
            if (!ignoresFallingBoulder(monster.mnum)) {
                if (state.context.mon_moving) {
                    monster.mhp -= rollPhysicalWeaponDamage(boulder, monster);
                    if (monster.mhp <= 0) {
                        const destroyed = monsterIsNonliving(monster.mnum) || monsterIsVampireShifter(monster);
                        const death = await finishEnvironmentalMonsterDeath(monster, state, {
                            publish, deathMessage: canSpotMonster(monster)
                                ? `${monsterName(monster, { state, capitalized: true })} is ${destroyed ? 'destroyed' : 'killed'}!` : null,
                        });
                        if (death.heroDied || state.program_state.gameover)
                            return { finished: true, object: boulder, heroDied: true };
                    }
                } else if ((await hitMonsterWithSettlingBoulder(monster, boulder, { state, publish })).heroDied) {
                    return { finished: true, object: boulder, heroDied: true };
                }
            }
            monster.mtrapped = 0;
        } else if (!state.u.passesWalls && !ignoresFallingBoulder(heroSpecies(state))) {
            const damage = rnd(15);
            const cause = 'squished under a boulder';
            if (await loseHeroHp(state.u.halfPhysicalDamage ? Math.trunc((damage + 1) / 2) : damage, cause,
                { state, publish, deathCause: cause }))
                return { finished: true, object: boulder, heroDied: true };
            squishedHero = true;
        } else await resetHeroTrap(true, state);
    }
    if (verb && !squishedHero) {
        if (heroIsBlind(state) && heroHere) {
            const message = formatHeardMessage('a CRASH! beneath you.', state);
            if (message) await publish(message);
        } else if (!heroIsBlind(state) && cansee(x, y)) {
            const effect = trapType === TRAPDOOR ? 'plugs a trap door'
                : trapType === HOLE ? 'plugs a hole' : 'fills a pit';
            await publish(`The boulder ${trapType === TRAPDOOR && !seen ? 'triggers and ' : ''}${effect}.`);
        } else {
            const message = formatHeardMessage(`a boulder ${verb}.`, state);
            if (message) await publish(message);
        }
    }
    const remainingTrap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (remainingTrap) {
        await deleteFloorTrap(remainingTrap, state);
        if (state.program_state.gameover) return { finished: true, object: boulder, heroDied: true };
        if (state.u.utrap && heroHere) await resetHeroTrap(false, state);
    }
    boulder.ox = x;
    boulder.oy = y;
    await useUpFloorObject(boulder, 1, { state, publish });
    const buriedFloorObjects = await buryFloorObjectsAt(x, y, state, { publish });
    newsym(x, y);
    return { finished: true, object: null, buriedFloorObjects };
}

function ignoresFallingBoulder(mnum: number): boolean {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_WALLWALK) || !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_ROCKTHROW);
}
