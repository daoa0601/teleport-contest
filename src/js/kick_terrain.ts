// Native dokick.c:kick_nondoor(), for terrain beyond doors and graves.
import { exerciseAttribute } from './attrib.js';
import {
    A_DEX, A_WIS, ALTAR, CORR, FOUNTAIN, G_GONE, IRONBARS, IS_TREE, Is_stronghold, LADDER,
    LA_DOWN, MM_ANGRY, MM_FEMALE, MM_MALE, MM_NOMSG, ROOM, SCORR,
    SINK, STAIRS, S_LDWASHER, S_LPUDDING, THRONE, TREE_LOOTED, TREE_SWARM, T_LOOTED,
} from './const.js';
import { displayColorName, displayMessageWindow, feel_newsym, newsym, plineWithContinuation as pline } from './display.js';
import { placeCreatedObject } from './floor_object.js';
import { game, requirePlayingGame } from './gstate.js';
import { dungeonDepth } from './hacklib.js';
import { heroPolyGender, heroSpecies } from './hero_species.js';
import { scheduleLevelChange } from './level_change.js';
import { canFallThrough, findMonsterNearPosition, makemonAt, mkgold, mksobj, rndClass } from './mklev.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL } from './monster_data.js';
import { APPLE, BANANA, DILITHIUM_CRYSTAL, EUCALYPTUS_LEAF, LUCKSTONE, ORANGE, PEAR } from './object_data.js';
import { objectCombatName } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { altarWrath } from './pray.js';
import { rn1, rn2, rnd, rnl } from './rng.js';
import { scatterFloorObjects } from './scatter.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { shopDig } from './shop_damage.js';
import { sinkBacksUp } from './sink_dipping.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { bringLeashedFollowers } from './teleport.js';
import { impactDrop } from './object_migration.js';
import { waterDamageObject } from './trap.js';
import { vision_note_blocker_change } from './vision.js';
import { objectWeight } from './weight.js';
import type { MapLocation } from './map_types.js';

interface TerrainKickResponses {
    ouch: (x: number, y: number) => Promise<void>;
    dumb: (x: number, y: number) => Promise<void>;
}

export async function kickNonDoorTerrain(
    x: number, y: number, average: number, responses: TerrainKickResponses,
): Promise<boolean> {
    requirePlayingGame(game);
    const location = game.level.requireAt(x, y);
    if (location.typ === SCORR) {
        if (!game.u.levitating && rn2(30) < average) {
            await pline('Crash!  You kick open a secret passage!');
            await exerciseAttribute(A_DEX, true);
            location.typ = CORR;
            feel_newsym(x, y);
            vision_note_blocker_change(x, y);
        } else await responses.ouch(x, y);
    } else if (location.typ === THRONE) {
        await kickThrone(x, y, location, responses);
    } else if (location.typ === ALTAR || location.typ === FOUNTAIN) {
        await kickAltarOrFountain(x, y, location, responses);
    } else if (IS_TREE(location.typ)) {
        await kickTree(x, y, location, responses);
    } else if (location.typ === SINK) {
        await kickSink(x, y, location, responses);
    } else if (location.typ === IRONBARS || location.typ === STAIRS || location.typ === LADDER) {
        if (location.typ !== IRONBARS && location.ladder === LA_DOWN)
            await responses.dumb(x, y);
        else await responses.ouch(x, y);
    } else return false;
    game.context.move = 1;
    return true;
}

async function kickThrone(x: number, y: number, location: MapLocation, responses: TerrainKickResponses): Promise<void> {
    requirePlayingGame(game);
    if (game.u.levitating) { await responses.dumb(x, y); return; }
    const luck = (game.u.uluck ?? 0) + (game.u.moreluck ?? 0);
    if ((luck < 0 || location.looted) && rn2(3) === 0) {
        location.looted = 0;
        location.typ = ROOM;
        await mkgold(rnd(200), x, y);
        await pline(heroIsBlind() ? 'CRASH!  You destroy it.' : 'CRASH!  You destroy the throne.');
        if (!heroIsBlind()) newsym(x, y);
        await exerciseAttribute(A_DEX, true);
        return;
    }
    if (luck > 0 && rn2(3) === 0 && !location.looted) {
        await mkgold(rn1(201, 300), x, y);
        for (let gems = Math.min(luck + 1, 6); gems > 0; gems--)
            placeCreatedObject(await mksobj(rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1), false, true), x, y);
        await pline(heroIsBlind() ? 'You kick something loose!' : 'You kick loose some ornamental coins and gems!');
        if (!heroIsBlind()) newsym(x, y);
        location.looted = T_LOOTED;
        return;
    }
    if (rn2(4) === 0) {
        const current = game.u.uz;
        const dungeon = game.dungeons[current.dnum];
        if (dungeon && current.dlevel < dungeon.num_dunlevs) {
            await fallThroughTerrain();
            return;
        }
    }
    await responses.ouch(x, y);
}

// C trap.c:fall_through(FALSE, 0). A throne opens a temporary hole under
// the hero; level travel waits until the current command has finished.
async function fallThroughTerrain(): Promise<void> {
    requirePlayingGame(game);
    const hero = game.u;
    const { ux: x, uy: y } = hero;
    const sokoban = game.level.flags.sokoban_rules;
    if (heroIsBlind() && hero.levitating && !sokoban) return;
    await pline(`The ${surfaceName(x, y)} opens up under you!`);
    const form = heroSpecies();
    const flags = MONSTER_FLAGS1[form] ?? 0;
    const clings = !!(flags & 0x10);
    const ceilingHider = !!(flags & 0x100) && (clings && MONSTER_SYMBOL[form] !== 13 || !!(flags & 0x01));
    let refusal: string | null = null;
    if (!(sokoban && canFallThrough(hero.uz))) {
        if (hero.levitating || hero.ustuck || (!canFallThrough(hero.uz) && !game.level.requireAt(x, y).candig)
            || hero.flying || clings || ceilingHider && hero.uundetected)
            refusal = "You don't fall in.";
        else if ((MONSTER_SIZE[form] ?? 2) >= 4) refusal = "You don't fit through.";
        else if (!await bringLeashedFollowers()) refusal = 'You are jerked back by your pet!';
    }
    if (refusal) {
        await pline(refusal);
        await impactDrop(null, x, y, { publish: pline });
        await displayMessageWindow();
        await pline('The opening under you closes up.');
        return;
    }
    if (hero.ushops?.length) await shopDig(1);
    const destination = Is_stronghold(hero.uz) ? game.valley_level
        : { dnum: hero.uz.dnum, dlevel: hero.uz.dlevel + 1 };
    if (!destination) throw new Error('The stronghold fall requires the Valley destination.');
    if (!Is_stronghold(hero.uz)) {
        const distance = dungeonDepth(destination.dnum, destination.dlevel)
            - dungeonDepth(hero.uz.dnum, hero.uz.dlevel);
        if (distance > 1) await pline(`You fall down a ${distance > 3 ? 'very ' : ''}${distance > 2 ? 'deep ' : ''}shaft!`);
    }
    scheduleLevelChange([destination, { arrival: hero.flying ? 'random' : 'falling',
        postMessage: `The hole in the ${ceilingName(x, y)} above you closes up.` }]);
}

async function kickAltarOrFountain(x: number, y: number, location: MapLocation, responses: TerrainKickResponses): Promise<void> {
    if (game.u.levitating) { await responses.dumb(x, y); return; }
    const altar = location.typ === ALTAR;
    await pline(`You kick ${heroIsBlind() ? 'something' : altar ? 'the altar' : 'the fountain'}.`);
    if (altar) await altarWrath(x, y);
    if (rn2(3) === 0) { await responses.ouch(x, y); return; }
    if (!altar && game.uarmf && rn2(3) !== 0) {
        if (await waterDamageObject(game.uarmf, [], game, { force: true, description: 'metal boots', publish: pline }) === 'nothing')
            await pline('Your boots get wet.');
    }
    await exerciseAttribute(A_DEX, true);
}

function speciesGone(species: number): boolean {
    return !!((game.mvitals?.[species]?.mvflags ?? 0) & G_GONE);
}

async function kickTree(x: number, y: number, location: MapLocation, responses: TerrainKickResponses): Promise<void> {
    const bee = MONSTER_NAME.indexOf('killer bee');
    if (rn2(3) !== 0) {
        if (rn2(6) === 0 && !speciesGone(bee) && !heroIsDeaf()) await pline('You hear a low buzzing.');
        await responses.ouch(x, y);
        return;
    }
    if (rn2(15) !== 0 && !((location.looted ?? 0) & TREE_LOOTED)) {
        const fruits = [APPLE, ORANGE, PEAR, BANANA, EUCALYPTUS_LEAF];
        const type = fruits[rn2(fruits.length)];
        if (type === undefined) throw new Error('Tree fruit selection requires an object type.');
        const fruit = placeCreatedObject(await mksobj(type, true, false), x, y);
        const count = 8 - rnl(7);
        fruit.quan = fruit.quantity = count;
        fruit.owt = objectWeight(fruit);
        const name = objectCombatName(fruit);
        await pline(count > 1 ? `Some ${name} fall from the tree!` : `${withIndefiniteArticle(name).replace(/^./u, letter => letter.toUpperCase())} falls from the tree!`);
        const fallen = await scatterFloorObjects(x, y, 2, { onlyObject: fruit, mayDestroy: false, mayFracture: false,
            mayHitHero: true, mayHitMonsters: true, heroCaused: true, publish: pline });
        if (fallen !== count) {
            const caught = await mksobj(type, true, false);
            caught.quan = caught.quantity = count - fallen;
            await pline(`${count - fallen} ${objectCombatName(caught)} got caught in the branches.`);
        }
        await exerciseAttribute(A_DEX, true);
        await exerciseAttribute(A_WIS, true);
        newsym(x, y);
        location.looted = (location.looted ?? 0) | TREE_LOOTED;
        return;
    }
    if (!((location.looted ?? 0) & TREE_SWARM)) {
        let made = 0;
        let position = { x, y };
        for (let count = rnl(4) + 2; count > 0; count--) {
            const next = findMonsterNearPosition(bee, position.x, position.y);
            if (!next) continue;
            position = next;
            if (await makemonAt(bee, position.x, position.y, MM_ANGRY | MM_NOMSG)) made++;
        }
        await pline(made ? "You've attracted the tree's former occupants!" : 'You smell stale honey.');
        location.looted = (location.looted ?? 0) | TREE_SWARM;
        return;
    }
    await responses.ouch(x, y);
}

async function kickSink(x: number, y: number, location: MapLocation, responses: TerrainKickResponses): Promise<void> {
    const gender = heroPolyGender();
    if (game.u.levitating) { await responses.dumb(x, y); return; }
    if (rn2(5) !== 0) {
        await pline(heroIsDeaf() ? 'Klunk!' : 'Klunk!  The pipes vibrate noisily.');
        await exerciseAttribute(A_DEX, true);
        return;
    }
    const pudding = MONSTER_NAME.indexOf('black pudding');
    const demon = MONSTER_NAME.indexOf('amorous demon');
    if (!((location.looted ?? 0) & S_LPUDDING) && rn2(3) === 0 && !speciesGone(pudding)) {
        if (!heroIsBlind()) await pline(`A ${displayColorName('black')} ooze gushes up from the drain!`);
        else if (!heroIsDeaf()) await pline('You hear a gushing sound.');
        await makemonAt(pudding, x, y, MM_NOMSG);
        await exerciseAttribute(A_DEX, true);
        newsym(x, y);
        location.looted = (location.looted ?? 0) | S_LPUDDING;
    } else if (!((location.looted ?? 0) & S_LDWASHER) && rn2(3) === 0 && !speciesGone(demon)) {
        await pline(`${heroIsBlind() ? 'Something' : 'The dish washer'} returns!`);
        if (await makemonAt(demon, x, y, MM_NOMSG | (gender === 1 || gender === 2 && rn2(2) ? MM_MALE : MM_FEMALE)))
            newsym(x, y);
        location.looted = (location.looted ?? 0) | S_LDWASHER;
        await exerciseAttribute(A_DEX, true);
    } else if (rn2(3) === 0) await sinkBacksUp(x, y);
    else await responses.ouch(x, y);
}
