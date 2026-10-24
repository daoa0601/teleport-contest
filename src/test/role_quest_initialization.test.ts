import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT, STRAT_CLOSE, STRAT_WAITFORU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterAlignmentType, setMonsterMalign } from '../js/monster_alignment.js';
import { chooseCovetousStrategy } from '../js/monster_covetous_target.js';
import { tameMonster } from '../js/monster_taming.js';
import { BELL_OF_OPENING } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the Tourist nemesis is hostile and waits for the hero instead of approaching as a leader', async () => {
    freshObjectRoom({ role: 'tourist' });

    const nemesis = await createMonsterAt('Master of Thieves', 12, 10, MM_NOGRP | NO_MINVENT);

    assert.equal(nemesis.mpeaceful, 0);
    assert.equal(nemesis.malign, 20, 'a neutral Tourist earns alignment credit for killing the nemesis');
    assert.ok((nemesis.mstrategy ?? 0) & STRAT_WAITFORU);
    assert.equal((nemesis.mstrategy ?? 0) & STRAT_CLOSE, 0);
});

void test('the Tourist nemesis receives the Bell of Opening at birth', async () => {
    freshObjectRoom({ role: 'tourist' });

    const nemesis = await createMonsterAt('Master of Thieves', 12, 10, MM_NOGRP);

    assert.ok(nemesis.minvent?.some(object => object.otyp === BELL_OF_OPENING));
});

void test('taming cannot pacify the Tourist nemesis', async () => {
    freshObjectRoom({ role: 'tourist' });
    const nemesis = await createMonsterAt('Master of Thieves', 12, 10, MM_ANGRY | NO_MINVENT);

    assert.equal(await tameMonster(nemesis), false);

    assert.equal(nemesis.mpeaceful, 0);
});

void test('the Tourist nemesis pursues the hero carrying the quest artifact', async () => {
    freshObjectRoom({ role: 'tourist', hero: { uhave: { questart: 1 } } });
    requirePlayingGame(game);
    const nemesis = await createMonsterAt('Master of Thieves', 12, 10, NO_MINVENT);

    const strategy = chooseCovetousStrategy(nemesis, game);

    assert.equal(strategy.kind, 'target');
    if (strategy.kind !== 'target') throw new Error('The nemesis must pursue the quest artifact');
    assert.equal(strategy.target.kind, 'hero');
});

void test('a quest guardian retains the starting alignment after the hero converts', async () => {
    freshObjectRoom({ role: 'priest', hero: { ualign: { type: -1, record: 10 } } });
    game.initAlignment = { name: 'lawful', value: 1 };
    const guardian = await createMonsterAt('acolyte', 12, 10, NO_MINVENT);

    setMonsterMalign(guardian);

    assert.equal(monsterAlignmentType(guardian), 1);
    assert.equal(guardian.malign, -15, 'guardians use three times the starting alignment');
});

void test('an explicitly angry quest leader stays hostile and honors the no-wait birth flag', async () => {
    freshObjectRoom({ role: 'knight' });

    const leader = await createMonsterAt('King Arthur', 12, 10, MM_ANGRY | MM_NOWAIT | NO_MINVENT);

    assert.equal(leader.mpeaceful, 0);
    assert.equal((leader.mstrategy ?? 0) & STRAT_CLOSE, 0);
    assert.equal(game.quest_status?.leader_m_id, leader.m_id);
});

void test('the Master of Thieves remains a peaceful leader for a Rogue', async () => {
    freshObjectRoom({ role: 'tourist' });
    await createMonsterAt('Master of Thieves', 12, 10, NO_MINVENT);
    freshObjectRoom({ role: 'rogue' });

    const leader = await createMonsterAt('Master of Thieves', 12, 10, NO_MINVENT);

    assert.equal(leader.mpeaceful, 1);
    assert.equal(leader.malign, -20);
    assert.ok((leader.mstrategy ?? 0) & STRAT_CLOSE);
    assert.equal((leader.mstrategy ?? 0) & STRAT_WAITFORU, 0);
});
