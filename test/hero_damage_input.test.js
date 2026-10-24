import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_STR, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { runMonsterAction } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { moveloop_core } from '../js/allmain.js';
import { initRng } from '../js/rng.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function visibleScreen() {
    return requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
}
function fatalDamageRoom(debug = false) {
    freshObjectRoom({
        flags: { debug, bones: false, disclose: '-i -a -v -c -o', tombstone: false },
        hero: { uhp: 4, uhpmax: 12 },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    return resetInputState();
}
void test('Escape suppresses showdamage prose while nonfatal damage still repaints HP', async () => {
    const input = fatalDamageRoom();
    requirePlayingGame(game);
    game.flags.showdamage = true;
    let sawWarningPager = false;
    input.beforeRead = () => {
        assert.match(visibleScreen(), /You hear stones shift in the ceiling\..*--More--/);
        sawWarningPager = true;
    };
    await plineWithContinuation('You hear stones shift in the ceiling.');
    input.feed('\x1b');
    const dismissal = await flushPendingTopline();
    assert.equal(dismissal, 27);
    assert.equal(sawWarningPager, true, 'Escape must dismiss the actual warning pager');
    const died = await loseHeroHp(2, 'a falling stone');
    assert.equal(died, false);
    assert.equal(game.u.uhp, 2);
    assert.match(visibleScreen(), /HP:2\(12\)/, 'the suppressed damage message must still repaint the status');
    assert.doesNotMatch(visibleScreen(), /\[HP /, 'Escape suppresses the damage annotation');
});
for (const hpAfter of [0, -1, -2]) {
    void test(`fatal damage ending at ${hpAfter} preserves native HP across the death messages`, async () => {
        const input = fatalDamageRoom();
        let sawHitPager = false;
        let sawDeathPager = false;
        input.beforeRead = () => {
            const screen = visibleScreen();
            const expectedHp = hpAfter === -1 ? /HP:4\(12\)/ : /HP:0\(12\)/;
            if (!sawHitPager && screen.includes('A rock hits you.')) {
                sawHitPager = true;
                assert.match(screen, /--More--/);
                assert.match(screen, expectedHp, `Wrong displayed HP while acknowledging damage ending at ${hpAfter}`);
                assert.equal(game.u.uhp, hpAfter, 'display preservation must not undo lethal damage');
                assert.ok(!game.program_state.gameover);
            }
            if (!sawDeathPager && screen.includes('You die...')) {
                sawDeathPager = true;
                assert.match(screen, /--More--/);
                assert.match(screen, expectedHp, `The death window must retain the status drawn for damage ending at ${hpAfter}`);
                assert.equal(game.u.uhp, 0, 'done normalizes HP before its final message window');
            }
        };
        installPagerInput(input, { expected: /rock|die|Goodbye|points|You were/i, limit: 8 });
        await flush_screen(1);
        await plineWithContinuation('A rock hits you.');
        const died = await loseHeroHp(4 - hpAfter, 'a falling rock');
        assert.equal(sawHitPager, true, 'the hit message must be acknowledged before death');
        assert.equal(sawDeathPager, true, 'the final death message must also be acknowledged');
        assert.equal(died, true);
        assert.equal(game.program_state.gameover, true);
        assert.equal(game.u.umortality, 1);
    });
}
// mhitu.c mdamageu() subtracts the full hit without clamping at zero, and
// done_in_by() announces the death before done() commits zero HP.
void test("a monster's lethal melee hit keeps negative HP until done()", async () => {
    const input = freshTurnRoom({ role: 'valkyrie', left: 1, right: 18, top: 1, bottom: 18 });
    requirePlayingGame(game);
    game.flags.bones = false;
    game.flags.disclose = '-i -a -v -c -o';
    game.flags.tombstone = false;
    game.iflags.toptenwin = false;
    game.storage = memoryStorage();
    const hero = game.u;
    hero.uhp = 1;
    hero.uhpmax = 12;
    // A soldier ant's 2d4 bite always overkills a 1-HP hero.
    await createMonsterAt('soldier ant', game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    let lethalPagerHp = null;
    let mortalityAtLethalPager = null;
    let deathWindowHp = null;
    input.beforeRead = () => {
        const screen = visibleScreen();
        if (lethalPagerHp === null && hero.uhp < 1 && /soldier ant (bites|stings)!.*--More--/.test(screen)) {
            lethalPagerHp = hero.uhp;
            mortalityAtLethalPager = hero.umortality ?? 0;
        }
        if (deathWindowHp === null && screen.includes('You die...--More--'))
            deathWindowHp = hero.uhp;
    };
    installPagerInput(input, { expected: /soldier ant|die|Goodbye|Farvel|points|You were/i, limit: 40 });
    input.feed('m.'.repeat(30));
    initRng(7n);
    for (let turn = 0; turn < 30 && !game.program_state.gameover; turn++)
        await moveloop_core();
    assert.equal(game.program_state.gameover, true, 'the ant kills the hero');
    assert.ok(lethalPagerHp !== null && lethalPagerHp < 0, `the lethal bite's pager must see negative HP, saw ${lethalPagerHp}`);
    assert.equal(mortalityAtLethalPager, 0, 'done() has not yet recorded the death');
    assert.equal(deathWindowHp, 0, 'done() commits zero before its own message window');
    assert.equal(game.u.umortality, 1);
});
void test('showdamage at minus one preserves both previously drawn status rows', async () => {
    const input = fatalDamageRoom();
    requirePlayingGame(game);
    game.flags.showdamage = true;
    game.u.uen = 7;
    game.u.uenmax = 9;
    const attributes = game.u.acurr;
    assert.ok(attributes, 'the hero must have initialized attributes');
    attributes.a[A_STR] = 12;
    game.u.amax.a[A_STR] = 12;
    const hitMessage = 'The heavy stone hurled from the far end of the passage strikes you.';
    let sawHitPager = false;
    let sawDamagePager = false;
    input.beforeRead = () => {
        const screen = visibleScreen();
        const hitPager = screen.includes(hitMessage);
        const damagePager = screen.includes('[HP -5, -1 left]');
        if (!hitPager && !damagePager)
            return;
        sawHitPager ||= hitPager;
        sawDamagePager ||= damagePager;
        assert.match(screen, /--More--/);
        assert.match(screen, /HP:4\(12\)/, 'the fatal save sentinel suppresses HP repainting');
        assert.match(screen, /Pw:7\(9\)/, 'energy must retain its previously drawn value too');
        assert.match(screen, /St:12\b/, 'the first status row must remain unchanged too');
        assert.equal(game.u.uhp, -1);
        assert.equal(game.u.uen, 2);
        assert.equal(attributes.a[A_STR], 8);
    };
    installPagerInput(input, { expected: /stone|HP|die|Goodbye|points|You were/i, limit: 10 });
    await flush_screen(1);
    await plineWithContinuation(hitMessage);
    game.u.uen = 2;
    attributes.a[A_STR] = 8;
    const died = await loseHeroHp(5, 'a falling stone');
    assert.equal(sawHitPager, true, 'showdamage must page the preceding hit message');
    assert.equal(sawDamagePager, true, 'the damage annotation must reach its own pager');
    assert.equal(died, true);
    assert.equal(game.u.umortality, 1);
});
for (const recovery of ['life saving', 'debug refusal']) {
    void test(`${recovery} replaces the fatal HP sentinel with zero and then restored HP`, async () => {
        const input = fatalDamageRoom(recovery === 'debug refusal');
        requirePlayingGame(game);
        const amulet = recovery === 'life saving'
            ? await addInventoryObject(AMULET_OF_LIFE_SAVING) : null;
        if (amulet)
            await wearHeroAccessory(amulet, 'uamul');
        let sawHitPager = false;
        let sawRecoveryPrompt = false;
        input.beforeRead = () => {
            const screen = visibleScreen();
            if (!sawHitPager && screen.includes('A rock hits you.')) {
                sawHitPager = true;
                assert.match(screen, /HP:4\(12\)/);
                assert.equal(game.u.uhp, -1);
            }
            if (!sawRecoveryPrompt && /medallion|Die\?/.test(screen)) {
                sawRecoveryPrompt = true;
                assert.match(screen, /HP:0\(12\)/, 'death recovery must display normalized zero HP');
                assert.equal(game.u.uhp, 0);
            }
        };
        installPagerInput(input, { expected: /rock|die|But wait|medallion|much better/i, limit: 10 });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                if (/Die\?/.test(visibleScreen())) {
                    assert.equal(recovery, 'debug refusal');
                    return 'n'.charCodeAt(0);
                }
                return pager.readKey();
            },
        };
        await flush_screen(1);
        await plineWithContinuation('A rock hits you.');
        const died = await loseHeroHp(5, 'a falling rock');
        assert.equal(sawHitPager, true);
        assert.equal(sawRecoveryPrompt, true);
        assert.equal(died, false);
        assert.ok(!game.program_state.gameover);
        assert.equal(game.u.umortality, 1);
        assert.equal(game.u.uhp, 12);
        if (amulet)
            assert.equal(amulet.where, 'gone');
        await flush_screen(1);
        assert.match(visibleScreen(), /HP:12\(12\)/, 'the temporary fatal display must not survive recovery');
    });
}
void test('an ordinary monster hit annotates its damage while showdamage is on', async () => {
    freshObjectRoom({ flags: { showdamage: true }, hero: { uhp: 40, uhpmax: 40 } });
    requirePlayingGame(game);
    const ogre = await createMonsterAt('ogre', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    installPagerInput(input, { expected: /ogre|hit|\[HP/, limit: 8 });
    await runMonsterAction(ogre, game, () => 0, () => 1, () => 1);
    const prose = `${messages.join('\n')}\n${game._pending_message ?? ''}`;
    assert.match(prose, /\[HP -1, 39 left\]/);
    assert.equal(game.u.uhp, 39);
});
//# sourceMappingURL=hero_damage_input.test.js.map