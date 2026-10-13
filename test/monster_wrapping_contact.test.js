import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, POOL } from '../js/const.js';
import { canSpotMonster, flushPendingTopline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, LEATHER_CLOAK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
import { createDungeon } from './support/topology.js';
for (const grip of ['new hold', 'failed hold', 'greased cloak', 'cancelled hold', 'existing cancelled hold']) {
    void test(`a couatl follows the wrapping rules for a ${grip}`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const couatl = await createMonsterAt('couatl', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        couatl.mux = game.u.ux;
        couatl.muy = game.u.uy;
        couatl.mcan = grip.includes('cancelled') ? 1 : 0;
        if (grip === 'existing cancelled hold')
            game.u.ustuck = couatl;
        const cloak = grip === 'greased cloak'
            ? await addInventoryObject(LEATHER_CLOAK, { greased: true }) : null;
        if (cloak)
            wearHeroArmor(cloak);
        const messages = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /couatl|grease/, limit: 8 });
        input.beforeRead = () => { messages.push(game._pending_message); };
        await performMonsterHeroAttack(couatl, game, {
            random: limit => limit === 10 ? (grip === 'failed hold' ? 9 : 0)
                : limit === 2 ? 0 : limit - 1,
            rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();
        const held = grip === 'new hold' || grip === 'existing cancelled hold';
        assert.equal(game.u.ustuck === couatl, held);
        assert.equal(game.u.uhp, held ? 95 : 97, 'wrapping damage requires a successful or existing hold');
        const text = messages.join('\n');
        if (grip === 'new hold')
            assert.match(text, /swings itself around you!/);
        if (grip === 'existing cancelled hold')
            assert.match(text, /You are being crushed\./);
        if (grip === 'failed hold')
            assert.match(text, /brushes against your leg\./);
        if (cloak) {
            assert.match(text, /slips off of your greased leather cloak!/);
            assert.equal(cloak.greased, false, 'slipping can wear off the protective grease');
        }
        assert.doesNotMatch(text, /couatl hits!/);
    });
}
void test('a missed bite prevents a couatl from starting its automatic hug', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const couatl = await createMonsterAt('couatl', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    couatl.m_lev = 0;
    couatl.mux = game.u.ux;
    couatl.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /couatl/, limit: 5 });
    await performMonsterHeroAttack(couatl, game, {
        random: limit => limit === 10 ? 0 : limit - 1,
        rollOne: sides => sides === 20 ? 20 : 1, rollDice: count => count,
    });
    assert.equal(game.u.uhp, 99, 'only the second bite hits');
    assert.ok(!game.u.ustuck);
});
void test('an unseen couatl is described as something when it starts a hold', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const couatl = await createMonsterAt('couatl', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    couatl.minvis = true;
    couatl.mux = game.u.ux;
    couatl.muy = game.u.uy;
    assert.equal(canSpotMonster(couatl), false);
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /It|Something/, limit: 5 });
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(couatl, game, {
        random: limit => limit === 10 ? 0 : limit - 1,
        rollOne: () => 1, rollDice: count => count,
    });
    await flushPendingTopline();
    assert.equal(game.u.ustuck, couatl);
    assert.match(messages.join('\n'), /Something swings itself around you!/);
});
void test('hallucination can describe an unseen wrapping animal as someone or something', async () => {
    freshObjectRoom({ hero: { uhp: 1000, uhpmax: 1000, uac: 10, hallucinationTurns: 20 } });
    requirePlayingGame(game);
    const couatl = await createMonsterAt('couatl', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    couatl.minvis = true;
    couatl.mux = game.u.ux;
    couatl.muy = game.u.uy;
    assert.equal(canSpotMonster(couatl), false);
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /It|Something|Someone/, limit: 64 });
    input.beforeRead = () => { messages.push(game._pending_message); };
    for (let attempt = 0; attempt < 16; attempt++) {
        game.u.ustuck = null;
        await performMonsterHeroAttack(couatl, game, {
            random: limit => limit === 10 ? 0 : limit - 1,
            rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();
        assert.equal(game.u.ustuck, couatl);
    }
    const text = messages.join('\n');
    assert.match(text, /Someone swings itself around you!/);
    assert.match(text, /Something swings itself around you!/);
});
void test('an eel holding a breathing hero underwater triggers life saving', async () => {
    const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = POOL;
    const eel = await createMonsterAt('giant eel', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    eel.mundetected = 0;
    eel.mux = game.u.ux;
    eel.muy = game.u.uy;
    game.u.ustuck = eel;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const input = resetInputState();
    installPagerInput(input, { expected: /eel|medallion|better|wait|amulet of life saving/, limit: 12 });
    await performMonsterHeroAttack(eel, game, {
        random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
    });
    assert.equal(game.inventory.includes(amulet), false, 'drowning consumes the life-saving amulet');
    assert.equal(game.u.umortality, 1);
    assert.ok(!game.program_state.gameover);
});
void test('an eel drowning the hero uses drowned in both final summary lines', async () => {
    const level = freshObjectRoom({
        hero: { uhp: 100, uhpmax: 100, uac: 10 },
        flags: { verbose: true, bones: false, disclose: '-i -a -v -g -c -o', tombstone: false },
    });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    level.requireAt(11, 10).typ = POOL;
    const eel = await createMonsterAt('giant eel', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    eel.mundetected = 0;
    eel.mux = game.u.ux;
    eel.muy = game.u.uy;
    game.u.ustuck = eel;
    const input = resetInputState();
    installPagerInput(input, { expected: /eel|Goodbye/, limit: 8 });
    let endingText = '';
    input.beforeRead = () => {
        if (game.program_state.gameover) {
            endingText += requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('').trim())
                .filter(row => /You (?:died|drowned|were level)/.test(row)).join('\n');
        }
    };
    await performMonsterHeroAttack(eel, game, {
        random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
    });
    assert.equal(game.program_state.gameover, true);
    assert.match(endingText, /You drowned in The Dungeons of Doom/);
    assert.match(endingText.replace(/\s+/g, ' '), /when you drowned\./);
});
//# sourceMappingURL=monster_wrapping_contact.test.js.map