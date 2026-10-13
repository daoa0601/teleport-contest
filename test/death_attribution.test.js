import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { finishOrdinaryDeath } from '../js/end.js';
import { game, requireGameDisplay, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishMonsterAttackDeath } from '../js/monster_attack_death.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { restoreGame, saveGame } from '../js/save.js';
import { loadScoreRecords } from '../js/score_records.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { installPagerInput } from './support/pager-input.js';
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('an invisible monster keeps its invisibility in the tombstone and score entry', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
    requirePlayingGame(game);
    const xorn = await createMonsterAt('xorn', 11, 10);
    xorn.minvis = true;
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const input = resetInputState();
    let tombstone = '';
    input.beforeRead = () => {
        if (visibleText().includes('REST'))
            tombstone = visibleText();
    };
    installPagerInput(input, { expected: /die|Goodbye|points|You were/i, limit: 8 });
    await finishMonsterAttackDeath(xorn);
    assert.match(tombstone, /killed by an/);
    assert.match(tombstone, /invisible xorn/);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by an invisible xorn');
});
void test('a named monster death sanitizes punctuation on the tombstone and score entry', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
    requirePlayingGame(game);
    const xorn = await createMonsterAt('xorn', 11, 10);
    setMonsterGivenName(xorn, 'Bob,=Joe');
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const input = resetInputState();
    let tombstone = '';
    input.beforeRead = () => {
        if (visibleText().includes('REST'))
            tombstone = visibleText();
    };
    installPagerInput(input, { expected: /die|Goodbye|points|You were/i, limit: 8 });
    await finishMonsterAttackDeath(xorn);
    assert.match(tombstone, /Bob;_Joe/);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a xorn called Bob;_Joe');
});
for (const { species, female, killer } of [
    { species: 'Vlad the Impaler', female: false, killer: 'a Vlad the Impaler in vampire bat form' },
    { species: 'vampire', female: false, killer: 'a vampire in bat form' },
    { species: 'vampire leader', female: true, killer: 'a vampire lady in bat form' },
]) {
    void test(`death in vampire bat form attributes the killer to ${species}`, async () => {
        freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
        requirePlayingGame(game);
        const bat = await createMonsterAt('vampire bat', 11, 10);
        bat.cham = MONSTER_NAME.indexOf(species);
        bat.female = female;
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.iflags.toptenwin = false;
        const input = resetInputState();
        installPagerInput(input, { expected: /die|Goodbye|points|You were/i, limit: 8 });
        await finishMonsterAttackDeath(bat);
        assert.equal(loadScoreRecords()[0]?.death, `killed by ${killer}`);
    });
}
void test('a death while fainted includes helplessness in the score but leaves the tombstone cause concise', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    game._helplessTurns = 7;
    game._helplessReason = 'fainted from lack of food';
    const input = resetInputState();
    let tombstone = '';
    input.beforeRead = () => {
        if (visibleText().includes('REST'))
            tombstone = visibleText();
    };
    installPagerInput(input, { expected: /Goodbye|points|You were/i, limit: 8 });
    await finishOrdinaryDeath({ killer: 'fox' });
    assert.match(tombstone, /killed by a fox/);
    assert.doesNotMatch(tombstone, /fainted/);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a fox, while fainted from lack of food');
});
for (const restored of [false, true]) {
    for (const sameKiller of [true, false]) {
        void test(`${restored ? 'saved' : 'ongoing'} paralysis ${sameKiller ? 'omits' : 'keeps'} the ghoul attribution when ${sameKiller ? 'that ghoul' : 'another ghoul'} kills the hero`, async () => {
            freshObjectRoom({
                hero: { uhp: 100, uhpmax: 100, uac: 10 },
                flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
            });
            requirePlayingGame(game);
            game.plname = 'GhoulVictim';
            const storage = memoryStorage();
            game.storage = storage;
            game.u.urexp = 100;
            game.iflags.toptenwin = false;
            const ghoul = await createMonsterAt('ghoul', 11, 10);
            ghoul.mpeaceful = 0;
            ghoul.m_lev = 20;
            ghoul.mux = game.u.ux;
            ghoul.muy = game.u.uy;
            const killer = sameKiller ? ghoul : await createMonsterAt('ghoul', 10, 11);
            const killerId = killer.m_id;
            let input = resetInputState();
            installPagerInput(input, { expected: /claws|frozen/i, limit: 8 });
            await performMonsterHeroAttack(ghoul, game, {
                random: () => 0, rollOne: () => 1, rollDice: () => 1,
            });
            assert.ok((game._helplessTurns ?? 0) > 0, 'The ghoul must paralyze the hero before the fatal attack');
            if (restored) {
                assert.equal(await saveGame(storage), true);
                assert.equal(restoreGame('GhoulVictim', storage), true);
                input = resetInputState();
            }
            const fatalGhoul = requireGameLevel().monsters.find(monster => monster.m_id === killerId);
            assert.ok(fatalGhoul, 'The ghoul killer must remain on the level after restoring');
            installPagerInput(input, { expected: /hits|frozen|die|Goodbye|points|You were|Your body rises from the dead as a ghoul/i, limit: 8 });
            await finishMonsterAttackDeath(fatalGhoul);
            assert.equal(loadScoreRecords()[0]?.death, `killed by a ghoul, while paralyzed${sameKiller ? '' : ' by a ghoul'}`);
        });
    }
}
for (const { causeLength, expectedSuffix } of [
    { causeLength: 64, expectedSuffix: ', while paralyzed by a floating eye' },
    { causeLength: 65, expectedSuffix: ', while helpless' },
    { causeLength: 83, expectedSuffix: ', while helpless' },
    { causeLength: 84, expectedSuffix: '' },
    { causeLength: 110, expectedSuffix: '' },
]) {
    void test(`a helpless death with a ${causeLength}-character cause fits the native score field`, async () => {
        freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
        requirePlayingGame(game);
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.iflags.toptenwin = false;
        game._helplessTurns = 7;
        game._helplessReason = 'paralyzed by a floating eye';
        const prefix = 'killed by an orc called ';
        const cause = prefix + 'O'.repeat(causeLength - prefix.length);
        const input = resetInputState();
        installPagerInput(input, { expected: /Goodbye|points|You were/i, limit: 8 });
        await finishOrdinaryDeath({ killer: 'orc', deathCause: cause });
        assert.equal(loadScoreRecords()[0]?.death, cause.slice(0, 100) + expectedSuffix);
    });
}
//# sourceMappingURL=death_attribution.test.js.map