// Earthquakes and the chasms they open.
// C ref: music.c do_earthquake() and do_pit().
import { monsterAtPosition } from './steed.js';
import { altarmaskAt, desecrateAltar } from './pray.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { A_DEX, ALTAR, AM_MASK, AM_SANCTUM, Amask2align, COLNO, CORR, MGIVENNAME, DOOR, D_NODOOR, FOUNTAIN, GRAVE, LAVAPOOL, PIT, ROOM, ROWNO, NO_KILLER_PREFIX, SCORR, SDOOR, SHOPBASE, SINK, THRONE, TT_BURIEDBALL, TT_PIT, is_pit } from './const.js';
import { newsym } from './display.js';
import { plineWithContinuation, publishHeardMessage } from './pline.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { finishMonsterLiquidDeath, resolveMonsterLiquid, wakeMonster, finishHeroLiquidMonsterDeath, finishHeroMonsterKill } from './mon.js';
import { heroLiquidEffects, loseHeroHp, roomsAt, finishDestinationSpotEffects } from './hack.js';
import { liquidForHole, unearthFloorObjectsAt } from './dig.js';
import { remove_object, updateIceObjectTimersAt } from './mkobj.js';
import { applyFloorEffects } from './do.js';
import { BOULDER } from './object_data.js';
import { heroHasNoLimbs, heroIsPolymorphed } from './polyself.js';
import { rnl, rnd, rn2 } from './rng.js';
import { monsterSelfTouch, trapAt, waterDamageChain, fireDamageChain, setHeroTrap, resetUtrap, maketrap, deleteFloorTrap, selfTouchPetrifyingWeapons, } from './trap.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { monsterName } from './do_name.js';
import { convertSecretDoor } from './detect.js';
import { addShopDamage } from './shk.js';
import { monsterIsClinger, monsterIsFlyer, monsterIsHumanoid, monsterIsSlithy, monsterSpeciesHidesOnCeiling } from './mondata.js';
// Part of C music.c:do_pit(), music.c:do_earthquake(): m_at() lookup.
function monsterAt(x, y) {
    return game.level ? monsterAtPosition(game.level, x, y) : null;
}
// Part of C music.c:do_pit(): sobj_at(BOULDER, x, y) lookup.
function boulderAt(x, y) {
    return game.level?.objects?.[x]?.[y]?.find(object => object.otyp === BOULDER) || null;
}
// Part of C music.c:do_pit(): KADOOM branch, boulder fills the new chasm.
async function fillChasmWithBoulder(x, y, boulder, monster) {
    if (cansee(x, y)) {
        await plineWithContinuation(`KADOOM!  The boulder falls into a chasm${game.u?.ux === x && game.u?.uy === y ? ' below you' : ''}!`);
    }
    if (monster)
        monster.mtrapped = 0;
    remove_object(boulder);
    await applyFloorEffects(boulder, x, y);
}
// Part of C dig.c:liquid_flow(): the water_damage_chain() branch.
async function damageFloorObjectsWithWater(x, y) {
    const pile = game.level?.objects?.[x]?.[y] || [];
    const messages = [];
    await waterDamageChain(pile, messages, game);
    if (cansee(x, y)) {
        for (const message of messages)
            await plineWithContinuation(message);
    }
}
// Part of C dig.c:liquid_flow(): earthquake caller; terrain type set here.
async function flowLiquidIntoChasm(x, y, trap, liquid, monster) {
    const location = requireGameLevel(game).at(x, y);
    if (!location)
        throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    location.typ = liquid;
    location.flags = 0;
    if (liquid === LAVAPOOL)
        location.lit = true;
    await deleteFloorTrap(trap);
    updateIceObjectTimersAt(x, y, game);
    await unearthFloorObjectsAt(x, y, game);
    if (liquid === LAVAPOOL) {
        await fireDamageChain(game.level?.objects?.[x]?.[y] || [], {
            state: game, x, y, force: true,
            publish: plineWithContinuation,
        });
    }
    else {
        await damageFloorObjectsWithWater(x, y);
    }
    if (game.u?.ux === x && game.u?.uy === y) {
        const liquidEffect = await heroLiquidEffects({
            applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
                oldx: from.x, oldy: from.y, newx: to.x, newy: to.y, pick,
            }),
        });
        if (liquidEffect?.died)
            return;
    }
    else if (monster) {
        await resolveMonsterLiquid(monster, game, {
            announce: plineWithContinuation,
            finishDeath: finishEarthquakeLiquidDeath,
            monsterMoving: false,
        });
    }
    await newsym(x, y);
}
// Port only: death-finisher hook for the minliquid() call in liquid_flow().
function finishEarthquakeLiquidDeath(monster, options) {
    if (options.cause === 'drowning' || options.cause === 'lava-burning') {
        return finishHeroLiquidMonsterDeath(monster, options);
    }
    return finishMonsterLiquidDeath(monster, options);
}
// Part of C music.c:do_pit(): is_clinger(youmonst.data) test.
function heroClingsToCeiling() {
    if (!heroIsPolymorphed(game))
        return false;
    return monsterIsClinger(game.u.umonnum ?? -1);
}
// Part of C music.c:do_pit(): Levitation || Flying || clinger test.
function heroIsAirborne() {
    const hero = game.u;
    return !!(hero.levitating || hero.levitation || game.levitating
        || hero.flying || game.flying
        || heroClingsToCeiling());
}
// Part of C music.c:do_pit(): set_utrap(rn1(6, 2), TT_PIT).
function trapHeroInChasm() {
    setHeroTrap(rn2(6) + 2, TT_PIT);
}
// Part of C music.c:do_pit(): Maybe_Half_Phys() halving of the fall damage.
function physicalDamage(amount) {
    const halfDamage = game.u.halfPhysicalDamage;
    return halfDamage ? Math.trunc((amount + 1) / 2) : amount;
}
// Part of C music.c:do_pit(): hero branch — chain break, airborne, fall, jostled.
async function dropHeroIntoChasm(hadPitBeforeEarthquake) {
    if (game.u?.utrap && game.u.utraptype === TT_BURIEDBALL) {
        await plineWithContinuation('Your chain breaks!');
        await resetUtrap(true);
    }
    if (heroIsAirborne()) {
        if (!hadPitBeforeEarthquake) {
            await plineWithContinuation('A chasm opens up under you!');
            await plineWithContinuation("You don't fall in!");
        }
        return;
    }
    if (!hadPitBeforeEarthquake
        || !game.u?.utrap || game.u.utraptype !== TT_PIT) {
        await plineWithContinuation('You fall into a chasm!');
        trapHeroInChasm();
        if (await loseHeroHp(physicalDamage(rnd(6)), 'fell into a chasm', {
            deathCause: 'fell into a chasm',
            killerFormat: NO_KILLER_PREFIX,
        }))
            return;
        await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });
        return;
    }
    const fumbling = !!(game.u?.fumbling
        || (game.u?.fumblingTurns ?? 0) > 0);
    const roleRange = game.urole?.key === 'archeologist' ? 3 : 9;
    const keepsFooting = !(fumbling && rn2(5))
        && (rnl(roleRange) === 0
            || (currentAttribute(A_DEX) > 7 && rn2(5) !== 0));
    await plineWithContinuation('You are jostled around violently!');
    trapHeroInChasm();
    if (await loseHeroHp(physicalDamage(rnd(keepsFooting ? 2 : 4)), 'hurt in a chasm', {
        deathCause: 'hurt in a chasm',
        killerFormat: NO_KILLER_PREFIX,
    }))
        return;
    if (keepsFooting)
        await exerciseAttribute(A_DEX, true);
    else {
        const slithering = heroIsPolymorphed(game)
            && monsterIsSlithy(game.u.umonnum ?? -1);
        await selfTouchPetrifyingWeapons({
            messageStart: slithering || heroHasNoLimbs(game)
                ? 'Shaken, you' : 'Falling down, you',
        });
    }
}
// Part of C music.c:do_pit(): xkilled(XKILL_NOMSG) finisher for a mselftouch death.
function finishEarthquakeStoning(monster, options = {}) {
    return finishHeroMonsterKill(monster, monster.mx, monster.my, {
        ...options,
        showKillMessage: false,
        recordConduct: false,
    });
}
// Part of C music.c:do_pit(): the "poor <pet>" x_monnam() form in the destroy message.
function earthquakeMonsterName(monster) {
    return monster.mtame
        ? monsterName(monster, { adjective: 'poor', suppressSaddle: !!MGIVENNAME(monster) })
        : monsterName(monster);
}
// Part of C music.c:do_pit(): monster branch — trap, fall, and destroy messages.
async function dropMonsterIntoChasm(monster, x, y) {
    if ((monsterIsFlyer(monster.mnum) || monsterIsClinger(monster.mnum)))
        return;
    const wasTrapped = !!monster.mtrapped;
    monster.mtrapped = 1;
    if (!wasTrapped) {
        if (cansee(x, y)) {
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} falls into a chasm!`);
        }
        else if (monsterIsHumanoid(monster.mnum)) {
            await publishHeardMessage('a scream!', plineWithContinuation);
        }
    }
    const selfTouch = await monsterSelfTouch(monster, {
        prefix: 'Falling, ',
        creditHero: true,
        finishDeath: finishEarthquakeStoning,
    });
    if (!selfTouch.survived)
        return;
    monster.mhp = (monster.mhp ?? 1) - rnd(wasTrapped ? 4 : 6);
    if (monster.mhp > 0)
        return;
    await plineWithContinuation(cansee(x, y)
        ? `You destroy ${earthquakeMonsterName(monster)}!`
        : 'It is destroyed!');
    await finishHeroMonsterKill(monster, x, y, {
        showKillMessage: false,
    });
}
// C music.c:do_pit().
async function openChasm(x, y, hadPitBeforeEarthquake) {
    const location = requireGameLevel(game).at(x, y);
    if (!location)
        throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    const chasm = await maketrap(x, y, PIT);
    if (!chasm)
        return false;
    chasm.tseen = 1;
    const monster = monsterAt(x, y);
    const boulder = boulderAt(x, y);
    if (boulder) {
        await fillChasmWithBoulder(x, y, boulder, monster);
        return true;
    }
    const liquid = liquidForHole(x, y);
    if (liquid !== ROOM) {
        await flowLiquidIntoChasm(x, y, chasm, liquid, monster);
        return true;
    }
    if (monster)
        await dropMonsterIntoChasm(monster, x, y);
    else if (game.u?.ux === x && game.u?.uy === y)
        await dropHeroIntoChasm(hadPitBeforeEarthquake);
    else
        await newsym(x, y);
    return true;
}
// Part of C music.c:do_earthquake(): wakeup plus the shaken-loose-from-ceiling branch.
async function wakeMonsterForEarthquake(monster) {
    if (!monster)
        return false;
    if ((await wakeMonster(monster, { attacked: true })).heroDied)
        return true;
    if (monster.mundetected) {
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
        if (monsterSpeciesHidesOnCeiling(monster.mnum)) {
            if (cansee(monster.mx, monster.my)) {
                await plineWithContinuation(`${monsterName(monster, { article: 'a', capitalized: true })} is shaken loose from the ceiling!`);
            }
            else if (!monsterIsFlyer(monster.mnum)) {
                await publishHeardMessage('a thump.', plineWithContinuation);
            }
        }
    }
    return false;
}
// Part of C music.c:do_earthquake(): align_str(Amask2align()) for the altar case.
function altarName(mask) {
    const alignment = Amask2align(mask & AM_MASK);
    return alignment > 0 ? 'lawful'
        : alignment < 0 ? 'chaotic' : alignment === 0 ? 'neutral' : 'unaligned';
}
// Part of C music.c:do_earthquake(): the terrain switch (fountain, sink,
// altar, grave, throne, doors) around the do_pit() calls.
async function shakeTerrain(x, y, hadPitBeforeEarthquake) {
    const location = requireGameLevel(game).at(x, y);
    if (!location)
        throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    if (location.typ === FOUNTAIN) {
        if (cansee(x, y))
            await plineWithContinuation('The fountain falls into a chasm.');
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SINK) {
        if (cansee(x, y))
            await plineWithContinuation('The kitchen sink falls into a chasm.');
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === ALTAR) {
        // music.c:do_earthquake() reads the mask through altarmask_at(),
        // so an altar-mimicking monster's disguise outranks the tile.
        const mask = altarmaskAt(x, y);
        if (mask & AM_SANCTUM)
            return false;
        if (cansee(x, y)) {
            await plineWithContinuation(`The ${altarName(mask)} altar falls into a chasm.`);
        }
        await desecrateAltar(false, Amask2align(mask & AM_MASK));
        if (game.program_state.gameover)
            return false;
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === GRAVE || location.typ === THRONE) {
        const feature = location.typ === GRAVE ? 'headstone' : 'throne';
        const action = location.typ === GRAVE ? 'topples' : 'falls';
        if (cansee(x, y))
            await plineWithContinuation(`The ${feature} ${action} into a chasm.`);
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SCORR) {
        location.typ = CORR;
        vision_note_blocker_change(x, y);
        if (cansee(x, y))
            await plineWithContinuation('A secret corridor is revealed.');
    }
    if (location.typ === CORR || location.typ === ROOM) {
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SDOOR) {
        convertSecretDoor(location);
        if (cansee(x, y))
            await plineWithContinuation('A secret door is revealed.');
    }
    if (location.typ !== DOOR)
        return false;
    if ((location.doormask || 0) === D_NODOOR) {
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    location.doormask = D_NODOOR;
    vision_note_blocker_change(x, y);
    await newsym(x, y);
    if (cansee(x, y))
        await plineWithContinuation('The door collapses.');
    if (roomsAt(game.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0);
    return true;
}
// C music.c:do_earthquake().
export async function createEarthquake(requestedForce) {
    requirePlayingGame(game);
    const force = Math.max(1, Math.min(13, requestedForce));
    const hadPitBeforeEarthquake = is_pit(trapAt(game, game.u.ux, game.u.uy)?.ttyp ?? 0);
    let changed = 0;
    const startX = Math.max(1, (game.u?.ux || 1) - force * 2);
    const endX = Math.min(COLNO - 1, (game.u?.ux || 1) + force * 2);
    const startY = Math.max(0, (game.u?.uy || 0) - force * 2);
    const endY = Math.min(ROWNO - 1, (game.u?.uy || 0) + force * 2);
    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            if (await wakeMonsterForEarthquake(monsterAt(x, y)))
                return { changed, force, heroDied: true };
            if (rn2(14 - force) !== 0)
                continue;
            if (await shakeTerrain(x, y, hadPitBeforeEarthquake))
                changed++;
            if (game.program_state?.gameover)
                return { changed, force, heroDied: true };
        }
    }
    return { changed, force, heroDied: false };
}
//# sourceMappingURL=earthquake.js.map