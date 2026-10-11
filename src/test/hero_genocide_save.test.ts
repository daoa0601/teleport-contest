import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { Upolyd } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { GameDisplay } from '../js/game_display.js';
import { doGenocide, GENOCIDE_ON_THRONE } from '../js/genocide.js';
import { game, requireGameDisplay, requirePlayingGame, resetGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';

function genocideRoom(debug = false) {
    freshObjectRoom({
        hero: { urexp: 100 },
        flags: { debug, bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    game.plname = 'Doomed';
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10 })];
    game.iflags.toptenwin = false;
    game.storage = memoryStorage();
    installPolymorphedHero('bat');
    return game.storage;
}

function acknowledgeGenocideMessages() {
    const input = resetInputState();
    input.beforeRead = () => {
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.doesNotMatch(text, /new .+ form.*healthy|You die\.\.\./,
            'Delayed genocide uses its own terminal transition, without an injury announcement');
    };
    installPagerInput(input, {
        expected: /Wiped out|feel dead inside|return to human form|But wait|medallion|much better|still genocided|Goodbye Doomed|points|killed by/,
        limit: 12,
    });
    return input;
}

for (const { how, cause } of [
    { how: 1, cause: 'killed by a scroll of genocide' },
    { how: 1 | GENOCIDE_ON_THRONE, cause: 'killed by an imperious order' },
    { how: 3, cause: 'killed by genocidal confusion' },
]) {
    void test(`saving a doomed monster body retains ${cause} on reversion`, async () => {
        const storage = genocideRoom();
        requirePlayingGame(game);
        acknowledgeGenocideMessages();
        if (how !== 3) pushKeys('human\n');
        await doGenocide(how);
        await flushPendingTopline();
        assert.equal(Upolyd(game.u), true);
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(await saveGame(storage), true);
        resetGame();

        assert.equal(restoreGame('Doomed', storage), true);
        game.storage = storage;
        game.nhDisplay = new GameDisplay(null);
        game.iflags.toptenwin = false;
        initRng(47n);
        requirePlayingGame(game);
        acknowledgeGenocideMessages();
        await loseHeroHp(game.u.mh, 'a falling rock');

        assert.equal(Upolyd(game.u), false);
        assert.equal(game.program_state.gameover, true);
        assert.equal(game.u.umortality, 1);
        const scores = loadScoreRecords();
        assert.equal(scores.length, 1);
        assert.equal(scores[0]?.death, cause);
    });
}

void test('an amulet cannot rescue a saved hero whose original species was genocided', async () => {
    const storage = genocideRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const setupInput = resetInputState();
    installPagerInput(setupInput, { expected: /amulet of life saving/, limit: 1 });
    await flushPendingTopline();
    acknowledgeGenocideMessages();
    pushKeys('human\n');
    await doGenocide(1);
    await flushPendingTopline();
    assert.equal(await saveGame(storage), true);
    resetGame();

    assert.equal(restoreGame('Doomed', storage), true);
    game.storage = storage;
    game.nhDisplay = new GameDisplay(null);
    game.iflags.toptenwin = false;
    initRng(47n);
    requirePlayingGame(game);
    const restoredAmulet = game.uamul;
    assert.ok(restoredAmulet);
    acknowledgeGenocideMessages();
    await loseHeroHp(game.u.mh, 'a falling rock');

    assert.equal(game.program_state.gameover, true);
    assert.equal(restoredAmulet.where, 'gone');
    assert.equal(game.inventory.includes(restoredAmulet), false);
    assert.equal(game.u.umortality, 1);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a scroll of genocide');
});

void test('saving after refused genocide does not revive an old cause on restore', async () => {
    const storage = genocideRoom(true);
    requirePlayingGame(game);
    acknowledgeGenocideMessages();
    pushKeys('human\n');
    await doGenocide(1 | GENOCIDE_ON_THRONE);
    await flushPendingTopline();
    const input = resetInputState();
    installPagerInput(input, { expected: /return to human form|OK, so you don't die/, limit: 3 });
    const pager = input.display;
    assert.ok(pager);
    let refused = false;
    input.display = {
        async readKey() {
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text.includes('Die? [yn] (n)')) {
                assert.equal(refused, false, 'One reversion must prompt for death only once');
                refused = true;
                return 'n'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };
    await loseHeroHp(game.u.mh, 'a falling rock');
    await flushPendingTopline();
    assert.equal(refused, true);
    assert.equal(!!game.program_state.gameover, false);
    assert.ok(game.u.uhp > 0);

    const polymorphInput = resetInputState();
    installPagerInput(polymorphInput, { expected: /turn into a (male |female )?bat|break out|feel/, limit: 5 });
    await polymonHero(MONSTER_NAME.indexOf('bat'));
    await flushPendingTopline();
    assert.equal(await saveGame(storage), true);

    // Another running game has a delayed cause. Restoring the saved survivor
    // must replace that state even though its consumed cause is absent.
    genocideRoom();
    acknowledgeGenocideMessages();
    pushKeys('human\n');
    await doGenocide(1);
    await flushPendingTopline();
    assert.equal(restoreGame('Doomed', storage), true);
    game.storage = storage;
    game.flags.debug = false;
    acknowledgeGenocideMessages();
    await loseHeroHp(game.u.mh, 'a falling rock');

    assert.equal(game.program_state.gameover, true);
    assert.equal(game.u.umortality, 2);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by self-genocide');
});

void test('restore rejects an unknown delayed genocide cause before replacing live state', async () => {
    const storage = genocideRoom();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:doomed';
    const encoded = storage.getItem(key);
    assert.ok(encoded);
    const saved = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
    saved.state._polymorphGenocideCause = 'an arbitrary external death category';
    storage.setItem(key, encodeSavedGraph(saved));
    const hero = game.u;
    const level = game.level;

    assert.equal(restoreGame('Doomed', storage), false);

    assert.equal(game.u, hero);
    assert.equal(game.level, level);
    assert.notEqual(storage.getItem(key), null);
});
