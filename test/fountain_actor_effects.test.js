import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyFountainDemonActor,
    applyFountainNymphActor,
    applyFountainSnakeActors,
} from '../js/fountain_effects.js';

test('water nymph orders birth, prose, wake, and immediate trap entry', async () => {
    const calls = [];
    const monster = { msleeping: 1, trapped: true };
    const result = await applyFountainNymphActor({
        createMonster: async () => {
            calls.push('create');
            return monster;
        },
        announce: async message => calls.push(`announce:${message}`),
        wakeMonster: actor => {
            calls.push('wake');
            actor.msleeping = 0;
        },
        trapAt: actor => {
            calls.push('trap-at');
            return actor.trapped;
        },
        triggerTrap: async () => {
            calls.push('mintrap');
            return 'caught';
        },
    });

    assert.deepEqual(calls, [
        'create', 'announce:You attract a water nymph!',
        'wake', 'trap-at', 'mintrap',
    ]);
    assert.equal(monster.msleeping, 0);
    assert.equal(result.trap, 'caught');
});

test('water nymph gone and failed-birth fallbacks skip wake and traps', async () => {
    for (const entry of [
        {
            gone: true, blind: false,
            expected: 'A large bubble rises to the surface and pops.',
        },
        {
            gone: false, blind: true,
            expected: 'You hear a loud pop.',
        },
    ]) {
        const calls = [];
        const result = await applyFountainNymphActor({
            gone: entry.gone,
            blind: entry.blind,
            createMonster: async () => {
                calls.push('create');
                return null;
            },
            announce: async message => calls.push(`announce:${message}`),
            wakeMonster: () => calls.push('wake'),
            trapAt: () => { calls.push('trap-at'); return true; },
            triggerTrap: async () => calls.push('mintrap'),
        });
        assert.deepEqual(calls, [
            ...(entry.gone ? [] : ['create']),
            `announce:${entry.expected}`,
        ]);
        assert.equal(result.created, false);
        assert.equal(result.fallback, true);
    }
});

test('water nymph resolves hallucinated naming only on sighted success', async () => {
    for (const blind of [false, true]) {
        const calls = [];
        const result = await applyFountainNymphActor({
            blind,
            createMonster: async () => ({}),
            nymphDescription: () => {
                calls.push('display-name');
                return 'a grid bug';
            },
            announce: async message => calls.push(message),
        });
        assert.deepEqual(calls, blind
            ? ['You hear a seductive voice.']
            : ['display-name', 'You attract a grid bug!']);
        assert.equal(result.created, true);
    }
});

test('water demon skips construction or wish RNG when gone', async () => {
    const calls = [];
    const result = await applyFountainDemonActor({
        gone: true,
        createMonster: async () => calls.push('create'),
        announce: async message => calls.push(`announce:${message}`),
        random: () => { calls.push('rnd'); return 100; },
    });

    assert.deepEqual(calls, [
        'announce:The fountain bubbles furiously for a moment, then calms.',
    ]);
    assert.equal(result.wishRoll, null);
});

test('water demon failed birth produces no prose, wish roll, or trap work', async () => {
    const calls = [];
    const result = await applyFountainDemonActor({
        createMonster: async () => { calls.push('create'); return null; },
        announce: async () => calls.push('announce'),
        random: () => { calls.push('rnd'); return 1; },
        trapAt: () => { calls.push('trap-at'); return true; },
    });

    assert.deepEqual(calls, ['create']);
    assert.equal(result.created, false);
    assert.equal(result.fallback, false);
});

test('water demon rolls after prose, then enters a trap on failed wish', async () => {
    const calls = [];
    const monster = { trapped: true };
    const result = await applyFountainDemonActor({
        blind: true,
        difficulty: 3,
        createMonster: async () => { calls.push('create'); return monster; },
        announce: async message => calls.push(`announce:${message}`),
        demonIndefiniteName: () => {
            calls.push('display-name');
            return 'a grid bug';
        },
        demonPronouns: () => {
            calls.push('pronouns');
            return { possessive: 'its', pronoun: 'it' };
        },
        random: range => { calls.push(`rnd:${range}`); return 83; },
        trapAt: () => { calls.push('trap-at'); return true; },
        triggerTrap: async () => { calls.push('mintrap'); return 'web'; },
        grantWish: async () => calls.push('wish'),
    });

    assert.deepEqual(calls, [
        'create', 'announce:You feel the presence of evil.',
        'rnd:100', 'trap-at', 'mintrap',
    ]);
    assert.equal(result.grantedWish, false);
    assert.equal(result.trap, 'web');
});

test('water demon wish removes through grant owner without trap entry', async () => {
    const calls = [];
    const monster = {};
    const result = await applyFountainDemonActor({
        difficulty: 1,
        createMonster: async () => { calls.push('create'); return monster; },
        announce: async message => calls.push(`announce:${message}`),
        demonIndefiniteName: () => {
            calls.push('display-name');
            return 'a grid bug';
        },
        demonPronouns: () => {
            calls.push('pronouns');
            return { possessive: 'its', pronoun: 'it' };
        },
        random: () => { calls.push('rnd'); return 82; },
        grantWish: async actor => {
            assert.equal(actor, monster);
            calls.push('wish');
        },
        trapAt: () => { calls.push('trap-at'); return true; },
    });

    assert.deepEqual(calls, [
        'create', 'display-name', 'announce:You unleash a grid bug!', 'rnd',
        'pronouns',
        'announce:Grateful for its release, it grants you a wish!', 'wish',
    ]);
    assert.equal(result.grantedWish, true);
});

test('water demon sighted losing roll resolves the name but not pronouns', async () => {
    const calls = [];
    const result = await applyFountainDemonActor({
        createMonster: async () => ({}),
        announce: async message => calls.push(`announce:${message}`),
        demonIndefiniteName: () => {
            calls.push('display-name');
            return 'a grid bug';
        },
        demonPronouns: () => {
            calls.push('pronouns');
            return { possessive: 'its', pronoun: 'it' };
        },
        random: () => { calls.push('rnd'); return 1; },
    });

    assert.deepEqual(calls, [
        'display-name', 'announce:You unleash a grid bug!', 'rnd',
    ]);
    assert.equal(result.grantedWish, false);
});

test('water snakes pay their count before G_GONE', async () => {
    const calls = [];
    const result = await applyFountainSnakeActors({
        gone: true,
        random: range => { calls.push(`rn2:${range}`); return 4; },
        announce: async message => calls.push(`announce:${message}`),
        createMonster: async () => calls.push('create'),
    });

    assert.deepEqual(calls, [
        'rn2:5',
        'announce:The fountain bubbles furiously for a moment, then calms.',
    ]);
    assert.equal(result.requested, 6);
    assert.deepEqual(result.created, []);
});

test('water snakes trigger each trap before requesting the next birth', async () => {
    const calls = [];
    const monsters = [
        { id: 0, trapped: true }, null, { id: 2, trapped: false },
    ];
    const result = await applyFountainSnakeActors({
        blind: true,
        hallucinating: true,
        random: () => { calls.push('count'); return 1; },
        hallucinatedPlural: () => { calls.push('hallu-name'); return 'bogons'; },
        announce: async message => calls.push(`announce:${message}`),
        createMonster: async index => {
            calls.push(`create:${index}`);
            return monsters[index];
        },
        trapAt: actor => {
            calls.push(`trap-at:${actor.id}`);
            return actor.trapped;
        },
        triggerTrap: async actor => {
            calls.push(`mintrap:${actor.id}`);
            return `trap-${actor.id}`;
        },
    });

    assert.deepEqual(calls, [
        'count', 'announce:You hear something hissing!',
        'create:0', 'trap-at:0', 'mintrap:0',
        'create:1', 'create:2', 'trap-at:2',
    ]);
    assert.equal(calls.includes('hallu-name'), false);
    assert.equal(result.created.length, 2);
    assert.deepEqual(result.traps.map(entry => entry.trap), ['trap-0']);
});

test('sighted hallucinated snakes resolve display identity lazily', async () => {
    const calls = [];
    const result = await applyFountainSnakeActors({
        hallucinating: true,
        random: () => 0,
        hallucinatedPlural: () => { calls.push('hallu-name'); return 'grid bugs'; },
        announce: async message => calls.push(message),
    });

    assert.deepEqual(calls, [
        'hallu-name', 'An endless stream of grid bugs pours forth!',
    ]);
    assert.equal(result.requested, 2);
});
