import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { loseHeroStrength } from '../js/attrib.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { AMULET_OF_LIFE_SAVING, ROCK } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { flushPendingTopline } from '../js/display.js';
import { installPagerInput, finishAtCommandInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { requireScreenRow } from './support/screen.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { A_CON, A_STR, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createDungeon } from './support/topology.js';

for (const lifeSaving of [false, true]) {
    void test(lifeSaving
        ? 'weakening finishes its maximum-HP and strength loss after life saving'
        : 'permanent frailty death stops before maximum HP and strength reductions', async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom',
            num_dunlevs: game.u.uz.dlevel,
            dunlev_ureached: game.u.uz.dlevel,
        })];
        const lich = await createMonsterAt('arch-lich', 11, 10, NO_MINVENT);
        lich.mpeaceful = false;
        lich.movement = 12;
        lich.mhp = 100;
        lich.mhpmax = 100;
        game.u.uhp = 1;
        game.u.uhpmax = 500;
        game.u.acurr.a[A_STR] = 4;
        game.u.uac = -1000;
        game.u.coldResistance = true;
        game.storage = memoryStorage();
        game.flags.disclose = '-i -a -v -c -o';
        let amulet;
        if (lifeSaving) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        initRng(24n);
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message || ''); };
        input.feed('m.');
        // One lich attack sequence and one death/life-saving transaction.
        installPagerInput(input, {
            expected: /arch-lich|suddenly feel weaker|You die|But wait|medallion|feel much better|You survived that attempt on your life|Goodbye|frailty|Points.*Name/,
            limit: 6 + 8,
        });

        await moveloop_core();
        if (lifeSaving)
            await finishAtCommandInput(input, () => moveloop_core(), /arch-lich|weaker|medallion|You survived that attempt on your life/);
        else
            await moveloop_core();

        const text = messages.join('\n');
        assert.match(text, /You suddenly feel weaker/);
        if (lifeSaving) {
            assert.equal(!!game.program_state.gameover, false, text);
            assert.equal(game.u.umortality, 1);
            assert.ok(amulet !== undefined && amulet !== null, 'Expected amulet to be initialized');
            assert.equal(amulet.where, 'gone');
            assert.ok(game.u.uhpmax < 500);
            assert.ok(game.u.uhp > 0);
            assert.equal(game.u.acurr.a[A_STR], 3);
        } else {
            assert.equal(game.program_state.gameover, true, text);
            assert.equal(game.u.uhpmax, 500, 'losestr does not return from permanent death');
            assert.equal(game.u.acurr.a[A_STR], 4);
        }
    });
}

for (const fixed of [false, true]) {
    void test(`ordinary strength loss ${fixed ? 'respects fixed abilities' : 'reduces the base value and clears exercise'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.u.acurr.a[A_STR] = 12;
        game.u._exercise = [7, 7, 7, 7, 7, 7];
        game.u.fixedAbilities = fixed;

        assert.equal(await loseHeroStrength(2, null), false);

        assert.equal(game.u.acurr.a[A_STR], fixed ? 12 : 10);
        assert.ok(game.u._exercise !== undefined && game.u._exercise !== null, 'Expected game.u._exercise to be initialized');
        assert.equal(game.u._exercise[A_STR], fixed ? 7 : 0);
    });
}

void test('strength loss below the minimum becomes HP and maximum-HP damage', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 3;

    assert.equal(await loseHeroStrength(2, null), false);

    const damage = 100 - game.u.uhp;
    assert.ok(damage >= 6 && damage <= 12);
    assert.equal(game.u.uhpmax, 100 - damage);
    assert.equal(game.u.acurr.a[A_STR], 3);
});

void test('frailty does not raise a pre-existing HP maximum below the current level', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhpmax: 20, ulevel: 30 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 3;

    assert.equal(await loseHeroStrength(1, null), false);

    assert.equal(game.u.uhpmax, 20);
    assert.ok(game.u.uhp >= 14 && game.u.uhp <= 17);
});

void test('frailty waits for life saving before reducing maximum HP or strength', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 40 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 4;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const input = resetInputState();
    await answerPrompts(flushPendingTopline(), input, [
        { prompt: /amulet of life saving \(being worn\)/, keys: ' ' },
    ]);

    const loss = loseHeroStrength(4, null);
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.uhpmax, 40);
        assert.equal(game.u.acurr.a[A_STR], 4);
        assert.equal(game.uamul, amulet);
    } finally {
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /You die|But wait|medallion/);
        installPagerInput(input, {
            expected: /You die|But wait|medallion|feel much better/,
            limit: 6,
        });
        input.feed(' ');
        assert.equal(await loss, false);
    }

    assert.equal(game.u.umortality, 1);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.u.acurr.a[A_STR], 3);
    assert.ok(game.u.uhpmax >= 22 && game.u.uhpmax <= 31);
    assert.equal(game.u.uhp, game.u.uhpmax);
});

void test('frailty after rehumanization leaves human maximum HP and strength alone', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const humanStrength = game.u.acurr.a[A_STR];
    installPagerInput(resetInputState(), {
        expected: /turn into a kobold|feel like a new|return to .* form/,
        limit: 2,
    });
    await polymonHero(MONSTER_NAME.indexOf('kobold'));
    game.u.mh = 1;
    game.u.mhmax = 20;
    game.u.acurr.a[A_STR] = 4;

    assert.equal(await loseHeroStrength(4, null), false);

    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.acurr.a[A_STR], humanStrength);
    assert.equal(game.u.uhp, 100);
    assert.equal(game.u.uhpmax, 100);
});

void test('a surviving monster body takes frailty without damaging human HP', async () => {
    freshObjectRoom({ hero: { uhp: 40, uhpmax: 40 } });
    requirePlayingGame(game);
    installPolymorphedHero('kobold', { hitPoints: 100 });
    game.u.acurr.a[A_STR] = 4;

    assert.equal(await loseHeroStrength(4, null), false);

    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.uhpmax, 40);
    assert.equal(game.u.acurr.a[A_STR], 3);
    assert.ok(game.u.mh >= 82 && game.u.mh <= 91);
    assert.equal(game.u.mhmax, game.u.mh);
});

void test('lost strength immediately reports a newly burdensome load during play', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 12;
    game.u.acurr.a[A_CON] = 12;
    await addInventoryObject(ROCK, { quan: 62 });
    assert.equal(await answerPrompts(loseHeroStrength(3, null), input, []), false);

    assert.equal(game.u._encumbrance, 'Burdened');
    assert.match(game._pending_message, /Your movements are slowed slightly because of your load/);
});
