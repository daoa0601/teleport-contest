import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { turnUndeadByCallingOnDeity } from '../js/turn_undead.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
import { initRng } from '../js/rng.js';
import { gameLogEvents } from '../js/gamelog.js';
import { setPropertyTimeout } from '../js/properties.js';
const PM_HUMAN_MUMMY = 192;
const PM_HUMAN_ZOMBIE = 244;
function freshPriest(alignment = 1) {
    freshObjectRoom({
        left: 6, right: 14, top: 6, bottom: 14,
        role: 'priest',
        hero: {
            uz: { dnum: 0, dlevel: 6 },
            ulevel: 6,
            ualign: { type: alignment, record: 0 },
        },
        moves: 50,
        objectInitializationSeed: 44n,
    });
    requirePlayingGame(game);
    game.urole.gods = {
        lawful: 'Athena', neutral: 'Hermes', chaotic: 'Loki',
    };
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
}
void test('a lawful priest destroys a zombie and frightens a tougher mummy', async () => {
    freshPriest(1);
    requirePlayingGame(game);
    const zombie = await createMonsterAt(PM_HUMAN_ZOMBIE, 11, 10);
    zombie.m_lev = 4;
    zombie.msleeping = 1;
    const mummy = await createMonsterAt(PM_HUMAN_MUMMY, 12, 10);
    mummy.m_lev = 4;
    mummy.msleeping = 1;
    installPagerInput(resetInputState(), { expected: /Athena|zombie|mummy|turn|destroy/i, limit: 4 });
    await turnUndeadByCallingOnDeity(game, {
        random: range => range - 1,
    });
    assert.ok(zombie.mhp <= 0);
    assert.equal(mummy.mhp, mummy.mhpmax);
    assert.equal(mummy.msleeping, 0);
    assert.equal(mummy.mflee, 1);
    assert.equal(game.context.move, 1);
});
void test('a chaotic priest makes a weak undead monster peaceful', async () => {
    freshPriest(-1);
    requirePlayingGame(game);
    const zombie = await createMonsterAt(PM_HUMAN_ZOMBIE, 11, 10);
    zombie.m_lev = 4;
    zombie.msleeping = 1;
    await turnUndeadByCallingOnDeity(game, {
        random: range => range - 1,
    });
    assert.ok(zombie.mhp > 0);
    assert.equal(zombie.mpeaceful, 1);
    assert.ok(!zombie.mflee);
});
void test('#turn is refused in any hellish dungeon, even with a different dungeon name', async () => {
    freshPriest(1);
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Infernal Caves', flags: { hellish: true } })];
    const zombie = await createMonsterAt('human zombie', 11, 10);
    zombie.mpeaceful = false;
    await runExtendedCommand('turn', '\x1b');
    assert.match(game._pending_message, /Since you are in Gehennom, Athena can't help you\./);
    assert.ok(game.level.monsters.includes(zombie));
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.equal(game.context.move, 1);
});
void test('a hallucinating priest calls upon different imagined deities with #turn', async () => {
    const invocations = new Set();
    for (let seed = 1n; seed <= 4n; seed++) {
        freshPriest(1);
        requirePlayingGame(game);
        game.u.hallucinationTurns = 50;
        initRng(seed);
        await runExtendedCommand('turn');
        assert.match(game._pending_message, /^Calling upon .+, you chant an arcane formula\./);
        invocations.add(game._pending_message);
    }
    assert.ok(invocations.size > 1, 'hallucination must change the deity named by the invocation');
});
void test('an attempted #turn breaks atheism even when strangulation prevents chanting', async () => {
    freshPriest(1);
    requirePlayingGame(game);
    setPropertyTimeout('strangled', 6);
    await runExtendedCommand('turn');
    assert.equal(game.u.uconduct.gnostic, 1);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /You are not able to call upon Athena to turn aside evilness\./);
    assert.ok(gameLogEvents().some(event => event.text === 'rejected atheism by turning undead'));
    await runExtendedCommand('turn', '\x1b');
    assert.equal(game.u.uconduct.gnostic, 2);
    assert.equal(game.context.move, 0);
    assert.equal(gameLogEvents().filter(event => event.text === 'rejected atheism by turning undead').length, 1);
});
void test('a confused #turn wakes its target before the faltering voice is announced', async () => {
    freshPriest(1);
    requirePlayingGame(game);
    const zombie = await createMonsterAt('human zombie', 11, 10);
    zombie.mpeaceful = false;
    zombie.msleeping = 1;
    zombie.mfrozen = 5;
    zombie.mcanmove = 0;
    setPropertyTimeout('confusion', 10);
    const input = resetInputState();
    const turning = runExtendedCommand('turn');
    try {
        const boundary = await Promise.race([
            turning.then(() => 'completed'), input.waitUntilBlocked().then(() => 'input'),
        ]);
        assert.equal(boundary, 'input', 'the invocation must be acknowledged before the faltering announcement');
        assert.equal(zombie.msleeping, 0);
        assert.equal(zombie.mfrozen, 5);
        input.feed(' ');
        await turning;
    }
    finally {
        input.feed('\x1b');
        await turning;
    }
    assert.match(game._pending_message, /Unfortunately, your voice falters\./);
    assert.equal(zombie.mfrozen, 0);
    assert.equal(zombie.mcanmove, 1);
    assert.equal(zombie.mflee, 0);
});
//# sourceMappingURL=turn_undead.test.js.map