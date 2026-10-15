// C muse.c:use_misc(MUSE_BULLWHIP). The weapon is detached before the yank
// announcement, then placed only after that message has returned.
import { heroHandName } from './body_parts.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { placeObjectSynchronously } from './floor_object.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { monsterHatesSilver } from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import { dropObjectAtHero } from './object_drop.js';
import { HEAVY_IRON_BALL, OBJECT_BIMANUAL } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { unlinkObject } from './object_location.js';
import { objectMaterial } from './object_material.js';
import { definiteName, objectCombatName, objectNameIsPlural } from './objnam.js';
import { surfaceName } from './terrain_name.js';
import { isWeldedPrimary } from './weapon_slots.js';
import type { PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

const SILVER = 14;

export async function useMonsterBullwhip(
    monster: Monster, target: GameObject, destination: number, state: PlayingGameState,
): Promise<void> {
    const seen = canSeeMonster(monster);
    const whip = seen ? 'The bullwhip' : 'A whip';
    const weapon = definiteName(objectCombatName(target, { state }), state);
    const hand = heroHandName(state);
    const hands = OBJECT_BIMANUAL[target.otyp] ? makePlural(hand) : hand;
    if (seen)
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} flicks a bullwhip towards your ${hands}!`);
    if (target.otyp === HEAVY_IRON_BALL) {
        await plineWithContinuation(`${whip} fails to wrap around ${weapon}.`);
        return;
    }
    await plineWithContinuation(`${whip} wraps around ${weapon} you're wielding!`, { urgent: true });
    if (isWeldedPrimary(target, state)) {
        // welded() discovers the curse before the native punctuation test.
        target.bknown = true;
        await plineWithContinuation(`${objectNameIsPlural(target, state) ? 'They are' : 'It is'} welded to your ${hands}.`);
        destination = 0;
    }
    if (!destination) {
        await plineWithContinuation('The whip slips free.');
        return;
    }
    if (destination === 3 && monsterHatesSilver(monster) && objectMaterial(target, state) === SILVER)
        destination = 2;
    await removeWornHeroItem(target, state);
    if (state.program_state.gameover) return;
    unlinkObject(target, state);
    await finishInventoryRemoval(target, state);
    if (state.program_state.gameover) return;
    const subject = monsterName(monster, { state, capitalized: true });
    if (destination === 1) {
        await plineWithContinuation(`${subject} yanks ${weapon} from your ${hands}!`);
        placeObjectSynchronously(target, monster.mx, monster.my, state);
    } else if (destination === 2) {
        await plineWithContinuation(`${subject} yanks ${weapon} to the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
        await dropObjectAtHero(target, { state });
    } else {
        await plineWithContinuation(`${subject} snatches ${weapon}!`);
        await addObjectToMonsterInventory(monster, target, state);
    }
}
