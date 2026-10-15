import { ensureQuestStatus } from '../js/quest.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, PIT, WEB, W_AMUL } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline } from '../js/display.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { AMULET_OF_LIFE_SAVING, BLINDFOLD, BOULDER, LEASH, OBJECT_NAMES, OIL_LAMP, SCR_PUNISHMENT, STATUE, WAX_CANDLE } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterHasStoneResistance } from '../js/monster_resistance.js';
import { initRng } from '../js/rng.js';
import { heroIsBlind } from '../js/senses.js';
import { addInventoryItem } from '../js/u_init.js';
import { applyInventoryObject, readInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, artifactObject, floorObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt, addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
function recordMessages(messages, onRead = null) {
    const input = resetInputState();
    installPagerInput(input, {
        expected: /swallow|engulf|vortex|blind|vision|see|release|leash|web|pit|lamp|candle|pony|plucks|bashing|shield|armor|amulet|petrif|stone|looks much better|regurgitat|feel|punish|iron ball|turn into|start to float|halberd|medallion|But wait|grab attempt|purple worm|read the scroll|folds itself|slowing down/i,
        limit: 100,
    });
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        onRead?.();
    };
    return input;
}
async function engulferTurn(messages, { cancelled = false, species = 'dust vortex', seed = 1n, monster = null, onRead = null, } = {}) {
    monster ||= await createMonsterAt(species, game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    assert.ok(monster !== null && monster !== undefined);
    monster.mcan = cancelled;
    monster.movement = 12;
    const input = recordMessages(messages, onRead);
    initRng(seed);
    input.feed('m.');
    await moveloop_core();
    // A protected hero can finish this monster turn without a message.
    await finishAtCommandInput(input, moveloop_core, /^$|vortex|swallow|see|blind|gulp|grab|engulf|lethargic|stone|statue|trap|feel|attack|miss|amulet|freezing|burning|squashed/i);
    recordMessages(messages);
    return monster;
}
for (const cancelled of [false, true]) {
    void test(`a ${cancelled ? 'cancelled' : 'normal'} dust vortex blinds without HP damage`, async () => {
        freshTurnRoom({ heroLevel: 30 });
        requireFixtureGame(game);
        const messages = [];
        const hp = game.u.uhp;
        const vortex = await engulferTurn(messages, { cancelled });
        assert.ok(game.u.ustuck === vortex, messages.join(" | "));
        assert.equal(game.u.uswallow, 1);
        await flushPendingTopline();
        assert.equal(heroIsBlind(), true);
        assert.ok((game.u.blindTurns ?? 0) > 0);
        assert.equal(game.u.uhp, hp);
        assert.match(messages.join('\n'), /You can't see in here!/);
    });
}
void test('removing a blindfold inside a dust vortex reblinds without aging the swallow timer', async () => {
    freshTurnRoom({ heroLevel: 30 });
    requireFixtureGame(game);
    const messages = [];
    recordMessages(messages);
    const blindfold = await addInventoryObject(BLINDFOLD);
    await applyInventoryObject(blindfold);
    const vortex = await engulferTurn(messages);
    assert.ok(game.u.ustuck === vortex, messages.join(' | '));
    assert.equal(game.u.uswallow, 1);
    assert.equal(game.u.blindTurns ?? 0, 0, 'the blindfold protected the eyes from dust');
    const timer = game.u.uswldtim;
    const hp = game.u.uhp;
    await flushPendingTopline();
    messages.length = 0;
    await applyInventoryObject(blindfold);
    await flushPendingTopline();
    assert.equal(game.ublindf, null);
    assert.equal(heroIsBlind(), true);
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.equal(game.u.uswldtim, timer);
    assert.equal(game.u.uhp, hp);
    assert.match(messages.join('\n'), /You can't see in here!/);
    assert.doesNotMatch(messages.join('\n'), /You can see again\./);
});
void test('the real Eyes retain sight and a hidden timeout inside a dust vortex', async () => {
    freshTurnRoom({ role: 'monk', heroLevel: 30 });
    requireFixtureGame(game);
    // Match the neutral artifact in this fixture before testing its sight.
    game.u.ualign.type = 0;
    const messages = [];
    recordMessages(messages);
    ensureQuestStatus().touched_artifact = true;
    const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
    await applyInventoryObject(eyes);
    assert.equal(game.ublindf, eyes);
    const hp = game.u.uhp;
    const vortex = await engulferTurn(messages);
    assert.ok(game.u.ustuck === vortex, messages.join(' | '));
    assert.equal(game.u.uswallow, 1);
    await flushPendingTopline();
    assert.equal(heroIsBlind(), false);
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.equal(game.u.uhp, hp);
    assert.match(messages.join('\n'), /Your vision quickly clears\./);
});
for (const role of ['barbarian', 'valkyrie']) {
    const resistant = role === 'valkyrie';
    void test(`an ice vortex ${resistant ? 'cannot freeze a cold-resistant hero' : 'deals cold damage after swallowing'}`, async () => {
        freshTurnRoom({ role, heroLevel: 1 });
        requireFixtureGame(game);
        const messages = [];
        const hp = game.u.uhp;
        const vortex = await engulferTurn(messages, { species: 'ice vortex', seed: 2n });
        await flushPendingTopline();
        assert.ok(game.u.ustuck === vortex, messages.join(' | '));
        assert.equal(game.u.uswallow, 1);
        if (resistant)
            assert.equal(game.u.uhp, hp);
        else
            assert.ok(game.u.uhp < hp, `HP ${hp} -> ${game.u.uhp}; ${messages.join(' | ')}`);
        assert.match(messages.join('\n'), resistant
            ? /You feel mildly chilly\./ : /You are freezing to death!/);
    });
}
void test('a dust vortex cannot swallow or blind a huge hero', async () => {
    freshTurnRoom({ heroLevel: 30 });
    requireFixtureGame(game);
    game.flags.debug = true;
    const messages = [];
    recordMessages(messages);
    await runExtendedCommand('polyself', 'hill giant\n');
    assert.equal(MONSTER_NAME[game.u.umonnum], 'hill giant');
    await flushPendingTopline();
    messages.length = 0;
    await engulferTurn(messages);
    await flushPendingTopline();
    assert.equal(game.u.uswallow || 0, 0);
    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.doesNotMatch(messages.join('\n'), /engulfs you|can't see in here/);
});
void test('a boulder over a pit prevents engulfing even while the hero levitates', async () => {
    freshTurnRoom({ heroLevel: 30 });
    requireFixtureGame(game);
    const messages = [];
    recordMessages(messages);
    const wish = await readObjectName('ring of levitation');
    assert.ok(wish && !wish.noWish);
    const ring = await addInventoryItem(wish.object);
    await wearHeroAccessory(ring, 'uleft');
    addTrap(game.level, PIT, game.u.ux, game.u.uy);
    await floorObject(BOULDER, game.u.ux, game.u.uy);
    await flushPendingTopline();
    messages.length = 0;
    await engulferTurn(messages);
    await flushPendingTopline();
    assert.equal(game.u.uswallow || 0, 0);
    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.doesNotMatch(messages.join('\n'), /engulfs you/);
});
for (const [species, verb] of [['trapper', 'grab'], ['purple worm', 'gulp']]) {
    void test(`a ${species} cannot ${verb} an unsolid hero`, async () => {
        freshTurnRoom({ heroLevel: 30 });
        requireFixtureGame(game);
        game.flags.debug = true;
        const messages = [];
        recordMessages(messages);
        await runExtendedCommand('polyself', 'wraith\n');
        assert.equal(MONSTER_NAME[game.u.umonnum], 'wraith');
        await flushPendingTopline();
        messages.length = 0;
        await engulferTurn(messages, { species });
        await flushPendingTopline();
        assert.equal(MONSTER_NAME[game.u.umonnum], 'wraith');
        assert.match(messages.join('\n'), new RegExp(`${verb} attempt passes right through you!`));
        if (species === 'purple worm') {
            assert.equal(game.u.uswallow || 0, 0);
            assert.equal(game.u.ustuck || null, null);
            assert.doesNotMatch(messages.join('\n'), /engulfs you|swallows you whole/);
        }
        else {
            // Native still permits the trapper's second, physical engulf slot.
            assert.equal(game.u.uswallow, 1);
        }
    });
}
void test('engulfing releases a web and attached leashes before blinding the hero', async () => {
    freshTurnRoom({ heroLevel: 30 });
    requireFixtureGame(game);
    const messages = [];
    recordMessages(messages);
    const web = addTrap(game.level, WEB, game.u.ux, game.u.uy);
    await triggerHeroTrap(web);
    assert.ok((game.u.utrap ?? 0) > 0);
    const pet = await createMonsterAt('little dog', 9, 10);
    initializePet(pet);
    pet.mleashed = 1;
    pet.msleeping = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    await flushPendingTopline();
    messages.length = 0;
    let sawCaptureMessage = false;
    await engulferTurn(messages, { onRead: () => {
            if (sawCaptureMessage || !game._pending_message?.includes('engulfs you!'))
                return;
            sawCaptureMessage = true;
            assert.equal(game.u.utrap, 0, 'the short urgent line must not page before releasing the trap');
            assert.equal(game.u.uswallow || 0, 0, 'the initial messages finish before the swallowed display');
        } });
    await flushPendingTopline();
    assert.equal(sawCaptureMessage, true);
    assert.equal(game.u.uswallow, 1);
    assert.equal(game.u.utrap, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 0);
    const prose = messages.join('\n');
    assert.match(prose, /You are released from the web!/);
    assert.match(prose, /The leash snaps loose\./);
    assert.ok(prose.indexOf('released from the web') < prose.indexOf("can't see in here"));
});
for (const species of ['dust vortex', 'fire vortex']) {
    void test(`${species} ${species === 'fire vortex' ? 'preserves' : 'extinguishes'} carried flames`, async () => {
        freshTurnRoom({ heroLevel: 30 });
        requireFixtureGame(game);
        const messages = [];
        recordMessages(messages);
        const lamp = await addInventoryObject(OIL_LAMP, { age: 500 });
        const candles = await addInventoryObject(WAX_CANDLE, { age: 200, quan: 2 });
        await applyInventoryObject(lamp);
        beginObjectBurn(candles);
        assert.equal(lamp.lamplit, true);
        assert.equal(candles.lamplit, true);
        await flushPendingTopline();
        messages.length = 0;
        await engulferTurn(messages, { species });
        await flushPendingTopline();
        assert.equal(game.u.uswallow, 1);
        assert.equal(lamp.lamplit, species === 'fire vortex');
        assert.equal(candles.lamplit, species === 'fire vortex');
        if (species === 'dust vortex') {
            assert.match(messages.join('\n'), /Your oil lamp goes out!/);
            assert.match(messages.join('\n'), /Your candles' flames are extinguished\./);
        }
    });
}
void test('a vortex plucks a mounted hero off the steed without moving the hero', async () => {
    freshTurnRoom({ role: 'knight', heroLevel: 30 });
    requireFixtureGame(game);
    game.flags.debug = true;
    const messages = [];
    recordMessages(messages);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'ly');
    assert.equal(game.u.usteed, pony);
    const polearm = await addInventoryObject(OBJECT_NAMES.indexOf('halberd'));
    pushKeys(polearm.invlet);
    await rhack('w'.charCodeAt(0));
    assert.equal(game.uwep, polearm);
    const { ux, uy } = game.u;
    await flushPendingTopline();
    messages.length = 0;
    const vortex = await engulferTurn(messages);
    await flushPendingTopline();
    assert.equal(game.u.usteed, null);
    assert.equal(game.u.ustuck, vortex);
    assert.equal(game.u.uswallow, 1);
    assert.equal(game.u.ux, ux);
    assert.equal(game.u.uy, uy);
    assert.ok(pony.mx !== ux || pony.my !== uy);
    assert.match(messages.join('\n'), /whirls forward and plucks you off the saddled pony!/);
    messages.length = 0;
    await rhack('l'.charCodeAt(0));
    await flushPendingTopline();
    assert.match(messages.join('\n'), /You begin bashing monsters with/);
    messages.length = 0;
    await rhack('l'.charCodeAt(0));
    await flushPendingTopline();
    assert.doesNotMatch(messages.join('\n'), /You begin bashing/);
});
for (const lifeSaving of [false, true]) {
    void test(`initial petrification ${lifeSaving ? 'resumes the next engulf slot after life saving' : 'leaves the captor statue at its old square'}`, async () => {
        freshTurnRoom({ heroLevel: 30 });
        requireFixtureGame(game);
        game.flags.debug = true;
        const messages = [];
        recordMessages(messages);
        const punishment = await addInventoryObject(SCR_PUNISHMENT);
        await readInventoryObject(punishment);
        const ball = game.uball;
        const chain = game.uchain;
        assert.ok(ball && chain);
        await runExtendedCommand('polyself', 'cockatrice\n');
        assert.equal(MONSTER_NAME[game.u.umonnum], 'cockatrice');
        const monster = await createMonsterAt('trapper', game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        assert.equal(monsterHasStoneResistance(monster), false, 'the initial petrification test needs a stone-vulnerable captor');
        const { mx, my } = monster;
        const amulet = lifeSaving ? await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL) : null;
        await flushPendingTopline();
        messages.length = 0;
        await engulferTurn(messages, { monster });
        await flushPendingTopline();
        assert.equal(game.u.uswallow || 0, 0);
        assert.equal(game.u.ustuck || null, null);
        assert.ok(monster.dead || monster.mhp <= 0);
        assert.equal(ball.where, 'floor');
        assert.equal(chain.where, 'floor');
        assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(ball));
        assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(chain));
        assert.ok((floorObjectsAt(requireGameLevel(game), mx, my) || [])
            .some(object => object.otyp === STATUE && object.corpsenm === monster.mnum));
        if (lifeSaving) {
            assert.ok(amulet !== null && amulet !== undefined);
            assert.equal(amulet.where, 'gone');
            assert.match(messages.join('\n'), /looks much better/);
        }
    });
}
//# sourceMappingURL=engulf_blindness.test.js.map