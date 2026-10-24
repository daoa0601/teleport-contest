// C fountain.c:dipfountain(): the Lady of the Lake judges a long sword.
import type { GameObject } from './object_types.js';
import type { MapLocation } from './map_types.js';
import { artifactByName, discoverArtifact, nameArtifact } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS, ROOM } from './const.js';
import { displayLiquidName, newsym, plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { countLevelFeatures } from './mklev.js';
import { angerWatchGuards } from './monster_anger.js';
import { LONG_SWORD } from './object_data.js';
import { blessObjectState, curseObject } from './object_state.js';
import { inTown } from './room.js';
import { rn2 } from './rng.js';
import { updateUnpaidObjectPrice } from './shk.js';
import { setTwoWeaponCombat, setWieldedArtifactProperties } from './weapon_slots.js';
import { dropCursedSecondaryWeapon } from './two_weapon.js';

export async function dipFountainSword(object: GameObject, location: MapLocation): Promise<boolean> {
    requirePlayingGame(game);
    if (object.otyp !== LONG_SWORD || game.u.ulevel < 5
        || rn2(game.urole.key === 'knight' ? 6 : 30)
        || object.quan !== 1 || object.oartifact) return false;
    const artifact = artifactByName('Excalibur');
    if (!artifact) throw new Error('The Lady of the Lake requires Excalibur metadata.');
    if (game._artifactExists?.has(artifact.id)) return false;
    if (game.u.ualign.type !== 1) {
        await pline(`A freezing mist rises from the ${displayLiquidName('water')} and envelopes the sword.`);
        await pline('The fountain disappears!');
        await curseObject(object);
        await dropCursedSecondaryWeapon(object);
        if (object.spe > -6 && !rn2(3)) { object.spe--; object.enchantment = object.spe; }
        object.oerodeproof = false;
        await exerciseAttribute(A_WIS, false);
        recordGameLogEvent(`was denied Excalibur!  The Lady of the Lake has deemed ${game.flags.female ? 'her' : 'him'} unworthy`);
    } else {
        await pline('From the murky depths, a hand reaches up to bless the sword.');
        await pline('As the hand retreats, the fountain disappears!');
        nameArtifact(object, artifact, { origin: 'viadip', knownOrigin: true });
        if (object === game.uswapwep) setTwoWeaponCombat(false);
        // C oname() activates an artifact created in the wielded hand.
        if (object === game.uwep) await setWieldedArtifactProperties(object, true, game);
        if (object.unpaid) updateUnpaidObjectPrice(object);
        discoverArtifact(artifact.id);
        blessObjectState(object);
        object.oeroded = 0;
        object.oeroded2 = 0;
        object.oerodeproof = true;
        await exerciseAttribute(A_WIS, true);
        recordGameLogEvent('was given Excalibur by the Lady of the Lake');
    }
    location.typ = ROOM;
    location.flags = 0;
    location.looted = 0;
    location.blessedftn = 0;
    countLevelFeatures(game);
    newsym(game.u.ux, game.u.uy);
    if (inTown(game.level, game.u.ux, game.u.uy)) await angerWatchGuards(false);
    return true;
}
