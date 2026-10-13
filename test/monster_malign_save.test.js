import test from 'node:test';
import assert from 'node:assert/strict';
import { A_LAWFUL, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { restoreGame, saveGame } from '../js/save.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { SAVE_VERSION } from '../js/state_schema.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const { description, version } of [
    { description: 'version-24', version: 24 },
    { description: 'current-format', version: SAVE_VERSION },
]) {
    void test(`restore rejects a ${description} monster without kill-alignment history before replacing live state`, async () => {
        const level = freshObjectRoom();
        const hero = game.u;
        const watchman = await createMonsterAt('watchman', 11, 10, NO_MINVENT | MM_ANGRY);
        game.plname = 'Watchman';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:watchman';
        const encoded = storage.getItem(key);
        assert.ok(encoded);
        const saved = decodeSavedGraph(encoded);
        assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
        assert.ok(isSavedRecord(saved.state.level));
        assert.ok(Array.isArray(saved.state.level.monsters));
        const monsters = saved.state.level.monsters;
        const savedWatchman = monsters[0];
        assert.ok(isSavedRecord(savedWatchman));
        saved.version = version;
        delete savedWatchman.malign;
        storage.setItem(key, encodeSavedGraph(saved));
        assert.equal(restoreGame('Watchman', storage), false);
        assert.equal(game.u, hero);
        assert.equal(game.level, level);
        assert.equal(level.monsters[0], watchman);
        assert.notEqual(storage.getItem(key), null);
    });
}
void test('killing a restored hostile watchman rewards alignment without a murder penalty', async () => {
    freshObjectRoom({ moves: 2000, hero: { uluck: 0 } });
    const watchman = await createMonsterAt('watchman', 11, 10, NO_MINVENT | MM_ANGRY);
    assert.equal(watchman.mpeaceful, 0);
    game.plname = 'Watchman';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Watchman', storage), true);
    requirePlayingGame(game);
    const restored = game.level.monsters.find(monster => monster.m_id === watchman.m_id);
    assert.ok(restored);
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /You murderer!/, limit: 1 });
    input.beforeRead = () => { messages.push(game._pending_message); };
    await finishHeroMonsterKill(restored, restored.mx, restored.my, {
        showKillMessage: false, noCorpse: true,
    });
    messages.push(game._pending_message);
    assert.equal(game.u.ualign.record, 15);
    assert.equal(game.u.uluck, 0);
    assert.doesNotMatch(messages.join('\n'), /You murderer!/);
});
for (const peaceful of [true, false]) {
    void test(`restoring a ${peaceful ? 'peaceful' : 'hostile'} pony retains its kill alignment after the hero changes alignment`, async () => {
        freshObjectRoom({ gameplaySeed: 3n });
        requirePlayingGame(game);
        const pony = await createMonsterAt('pony', 11, 10, NO_MINVENT | (peaceful ? 0 : MM_ANGRY));
        assert.equal(!!pony.mpeaceful, peaceful);
        game.u.ualign.type = A_LAWFUL;
        game.plname = 'Pony';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('Pony', storage), true);
        requirePlayingGame(game);
        const restored = game.level.monsters.find(monster => monster.m_id === pony.m_id);
        assert.ok(restored);
        await finishHeroMonsterKill(restored, restored.mx, restored.my, {
            showKillMessage: false, noCorpse: true,
        });
        assert.equal(game.u.ualign.record, peaceful ? -14 : 3);
    });
}
//# sourceMappingURL=monster_malign_save.test.js.map