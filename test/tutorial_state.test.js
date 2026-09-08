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

test('entering the tutorial stores equipment and returning restores the same items', async t => {
    freshObjectRoom();
    startLuaCore(t);
    const sword = addInventoryObject(SHORT_SWORD);
    const armor = addInventoryObject(LEATHER_ARMOR);
    const ring = addInventoryObject(RIN_PROTECTION);
    const gold = addInventoryObject(GOLD_PIECE, { quan: 57 });
    setPrimaryWeapon(sword);
    wearHeroArmor(armor);
    wearHeroAccessory(ring, 'uleft');
    const lifecycle = currentLuaLifecycle();

    await lifecycle.callCore(game, 'enter_tutorial');

    assert.equal(game.inventory.length, 0);
    assert.equal(game.uwep, null);
    assert.equal(game.uarm, null);
    assert.equal(game.uleft, null);
    const practiceSword = addInventoryObject(SHORT_SWORD);
    setPrimaryWeapon(practiceSword);

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

test('returning from the tutorial restores the hero and turn without undoing the current level change', async t => {
    freshObjectRoom();
    startLuaCore(t);
    installHeroWeaponSkills({ [P_SHORT_SWORD]: P_BASIC });
    game.u.uhunger = 600;
    const health = game.u.uhp;
    const strength = game.u.acurr.a[A_STR];
    const turn = game.moves;
    const lifecycle = currentLuaLifecycle();

    await lifecycle.callCore(game, 'enter_tutorial');
    game.u.uhp = 1;
    game.u.acurr.a[A_STR] = 3;
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

test('the tutorial stores starting spells and restores monster statistics while clearing called names', async t => {
    completeHeroStartup({ role: 'wizard', seed: 123n });
    startLuaCore(t);
    assert.ok(game.spells.some(spell => spell.otyp === SPE_FORCE_BOLT));
    game.mvitals = [{ born: 3, died: 2, mvflags: 0 }];
    const lifecycle = currentLuaLifecycle();

    await lifecycle.callCore(game, 'enter_tutorial');

    assert.equal(game.spells.length, 0);
    game.mvitals[0].born = 9;
    game.mvitals[0].died = 8;
    recordObjectCall(SHORT_SWORD, 'training sword');

    await lifecycle.callCore(game, 'leave_tutorial');

    assert.ok(game.spells.some(spell => spell.otyp === SPE_FORCE_BOLT));
    assert.equal(game.mvitals[0].born, 3);
    assert.equal(game.mvitals[0].died, 2);
    assert.equal(game._objectCallNames[SHORT_SWORD], undefined);
});

test('discarding tutorial state frees the stored items and their timers', async t => {
    freshObjectRoom();
    startLuaCore(t);
    const lamp = addInventoryObject(OIL_LAMP, { age: 10 });
    beginObjectBurn(lamp, game, game.moves);
    await currentLuaLifecycle().callCore(game, 'enter_tutorial');

    discardTutorialState(game);

    assert.equal(lamp.where, 'gone');
    assert.equal(lamp.lamplit, false);
    assert.equal(objectTimers(lamp).length, 0);
});

test('tutorial entry stores starting gear and its exit portal restores normal play', async () => {
    const engine = await runSegment({
        seed: 10201,
        datetime: '20260830190000',
        nethackrc: [
            'OPTIONS=name:Learner,role:Wizard,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!autopickup,pettype:none',
        ].join('\n'),
        // Dismiss the welcome and full-moon messages, then choose tutorial.
        moves: '  y   ',
    });

    assert.equal(engine.state._tutorialActive, true);
    assert.equal(engine.state.inventory.length, 0);
    assert.equal(engine.state.uwep, null);
    assert.equal(engine.state.spells.length, 0);

    engine.inputGate.feed('S');
    await engine.runUntilInputNeeded();

    assert.equal(engine.state.context.move, 0);
    assert.doesNotMatch(engine.state._pending_message, /Really save/);

    const portal = engine.state.level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
    const approach = [
        { dx: 1, dy: 0, key: 'l' }, { dx: -1, dy: 0, key: 'h' },
        { dx: 0, dy: 1, key: 'j' }, { dx: 0, dy: -1, key: 'k' },
    ].find(step => [ROOM, CORR].includes(
        engine.state.level.at(portal.tx - step.dx, portal.ty - step.dy)?.typ,
    ));
    assert.ok(approach, 'the exit portal should have an open approach');
    engine.state.u.ux = engine.state.u.ux0 = portal.tx - approach.dx;
    engine.state.u.uy = engine.state.u.uy0 = portal.ty - approach.dy;
    engine.inputGate.feed(approach.key + ' '.repeat(20));
    await engine.runUntilInputNeeded();

    assert.equal(engine.state._tutorialActive, false);
    assert.equal(engine.state.u.uz.dnum, 0);
    assert.ok(engine.state.inventory.length > 0);
    assert.ok(engine.state.spells.some(spell => spell.otyp === SPE_FORCE_BOLT));
    engine.inputGate.feed('S');
    await engine.runUntilInputNeeded();
    assert.match(engine.state._pending_message, /Really save/);
    engine.inputGate.feed('n');
    await engine.runUntilInputNeeded();
});
