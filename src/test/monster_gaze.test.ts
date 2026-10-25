import { installPagerInput } from './support/pager-input.js';
import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT, POOL, W_AMUL } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { OBJECT_NAMES, SHIELD_OF_REFLECTION, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { artifactObject, addInventoryObject, knownObject } from './support/game-objects.js';
import { wearEyewear } from '../js/eyewear.js';
import { heroIsBlind } from '../js/senses.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

function gazeRoom(expected: RegExp) {
    const input = freshTurnRoom({ role: 'barbarian', left: 1, right: 18, top: 1, bottom: 18 });
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 500;
    const messages: string[] = [];
    installPagerInput(input, { expected, limit: 32 });
    input.beforeRead = () => {
        if (game._pending_message) messages.push(game._pending_message);
    };
    async function runTurn() {
        input.display = null;
        input.feed('m.');
        const turn = (async () => {
            await moveloop_core();
            await moveloop_core();
        })();
        const completed = turn.then(() => false);
        for (let boundary = 0; boundary < 32; boundary++) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), completed,
            ]);
            assert.equal(blocked, true, 'the completed monster actions must return to command input');
            const display = requireGameDisplay();
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            const prose = game._pending_message || game._toplines;
            assert.match(prose, expected, 'unexpected prose while completing the gaze turn');
            if (screen.includes('--More--')) {
                input.feed(' ');
                continue;
            }
            // This invocation has finished its monster actions and is now
            // waiting for the next command. End it with one explicit Escape.
            input.feed('\x1b');
            await turn;
            installPagerInput(input, { expected, limit: 1 });
            return;
        }
        assert.fail('The gaze turn exceeded its expected message boundaries');
    }
    return { runTurn, messages };
}

void test('a pyrolisk burns the hero with its active gaze', async () => {
    const { runTurn, messages } = gazeRoom(/pyrolisk|fiery gaze|burn|smoke|heated|flame/i);
    requirePlayingGame(game);
    const pyrolisk = await createMonsterAt('pyrolisk', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    pyrolisk.msleeping = 0;
    pyrolisk.movement = 12;
    initRng(1n);
    await runTurn();
    await flushPendingTopline();
    assert.match(messages.join('\n'), /attacks you with a fiery gaze!/);
    assert.ok(game.u.uhp < 500);
    assert.equal(pyrolisk.mspec_used || 0, 0, 'a fiery gaze does not start a cooldown');
});

void test('a cancelled Medusa gazes once before her ordinary attacks', async () => {
    const { runTurn, messages } = gazeRoom(/Medusa|poison|feel weaker/i);
    requirePlayingGame(game);
    const medusa = await createMonsterAt('Medusa', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    medusa.msleeping = 0;
    medusa.mcan = 1;
    medusa.movement = 12;
    initRng(1n);
    await runTurn();
    await flushPendingTopline();
    assert.ok(messages.some(message => message.includes('Medusa gazes ineffectually.')));
    const gazePages = messages.filter(message => message.includes('Medusa gazes ineffectually.'));
    assert.equal(gazePages.length, 1);
    assert.ok(game.u.uhp > 0 && game.u.uhp < 500);
});

void test('a reflected Medusa gaze makes her statue before she can attack', async () => {
    const { runTurn, messages } = gazeRoom(/Medusa|reflect|more experienced|welcome/i);
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(SHIELD_OF_REFLECTION));
    findArmorClass();
    const medusa = await createMonsterAt('Medusa', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    medusa.msleeping = 0;
    medusa.movement = 12;
    initRng(1n);
    await runTurn();
    await flushPendingTopline();
    assert.ok(game.u.uhp >= 500, 'Medusa dies before attacking; her kill can raise the hero level');
    assert.ok(medusa.dead);
    assert.ok(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === STATUE && object.corpsenm === medusa.mnum));
    assert.match(messages.join('\n'), /Medusa is turned to stone!/);
    assert.match(messages.join('\n'), /You kill Medusa!/);
    assert.ok(game._knownObjectTypes?.has(SHIELD_OF_REFLECTION));
});

void test('an underwater reflection does not petrify Medusa', async () => {
    const { runTurn, messages } = gazeRoom(/Medusa|reflected|water|bubbles|amulet|rust|back on solid ground/i);
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('amulet of magical breathing')), 'uamul');
    wearHeroArmor(await addInventoryObject(SHIELD_OF_REFLECTION));
    findArmorClass();
    const medusa = await createMonsterAt('Medusa', 11, 10, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    medusa.msleeping = 0;
    medusa.movement = 12;
    game.level.requireAt(10, 10).typ = POOL;
    game.level.requireAt(11, 10).typ = POOL;
    game.u.uinwater = true;
    initRng(1n);
    await runTurn();
    await flushPendingTopline();
    assert.ok(!medusa.dead && medusa.mhp > 0);
    assert.match(messages.join('\n'), /doesn't seem to notice that her gaze was reflected/);
});

void test('an Archon gaze does not announce new stun for an already stunned bat form', async () => {
    const { runTurn, messages } = gazeRoom(/bat|Archon|stun|blind|radiance|hit|miss|sword|knocks you backward/i);
    requirePlayingGame(game);
    await polymonHero(MONSTER_NAME.indexOf('bat'));
    game.u.mh = game.u.mhmax = 500;
    const archon = await createMonsterAt('Archon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    archon.msleeping = 0;
    archon.movement = 12;
    initRng(1n);
    await runTurn();
    await flushPendingTopline();
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.ok((game.u.stunnedTurns ?? 0) > 0);
    assert.equal(game.u.stunned, true);
    assert.doesNotMatch(messages.join('\n'), /You flutter\.\.\./);
});

void test('Medusa is announced killed before her medallion saves her', async () => {
    const { runTurn, messages } = gazeRoom(/Medusa|reflect|medallion|But wait|stone/i);
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(SHIELD_OF_REFLECTION));
    findArmorClass();
    const medusa = await createMonsterAt('Medusa', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const amulet = await knownObject(OBJECT_NAMES.indexOf('amulet of life saving'));
    await equipMonsterObject(medusa, amulet, W_AMUL);
    medusa.msleeping = 0;
    medusa.movement = 12;
    initRng(1n);
    await runTurn();
    await flushPendingTopline();
    const prose = messages.join('\n');
    assert.match(prose, /You kill Medusa!/);
    assert.ok(prose.indexOf('You kill Medusa!') < prose.indexOf('But wait...'), prose);
    assert.ok(!medusa.dead && medusa.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.match(prose, /Medusa's medallion begins to glow!/);
    assert.doesNotMatch(prose, /The Medusa/);
    assert.ok(!(game.level.objects[11]?.[10] || []).some(object => object.otyp === STATUE));
    assert.equal(game.u.uconduct.killer, 1);
});

void test('an Archon gaze does not blind the Eyes of the Overworld', async () => {
    const { runTurn, messages } = gazeRoom(/Archon|blind|radiance|vision|hit|miss|sword|knocks you backward|aches/i);
    requirePlayingGame(game);
    await wearEyewear(await artifactObject('The Eyes of the Overworld'));
    const archon = await createMonsterAt('Archon', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    archon.msleeping = 0;
    archon.movement = 12;
    initRng(1n);
    await runTurn();
    await flushPendingTopline();
    const prose = messages.join('\n');
    assert.match(prose, /You are blinded by the Archon's radiance!/);
    assert.match(prose, /Your vision quickly clears\./);
    assert.equal(heroIsBlind(game), false);
    assert.ok((game.u.blindTurns ?? 0) > 0, 'the underlying blindness timeout still accumulates');
});
