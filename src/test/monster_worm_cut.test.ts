import test from 'node:test';
import assert from 'node:assert/strict';

import { G_EXTINCT, MM_ANGRY, MM_NOTAIL, NO_MINVENT, PANICLOG } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { InputGate, bindInputGate, resetInputState } from '../js/input.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { monsterStatusLine } from '../js/monster_status.js';
import { cutWorm, initializeMonsterWormBody } from '../js/monster_worm.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';

async function wormWithTail() {
    freshObjectRoom({ left: 8, right: 25, top: 6, bottom: 15, heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 16, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    initializeMonsterWormBody(worm, { segmentCount: 5, random: () => 0 });
    assertWormBody(worm);
    assert.equal(worm.wormSegments.length, 5, 'The test needs a body with a middle segment.');
    worm.m_lev = 8;
    worm.mhp = worm.mhpmax = 80;
    worm.wormGrowTime = 100;
    installPagerInput(resetInputState(), { expected: /cut|worm/, limit: 5 });
    return worm;
}

void test('a blow to the head cannot sever the worm', async () => {
    const worm = await wormWithTail();

    await cutWorm(worm, worm.mx, worm.my, true, { rollOne: () => 20 });

    assert.equal(worm.wormSegments.length, 5);
    assert.equal(worm.mhp, 80);
});

void test('cutting a nonexistent segment reports the bad position and leaves the worm alive', async () => {
    const worm = await wormWithTail();
    const storage = memoryStorage();
    game.storage = storage;
    installPagerInput(resetInputState(), {
        expected: /cutworm: no segment|Program in disorder|Please report/,
        limit: 4,
    });

    await cutWorm(worm, 1, 0, true, { rollOne: () => 20 });

    assert.equal(worm.wormSegments.length, 5);
    assert.equal(worm.mhp, 80);
    assert.equal(!!game.program_state.gameover, false);
    const report: unknown = JSON.parse((storage.getItem(PANICLOG) ?? '').trim());
    assert.ok(report && typeof report === 'object' && 'reason' in report);
    assert.equal(report.reason, 'cutworm: no segment at (1,0)');
});

for (const [blade, chance, cuts] of [
    [false, 16, false], [false, 17, true], [true, 6, false], [true, 7, true],
] satisfies [boolean, number, boolean][]) {
    void test(`${blade ? 'a blade' : 'a blunt blow'} with cut chance ${chance} ${cuts ? 'severs' : 'retains'} the tail tip`, async () => {
        const worm = await wormWithTail();
        requirePlayingGame(game);
        const tip = worm.wormSegments.at(-1);
        assert.ok(tip);

        await cutWorm(worm, tip.x, tip.y, blade, { rollOne: () => chance });

        assert.equal(monsterAtPosition(game.level, tip.x, tip.y), cuts ? null : worm);
        assert.equal(worm.wormSegments.length, cuts ? 4 : 5);
        assert.equal(worm.mhp, 80, 'Losing just the tail tip costs no additional HP.');
        assert.equal(worm.mhpmax, 80);
        assert.equal(worm.wormGrowTime, 100);
    });
}

void test('a severed middle section that dies halves current HP without counting a death', async () => {
    const worm = await wormWithTail();
    requirePlayingGame(game);
    const cut = worm.wormSegments[1];
    const tip = worm.wormSegments.at(-1);
    assert.ok(cut && tip);
    const vital = requireMonsterVital(worm.mnum);
    const births = vital.born, deaths = vital.died;
    worm.mhp = 79;

    await cutWorm(worm, cut.x, cut.y, true, { rollOne: () => 20, random: () => 1 });

    assert.equal(worm.wormSegments.length, 1);
    assert.equal(monsterAtPosition(game.level, cut.x, cut.y), null);
    assert.equal(monsterAtPosition(game.level, tip.x, tip.y), null);
    assert.equal(worm.mhp, 39);
    assert.equal(worm.mhpmax, 80);
    assert.equal(vital.born, births);
    assert.equal(vital.died, deaths);
    assert.match(game._last_message, /You cut part of the tail off/);
});

void test('a surviving severed body gets its own head, tail, level and identity', async () => {
    const worm = await wormWithTail();
    requirePlayingGame(game);
    const cut = worm.wormSegments[1];
    const retained = worm.wormSegments[0];
    const tip = worm.wormSegments.at(-1);
    assert.ok(cut && retained && tip);
    const vital = requireMonsterVital(worm.mnum);
    const births = vital.born;

    await cutWorm(worm, cut.x, cut.y, true, {
        rollOne: () => 20, random: () => 0, rollDice: count => count * 4,
    });

    const child = monsterAtPosition(game.level, cut.x, cut.y);
    assert.ok(child);
    assert.notEqual(child, worm);
    assertWormBody(child);
    assert.equal(monsterAtPosition(game.level, tip.x, tip.y), child);
    assert.equal(monsterAtPosition(game.level, retained.x, retained.y), worm);
    assert.equal(child.mx, cut.x);
    assert.equal(child.my, cut.y);
    assert.notEqual(child.m_id, worm.m_id);
    assert.notEqual(child.wormno, worm.wormno);
    assert.equal(child.wormSegments.length, 3);
    assert.equal(child.wormGrowTime, 0);
    assert.equal(worm.wormGrowTime, 100);
    assert.equal(child.mcloned, 0);
    assert.equal(child.m_lev, 6);
    assert.equal(worm.m_lev, 6);
    assert.equal(child.mhp, 24);
    assert.equal(child.mhpmax, 24);
    assert.equal(worm.mhp, 24);
    assert.equal(worm.mhpmax, 24);
    assert.equal(vital.born, births, 'Splitting does not tally a makemon birth.');
    assert.match(game._last_message, /You cut the long worm in half/);
});

for (const impediment of ['too young', 'one HP', 'extinct'] satisfies string[]) {
    void test(`the severed half cannot survive when the worm is ${impediment}`, async () => {
        const worm = await wormWithTail();
        requirePlayingGame(game);
        const cut = worm.wormSegments[1];
        assert.ok(cut);
        if (impediment === 'too young') worm.m_lev = 2;
        if (impediment === 'one HP') worm.mhp = 1;
        if (impediment === 'extinct') requireMonsterVital(worm.mnum).mvflags |= G_EXTINCT;

        await cutWorm(worm, cut.x, cut.y, true, { rollOne: () => 20, random: () => 0 });

        assert.equal(monsterAtPosition(game.level, cut.x, cut.y), null);
        assert.equal(game.level.monsters.length, 1);
        assert.equal(worm.mhp, impediment === 'one HP' ? 1 : 40);
        assert.equal(worm.mhpmax, 80);
    });
}

void test('a surviving tame half reinitializes tameness and owns a separate pet record', async () => {
    const worm = await wormWithTail();
    requirePlayingGame(game);
    initializePet(worm);
    assert.ok(worm.edog);
    worm.mtame = 17;
    worm.mflee = 1;
    worm.mfleetim = 9;
    worm.meating = 6;
    worm.edog.hungrytime = 1200;
    worm.edog.apport = 7;
    const cut = worm.wormSegments[1];
    assert.ok(cut);

    await cutWorm(worm, cut.x, cut.y, true, {
        rollOne: () => 20, random: limit => limit === 3 ? 0 : 1,
    });

    const child = monsterAtPosition(game.level, cut.x, cut.y);
    assert.ok(child && child !== worm && child.edog);
    assert.equal(child.mtame, 5);
    assert.equal(child.pet, true);
    assert.equal(child.mpeaceful, 1);
    assert.equal(child.mflee, 0);
    assert.equal(child.mfleetim, 0);
    assert.equal(child.meating, 0);
    assert.equal(worm.mtame, 17);
    assert.equal(worm.meating, 6);
    assert.notEqual(child.edog, worm.edog);
    assert.notEqual(child.edog.ogoal, worm.edog.ogoal);
    assert.equal(child.edog.hungrytime, 1200);
    assert.equal(child.edog.apport, 7);
});

void test('a hero-caused peaceful split can create a hostile half without changing a neutral worm\'s alignment reward', async () => {
    const worm = await wormWithTail();
    requirePlayingGame(game);
    worm.mpeaceful = 1;
    const cut = worm.wormSegments[1];
    assert.ok(cut);

    await cutWorm(worm, cut.x, cut.y, true, { rollOne: () => 20, random: () => 0 });

    const child = monsterAtPosition(game.level, cut.x, cut.y);
    assert.ok(child && child !== worm);
    assert.equal(worm.mpeaceful, 1);
    assert.equal(child.mpeaceful, 0);
    // Native always-hostile species grant no alignment for a coaligned kill,
    // even when this particular parent was peaceful before the cut.
    assert.equal(child.malign, 0);
});

void test('a monster-caused split preserves peacefulness and reports the passive cut', async () => {
    const worm = await wormWithTail();
    requirePlayingGame(game);
    game.context.mon_moving = true;
    worm.mpeaceful = 1;
    const cut = worm.wormSegments[1];
    assert.ok(cut);

    await cutWorm(worm, cut.x, cut.y, false, { rollOne: () => 20, random: () => 0 });

    const child = monsterAtPosition(game.level, cut.x, cut.y);
    assert.ok(child && child !== worm);
    assert.equal(child.mpeaceful, 1);
    assert.match(game._last_message, /The long worm is cut in half/);
});

void test('a paralyzed tame half does not retain the original pet record', async () => {
    const worm = await wormWithTail();
    initializePet(worm);
    worm.mcanmove = 0;
    worm.mfrozen = 8;

    requirePlayingGame(game);
    const cut = worm.wormSegments[1];
    assert.ok(cut);

    await cutWorm(worm, cut.x, cut.y, true, {
        rollOne: () => 20, random: limit => limit === 3 ? 0 : 1,
    });

    const child = monsterAtPosition(game.level, cut.x, cut.y);
    assert.ok(child && child !== worm);
    assert.equal(child.mtame, 0);
    assert.equal(child.pet, false);
    assert.equal(child.edog, undefined);
    assert.equal(child.mextra?.edog, undefined);
    assert.equal(child.mfrozen, 4);
    assert.equal(worm.mfrozen, 8);
});

void test('a severed body remains on the map while its sleeping new head wakes', async () => {
    const worm = await wormWithTail();
    requirePlayingGame(game);
    initializePet(worm);
    worm.msleeping = 1;
    const cut = worm.wormSegments[1];
    const tip = worm.wormSegments.at(-1);
    assert.ok(cut && tip);
    await plineWithContinuation('You pause to look at the sleeping long worm and its many tail segments.');
    const gate = new InputGate();
    bindInputGate(gate);

    const splitting = cutWorm(worm, cut.x, cut.y, true, {
        rollOne: () => 20, random: limit => limit === 3 ? 0 : 1,
    });
    const boundary = await Promise.race([
        gate.waitUntilBlocked().then(() => 'pager'),
        splitting.then(() => 'finished'),
    ]);
    try {
        assert.equal(boundary, 'pager', 'The wake-up message must wait for the previous long message.');
        assert.equal(monsterAtPosition(game.level, tip.x, tip.y)?.m_id, worm.m_id,
            'The detached tail still belongs to the original worm until the split completes.');
    } finally {
        gate.feed(' '.repeat(8));
        await splitting;
    }
    const child = monsterAtPosition(game.level, cut.x, cut.y);
    assert.ok(child && child !== worm);
    assert.equal(monsterAtPosition(game.level, tip.x, tip.y), child);
});

void test('a dying severed body remains mapped during its message without extending the retained worm', async () => {
    const worm = await wormWithTail();
    requirePlayingGame(game);
    const cut = worm.wormSegments[1];
    const tip = worm.wormSegments.at(-1);
    assert.ok(cut && tip);
    await plineWithContinuation('You pause to look at the long worm and its many winding tail segments.');
    const gate = new InputGate();
    bindInputGate(gate);

    const splitting = cutWorm(worm, cut.x, cut.y, true, {
        rollOne: () => 20, random: () => 1,
    });
    const boundary = await Promise.race([
        gate.waitUntilBlocked().then(() => 'pager'),
        splitting.then(() => 'finished'),
    ]);
    try {
        assert.equal(boundary, 'pager', 'The cut-off message must wait for the previous long message.');
        assert.equal(monsterAtPosition(game.level, tip.x, tip.y)?.m_id, worm.m_id);
        assert.match(await monsterStatusLine(worm), /, 1st of 2 segments/,
            'Probing counts only the retained body even before the detached half leaves the map.');
    } finally {
        gate.feed(' '.repeat(8));
        await splitting;
    }
    assert.equal(monsterAtPosition(game.level, tip.x, tip.y), null);
});
