import { createRoomLevel } from './support/playable-room.js';
import { initializeMonsterVitals } from '../js/monster_population.js';
import { requireMonsterVital } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { A_STR, CORR, MAGIC_PORTAL, P_BASIC, P_EXPERT, P_SHORT_SWORD, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { GOLD_PIECE, LEATHER_ARMOR, OIL_LAMP, RIN_PROTECTION, SHORT_SWORD, SPE_FORCE_BOLT } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { objectTimers } from '../js/object_timers.js';
import { beginObjectBurn } from '../js/light.js';
import { discardTutorialState } from '../js/tutorial_state.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { completeHeroStartup } from './support/startup.js';
void test('tutorial entry retains the old armor class until its entry message is acknowledged', async () => {
    const engine = await runSegment({
        seed: 719,
        datetime: '20261012090000',
        nethackrc: 'OPTIONS=name:Learner,role:Ranger,race:elf,gender:female,align:chaotic,!legacy,!autopickup,pettype:none',
        moves: '', storage: memoryStorage(),
    });
    const startingArmorClass = engine.state.u.uac;
    assert.ok(startingArmorClass !== undefined && startingArmorClass < 10, 'the Ranger must start with protective equipment');
    let entryFound = false;
    for (let phase = 0; phase < 8; phase++) {
        const display = engine.state.nhDisplay;
        assert.ok(display);
        const message = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (message.includes('Entering the tutorial.')) {
            entryFound = true;
            break;
        }
        engine.inputGate.feed(message.includes('Do you want a tutorial?') ? 'y' : ' ');
        await engine.runUntilInputNeeded();
    }
    assert.equal(entryFound, true, 'startup must reach the tutorial entry message');
    assert.equal(engine.state.inventory.length, 0);
    assert.equal(engine.state.u.uac, startingArmorClass);
});
void test('entering the tutorial stores equipment and returning restores the same items', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    await startLuaCore(t);
    const sword = await addInventoryObject(SHORT_SWORD);
    const armor = await addInventoryObject(LEATHER_ARMOR);
    const ring = await addInventoryObject(RIN_PROTECTION);
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 57 });
    await setPrimaryWeapon(sword);
    wearHeroArmor(armor);
    await wearHeroAccessory(ring, 'uleft');
    const lifecycle = currentLuaLifecycle();
    await lifecycle.callCore(game, 'enter_tutorial');
    assert.equal(game.inventory.length, 0);
    assert.equal(game.uwep, null);
    assert.equal(game.uarm, null);
    assert.equal(game.uleft, null);
    const practiceSword = await addInventoryObject(SHORT_SWORD);
    await setPrimaryWeapon(practiceSword);
    await lifecycle.callCore(game, 'leave_tutorial');
    assert.ok(game.inventory.includes(sword));
    assert.ok(game.inventory.includes(armor));
    assert.ok(game.inventory.includes(ring));
    assert.ok(game.inventory.includes(gold));
    assert.equal(gold.invlet, '$');
    assert.equal(gold.quan, 57);
    assert.equal(game.uwep, sword);
    assert.equal(game.uarm, armor);
    assert.equal(game.uleft, ring);
    assert.equal(practiceSword.where, 'gone');
});
void test('returning from the tutorial restores the hero and turn without undoing the current level change', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    await startLuaCore(t);
    installHeroWeaponSkills({ [P_SHORT_SWORD]: P_BASIC });
    game.u.uhunger = 600;
    const health = game.u.uhp;
    const strength = game.u.acurr.a[A_STR];
    const turn = game.moves;
    const lifecycle = currentLuaLifecycle();
    await lifecycle.callCore(game, 'enter_tutorial');
    game.u.uhp = 1;
    game.u.acurr.a[A_STR] = 3;
    assert.ok(game.u.weaponSkills !== undefined && game.u.weaponSkills !== null, 'Expected game.u.weaponSkills to be initialized');
    assert.ok(game.u.weaponSkills[P_SHORT_SWORD] !== undefined && game.u.weaponSkills[P_SHORT_SWORD] !== null);
    game.u.weaponSkills[P_SHORT_SWORD].skill = P_EXPERT;
    game.u.uconduct.killer = 4;
    game.u.uhunger = 10;
    game.u.uz = { dnum: 1, dlevel: 2 };
    game.u.uz0 = { dnum: 1, dlevel: 1 };
    game.moves += 50;
    await lifecycle.callCore(game, 'leave_tutorial');
    assert.equal(game.moves, turn);
    assert.equal(game.u.uhp, health);
    assert.equal(game.u.acurr.a[A_STR], strength);
    assert.equal(game.u.weaponSkills[P_SHORT_SWORD].skill, P_BASIC);
    assert.equal(game.u.uconduct.killer || 0, 0);
    assert.equal(game.u.uhunger, 900);
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(game.u.uz0.dlevel, 1);
});
void test('the tutorial stores starting spells and restores monster statistics while clearing called names', async (t) => {
    await completeHeroStartup({ role: 'wizard', seed: 123n });
    game.level = createRoomLevel();
    game.u.ux = 10;
    game.u.uy = 10;
    game.u.ux0 = 10;
    game.u.uy0 = 10;
    initializeMonsterVitals(game);
    await startLuaCore(t);
    assert.ok(game.spells.some(spell => spell.otyp === SPE_FORCE_BOLT));
    const antVital = requireMonsterVital(0);
    antVital.born = 3;
    antVital.died = 2;
    const lifecycle = currentLuaLifecycle();
    await lifecycle.callCore(game, 'enter_tutorial');
    assert.equal(game.spells.length, 0);
    const tutorialAntVital = requireMonsterVital(0);
    tutorialAntVital.born = 9;
    tutorialAntVital.died = 8;
    recordObjectCall(SHORT_SWORD, 'training sword');
    await lifecycle.callCore(game, 'leave_tutorial');
    assert.ok(game.spells.some(spell => spell.otyp === SPE_FORCE_BOLT));
    assert.equal(requireMonsterVital(0).born, 3);
    assert.equal(requireMonsterVital(0).died, 2);
    assert.ok(game._objectCallNames !== undefined && game._objectCallNames !== null, 'Expected game._objectCallNames to be initialized');
    assert.equal(game._objectCallNames[SHORT_SWORD], undefined);
});
void test('discarding tutorial state frees the stored items and their timers', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    await startLuaCore(t);
    const lamp = await addInventoryObject(OIL_LAMP, { age: 10 });
    beginObjectBurn(lamp, game, game.moves);
    await currentLuaLifecycle().callCore(game, 'enter_tutorial');
    await discardTutorialState(game);
    assert.equal(lamp.where, 'gone');
    assert.equal(lamp.lamplit, false);
    assert.equal(objectTimers(lamp).length, 0);
});
void test('tutorial entry stores starting gear and its exit portal restores normal play', async () => {
    const engine = await runSegment({
        seed: 10201,
        datetime: '20260830190000',
        nethackrc: [
            'OPTIONS=name:Learner,role:Wizard,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!autopickup,pettype:none',
        ].join('\n'),
        moves: '', storage: memoryStorage(),
    });
    requirePlayingGame(game);
    let readyForTutorialCommand = false;
    for (let phase = 0; phase < 8; phase++) {
        const display = requireGameDisplay();
        const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (engine.state._tutorialActive && !screen.includes('--More--')) {
            assert.equal(display.cursorCol, game.u.ux - 1);
            assert.equal(display.cursorRow, game.u.uy + 1);
            readyForTutorialCommand = true;
            break;
        }
        if (screen.includes('Do you want a tutorial?'))
            engine.inputGate.feed('y');
        else {
            assert.match(screen, /--More--/);
            assert.match(screen, /welcome to NetHack|full moon|Entering the tutorial|engraved|read:/i);
            engine.inputGate.feed(' ');
        }
        await engine.runUntilInputNeeded();
    }
    assert.equal(readyForTutorialCommand, true, 'Tutorial startup must reach command input');
    assert.equal(engine.state._tutorialActive, true);
    assert.equal(engine.state.inventory.length, 0);
    assert.equal(engine.state.uwep, null);
    assert.equal(engine.state.spells.length, 0);
    engine.inputGate.feed('S');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.context.move, 0);
    assert.doesNotMatch(engine.state._pending_message, /Really save/);
    assert.ok(engine.state.level !== undefined && engine.state.level !== null, 'Expected engine.state.level to be initialized');
    const level = engine.state.level;
    const portal = level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
    assert.ok(portal);
    const approach = [
        { dx: 1, dy: 0, key: 'l' }, { dx: -1, dy: 0, key: 'h' },
        { dx: 0, dy: 1, key: 'j' }, { dx: 0, dy: -1, key: 'k' },
    ].find(step => [ROOM, CORR].includes(level.at(portal.tx - step.dx, portal.ty - step.dy)?.typ ?? -1));
    assert.ok(approach, 'the exit portal should have an open approach');
    assert.ok(portal !== undefined && portal !== null, 'Expected portal to be initialized');
    engine.state.u.ux = engine.state.u.ux0 = portal.tx - approach.dx;
    engine.state.u.uy = engine.state.u.uy0 = portal.ty - approach.dy;
    engine.inputGate.feed(approach.key);
    await engine.runUntilInputNeeded();
    assert.match(engine.state._pending_message, /Really step into that magic portal\?/);
    assert.equal(engine.state._tutorialActive, true);
    assert.equal(engine.state.u.ux, portal.tx - approach.dx);
    assert.equal(engine.state.u.uy, portal.ty - approach.dy);
    engine.inputGate.feed('y');
    await engine.runUntilInputNeeded();
    for (let page = 0; page < 4; page++) {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (!screen.includes('--More--'))
            break;
        assert.match(screen, /tutorial|portal|strange|dizzy|back/i);
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
    }
    assert.equal(engine.state._tutorialActive, false);
    assert.ok(engine.state.u.uz !== undefined && engine.state.u.uz !== null, 'Expected engine.state.u.uz to be initialized');
    assert.equal(engine.state.u.uz.dnum, 0);
    assert.ok(engine.state.inventory.length > 0);
    assert.ok(engine.state.spells.some(spell => spell.otyp === SPE_FORCE_BOLT));
    engine.inputGate.feed('S');
    await engine.runUntilInputNeeded();
    assert.match(engine.state._pending_message, /Really save/);
    engine.inputGate.feed('n');
    await engine.runUntilInputNeeded();
});
//# sourceMappingURL=tutorial_state.test.js.map