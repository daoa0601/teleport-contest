// C fountain.c:dipsink(), sink_backs_up().
import { exerciseAttribute } from './attrib.js';
import { heroFaceName } from './body_parts.js';
import { A_DEX, A_WIS, S_LRING } from './const.js';
import { newsym, plineWithContinuation as pline } from './display.js';
import { fingersOrGloves, washHands } from './dip_water.js';
import type { DipTarget } from './dip_water.js';
import { placeCreatedObject } from './floor_object.js';
import { game, requirePlayingGame } from './gstate.js';
import { consumeInventoryItem } from './invent.js';
import { mkobj } from './mklev.js';
import { tryCallObjectType } from './object_call.js';
import { POT_ACID, POT_FRUIT_JUICE, POT_GAIN_ENERGY, POT_GAIN_LEVEL,
    POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION,
    POT_OIL, POT_POLYMORPH, POT_WATER } from './object_data.js';
import { objectCombatName } from './objnam.js';
import { objectQuantity } from './object_stack.js';
import { applySupportedPotionVapor, heroPotionVaporProfile } from './potion_hit.js';
import { polymorphSink } from './ring_sink.js';
import { rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { breakSinkAt } from './sink_terrain.js';
import { waterDamageObject } from './trap.js';

export async function dipSink(object: DipTarget): Promise<void> {
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const location = game.level.requireAt(ux, uy);
    const looted = !!((location.looted ?? 0) & S_LRING);
    const hands = object === 'hands' || object === game.uarmg;
    if (!rn2(looted ? 15 : 25)) {
        await breakSinkAt(ux, uy);
        if (hands && game.u.glibTurns) await pline(`Your ${fingersOrGloves()} are still slippery.`);
        return;
    }
    if (hands) { await washHands(); return; }
    if (object.oclass !== 8) {
        await pline(`You hold the ${objectCombatName(object, { includeCorpseSpecies: false })} under the tap.`);
        if (await waterDamageObject(object, [], game, { force: true, publish: pline }) === 'nothing')
            await pline('Nothing seems to happen.');
        return;
    }
    await pline(`You pour ${objectQuantity(object) > 1 ? 'one of ' : ''}the ${objectCombatName(object)} down the drain.`);
    let tryCall = false;
    switch (object.otyp) {
    case POT_POLYMORPH:
        await polymorphSink(game, pline);
        tryCall = true;
        break;
    case POT_OIL:
        await pline(heroIsBlind() ? 'Nothing seems to happen.' : 'It leaves an oily film on the basin.');
        tryCall = !heroIsBlind();
        break;
    case POT_ACID:
        if (!heroIsBlind()) { await pline('The drain seems less clogged.'); tryCall = true; }
        else if (!heroIsDeaf()) { await pline('You hear a sucking sound.'); tryCall = true; }
        else await pline('Nothing seems to happen.');
        break;
    case POT_LEVITATION:
        await sinkBacksUp();
        tryCall = true;
        break;
    case POT_OBJECT_DETECTION:
        if (!looted) { await pline('You sense a ring lost down the drain.'); tryCall = true; }
        else await pline('Nothing seems to happen.');
        break;
    case POT_GAIN_LEVEL: case POT_GAIN_ENERGY: case POT_MONSTER_DETECTION:
    case POT_FRUIT_JUICE: case POT_WATER:
        await pline('Nothing seems to happen.');
        break;
    default:
        await pline('A wisp of vapor rises up...');
        if (heroPotionVaporProfile(game).canReceive) await applySupportedPotionVapor({ potion: object });
    }
    if (tryCall && object.dknown) await tryCallObjectType(object);
    await consumeInventoryItem(object);
}

async function sinkBacksUp(): Promise<void> {
    requirePlayingGame(game);
    const sight = heroIsBlind(), deaf = heroIsDeaf();
    const message = !sight ? 'Muddy waste pops up from the drain'
        : !deaf ? 'You hear a sloshing sound' : `Something splashes you in the ${heroFaceName()}`;
    await pline(`${deaf ? '' : 'Flupp!  '}${message}.`);
    const { ux, uy } = game.u;
    const location = game.level.requireAt(ux, uy);
    if ((location.looted ?? 0) & S_LRING) return;
    if (!sight) await pline('You see a ring shining in its midst.');
    placeCreatedObject(await mkobj(4, true), ux, uy);
    newsym(ux, uy);
    await exerciseAttribute(A_DEX, true);
    await exerciseAttribute(A_WIS, true);
    location.looted = (location.looted ?? 0) | S_LRING;
}
