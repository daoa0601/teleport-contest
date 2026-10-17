// C do.c:boulder_hits_pool(), for both free and pushed floor boulders.
import { heroHasArtifactDefense, heroHasCarriedArtifactFlag } from './artifacts.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { DB_FLOOR, DB_UNDER, DRAWBRIDGE_UP, Is_waterlevel, ROOM, WATER } from './const.js';
import { impossible } from './diagnostics.js';
import { displayLiquidName, docrt, newsym, plineWithContinuation } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { burnAwayHeroSlime } from './hack.js';
import { loseHeroHp } from './hero_damage.js';
import { formatHeardMessage } from './hero_speech.js';
import { deleteFloorTrap } from './mklev.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { BOULDER } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { useUpFloorObject } from './floor_consumption.js';
import { monsterName } from './monster_name.js';
import { objectCombatName } from './objnam.js';
import { d, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { switchHeroTerrain } from './terrain_movement.js';
import { waterbodyName } from './terrain_name.js';
import { isLavaAt, isPoolAt, monsterInAir } from './terrain_properties.js';
import { cansee, vision_note_blocker_change } from './vision.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';

interface BoulderLiquidOptions {
    pushing?: boolean;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
}

export async function dropBoulderIntoLiquid(boulder: GameObject | null, x: number, y: number, state: GameState = game, {
    publish = plineWithContinuation, random = rn2, pushing = false,
}: BoulderLiquidOptions = {}): Promise<boolean> {
    requireLiveGame(state);
    if (!boulder || boulder.otyp !== BOULDER) {
        await impossible('Not a boulder?', { state });
        return false;
    }
    if (boulder.where !== (pushing ? 'floor' : 'free'))
        throw new Error('Boulder liquid effects require a floor object when pushing, otherwise a free object');
    if (!isPoolAt(x, y, state) && !isLavaAt(x, y, state)) return false;

    const lava = isLavaAt(x, y, state);
    const liquid = waterbodyName(x, y, state);
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (!location) throw new RangeError(`Boulder landing square ${x},${y} is outside the map`);
    const type = location.typ;
    const chance = random(10);
    const fills = !Is_waterlevel(state.u.uz)
        && (type === WATER ? chance < 5 : lava ? chance === 0 : chance !== 0);
    if (fills) {
        const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
        if (type === DRAWBRIDGE_UP) {
            location.drawbridgemask = ((location.drawbridgemask ?? 0) & ~DB_UNDER) | DB_FLOOR;
        } else {
            location.typ = ROOM;
            location.flags = 0;
            location.icedpool = 0;
            vision_note_blocker_change(x, y);
        }
        const monster = monsterAtPosition(level, x, y);
        if (monster && monster.mhp > 0 && !monsterInAir(monster, state)) {
            await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
            if (state.program_state.gameover) return true;
        }
        if (trap) {
            await deleteFloorTrap(trap, state);
            if (state.program_state.gameover) return true;
        }
        await buryFloorObjectsAt(x, y, state, { publish });
        newsym(x, y);
        if (pushing) {
            const who = state.u.usteed
                ? monsterName(state.u.usteed, { state, article: 'your', capitalized: true }) : 'You';
            await publish(`${who} ${state.u.usteed ? 'pushes' : 'push'} the ${objectCombatName(boulder, { state })} into the ${liquid}.`);
            if (state.flags.verbose !== false && !heroIsBlind(state))
                await publish('Now you can cross it!');
        }
    }

    if (!fills || !pushing) {
        if (!state.u.uinwater) {
            if (pushing ? !heroIsBlind(state) : cansee(x, y)) {
                await publish(`There is a large splash as the ${objectCombatName(boulder, { state })} ${
                    fills ? 'fills' : 'falls into'} the ${liquid}.`);
            } else if (!heroIsDeaf(state)) {
                const message = formatHeardMessage(`a${lava ? ' sizzling' : ''} splash.`, state);
                if (message) await publish(message);
            }
            await wakeMonstersNearWithMessages(x, y, 40, state, publish);
            if (state.program_state.gameover) return true;
        }

        if (fills && state.u.uinwater && state.u.ux === x && state.u.uy === y) {
            state.u.uinwater = 0;
            state.underwater = false;
            await switchHeroTerrain(state);
            if (state.program_state.gameover) return true;
            await docrt();
            state.vision_full_recalc = 1;
            await publish('You find yourself on dry land again!');
        } else if (lava && Math.abs(state.u.ux - x) <= 1 && Math.abs(state.u.uy - y) <= 1) {
            const fireResistant = state.u.fireResistance
                || heroHasArtifactDefense('fire', state);
            await publish(`You are hit by molten ${displayLiquidName('lava', state)}${fireResistant ? '.' : '!'}`);
            await burnAwayHeroSlime(state, publish);
            let damage = d(fireResistant ? 1 : 3, 6);
            if (state.u.halfPhysicalDamage
                || heroHasCarriedArtifactFlag('SPFX_HPHDAM', state)) damage = Math.trunc((damage + 1) / 2);
            await loseHeroHp(damage, 'molten lava', { state, publish });
            if (state.program_state.gameover) return true;
        } else if (!fills && state.flags.verbose !== false
            && (pushing ? !heroIsBlind(state) : cansee(x, y))) {
            await publish('It sinks without a trace!');
        }
    }
    if (pushing) await useUpFloorObject(boulder, boulder.quan, { state, publish });
    else await deleteObject(boulder, state);
    return true;
}
