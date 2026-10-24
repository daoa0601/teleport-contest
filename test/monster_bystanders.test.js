import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import { initializePet } from '../js/dog.js';
import { pushKeys } from '../js/input.js';
import { angerMonster } from '../js/monster_anger.js';
import { makeMonsterFlee } from '../js/monster_flee.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function topline() {
    await flush_screen();
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'the display has a message row');
    return row.map(cell => cell.ch).join('').trimEnd();
}
for (const blind of [false, true]) {
    void test(`quest guardians become angry ${blind ? 'silently when only sensed' : 'visibly when seen'}`, async () => {
        freshObjectRoom({ role: 'archeologist', hero: { telepathy: true } });
        requirePlayingGame(game);
        const leader = await createMonsterAt('Lord Carnarvon', 11, 10, NO_MINVENT);
        const guardian = await createMonsterAt('student', 12, 10, NO_MINVENT);
        leader.mpeaceful = guardian.mpeaceful = 1;
        if (blind)
            await makeBlinded(10, { talk: false });
        pushKeys(' '.repeat(20));
        await angerMonster(leader, { attacked: true });
        assert.equal(guardian.mpeaceful, 0);
        if (blind)
            assert.doesNotMatch(game._pending_message, /appears to be angry too/);
        else
            assert.match(game._pending_message, /The student appears to be angry too/);
    });
}
void test('an immobile humanoid bystander flinches instead of announcing that it turns', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const victim = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const observer = await createMonsterAt('gnome', 12, 10, NO_MINVENT);
    victim.mpeaceful = observer.mpeaceful = 1;
    observer.mcanmove = 0;
    observer.mfrozen = 10;
    initRng(1n);
    pushKeys(' '.repeat(20));
    await angerMonster(victim);
    assert.equal(observer.mflee, 1);
    assert.equal(observer.mpeaceful, 0);
    assert.match(await topline(), /The immobile gnome seems to flinch\./);
});
void test('humanoid fear uses species level rather than the level gained at creation', async () => {
    freshObjectRoom({ hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const victim = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const observer = await createMonsterAt('elf-lord', 12, 10, NO_MINVENT);
    victim.mpeaceful = observer.mpeaceful = 1;
    assert.ok(observer.m_lev >= 10, 'the real creation path produced a high-level elf');
    initRng(9n);
    pushKeys(' '.repeat(20));
    await angerMonster(victim);
    assert.equal(observer.mflee, 1);
    assert.ok(observer.mfleetim !== undefined && observer.mfleetim >= 25 && observer.mfleetim <= 74);
    assert.equal(observer.mpeaceful, 0);
});
for (const ownGuardian of [false, true]) {
    void test(`a neanderthal bystander ${ownGuardian ? 'defends its own quest without fleeing' : 'can flee outside its own quest'}`, async () => {
        freshObjectRoom({ role: ownGuardian ? 'caveman' : 'knight' });
        requirePlayingGame(game);
        const victim = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        const observer = await createMonsterAt('neanderthal', 12, 10, NO_MINVENT);
        victim.mpeaceful = observer.mpeaceful = 1;
        observer.mstrategy = (observer.mstrategy ?? 0) | STRAT_WAITFORU;
        const alignment = game.u.ualign.record;
        initRng(9n);
        pushKeys(' '.repeat(20));
        await angerMonster(victim);
        assert.equal(observer.mpeaceful, 0);
        assert.equal(Boolean(observer.mflee), !ownGuardian);
        assert.equal((observer.mstrategy ?? 0) & STRAT_WAITFORU, 0);
        assert.equal(game.u.ualign.record, alignment - 2);
    });
}
for (const attacksGuardian of [false, true]) {
    void test(`Shaman Karnov ${attacksGuardian ? 'gets angry when his guardian is attacked' : 'stays peaceful when a stranger is attacked'}`, async () => {
        freshObjectRoom({ role: 'caveman' });
        requirePlayingGame(game);
        const victim = await createMonsterAt(attacksGuardian ? 'neanderthal' : 'goblin', 11, 10, NO_MINVENT);
        const leader = await createMonsterAt('Shaman Karnov', 12, 10, NO_MINVENT);
        victim.mpeaceful = leader.mpeaceful = 1;
        initRng(9n);
        pushKeys(' '.repeat(20));
        await angerMonster(victim);
        assert.equal(Boolean(leader.mpeaceful), !attacksGuardian);
        assert.equal(Boolean(leader.mflee), false);
    });
}
for (const turns of [0, 30]) {
    void test(`a humanoid bystander already fleeing ${turns ? 'for a time' : 'without a timer'} keeps that fear`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const victim = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        const observer = await createMonsterAt('gnome', 12, 10, NO_MINVENT);
        victim.mpeaceful = observer.mpeaceful = 1;
        await makeMonsterFlee(observer, { turns, announce: false });
        initRng(9n);
        pushKeys(' '.repeat(20));
        await angerMonster(victim);
        assert.equal(observer.mflee, 1);
        assert.equal(observer.mfleetim, turns);
        assert.equal(observer.mpeaceful, 0);
        assert.doesNotMatch(await topline(), /turns to flee/);
    });
}
void test('a tame humanoid can flee after witnessing an attack without turning hostile', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const victim = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const observer = await createMonsterAt('gnome', 12, 10, NO_MINVENT);
    victim.mpeaceful = 1;
    initializePet(observer);
    const tameness = observer.mtame;
    assert.ok(tameness !== undefined && tameness > 0);
    const alignment = game.u.ualign.record;
    initRng(9n);
    pushKeys(' '.repeat(20));
    await angerMonster(victim);
    assert.equal(observer.mflee, 1);
    assert.equal(observer.mpeaceful, 1);
    assert.equal(observer.mtame, tameness);
    assert.equal(game.u.ualign.record, alignment - 1);
});
void test('a Vrock bystander releases gas when its own kind is attacked', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const victim = await createMonsterAt('vrock', 11, 10, NO_MINVENT);
    const observer = await createMonsterAt('vrock', 12, 10, NO_MINVENT);
    victim.mpeaceful = observer.mpeaceful = 1;
    initRng(3n);
    pushKeys(' '.repeat(20));
    await angerMonster(victim);
    assert.equal(observer.mflee, 1);
    assert.ok(observer.mfleetim !== undefined && observer.mfleetim >= 15 && observer.mfleetim <= 39);
    assert.equal(observer.mpeaceful, 1);
    assert.ok(observer.mspec_used !== undefined && observer.mspec_used >= 75 && observer.mspec_used <= 99);
    const cloud = game.level.regions.find(region => region.cells.some(cell => cell.x === observer.mx && cell.y === observer.my));
    assert.ok(cloud, 'the frightened bystander produced its poison cloud');
});
for (const verbose of [false, true]) {
    void test(`a named humanoid combines its gasp with flight only when verbose=${verbose}`, async () => {
        freshObjectRoom({ flags: { verbose } });
        requirePlayingGame(game);
        const victim = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        const observer = await createMonsterAt('human', 12, 10, NO_MINVENT);
        setMonsterGivenName(observer, 'Pip');
        victim.mpeaceful = observer.mpeaceful = 1;
        initRng(7n);
        pushKeys(' '.repeat(20));
        await angerMonster(victim);
        assert.equal(observer.mflee, 1);
        assert.match(await topline(), verbose
            ? /Pip exclaims "Why\?" and then turns to flee\.$/
            : /Pip exclaims "Why\?"$/);
    });
}
//# sourceMappingURL=monster_bystanders.test.js.map