import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyFountainDemonActor,
    applyFountainNymphActor,
    applyFountainSnakeActors,
} from '../js/fountain_effects.js';

test('a created water nymph wakes and resolves its immediate trap', async () => {
    const monster = { msleeping: 1, trapped: true };
    const messages = [];
    const result = await applyFountainNymphActor({
        createMonster: async () => monster,
        announce: async message => messages.push(message),
        trapAt: actor => actor.trapped,
        triggerTrap: async () => 'caught',
    });

    assert.equal(result.created, true);
    assert.equal(result.monster, monster);
    assert.equal(result.trap, 'caught');
    assert.equal(monster.msleeping, 0);
    assert.deepEqual(messages, ['You attract a water nymph!']);
});

test('water nymph fallback reports blindness without downstream work',
    async () => {
        for (const specimen of [
            {
                gone: true,
                blind: false,
                expected: 'A large bubble rises to the surface and pops.',
            },
            {
                gone: false,
                blind: true,
                expected: 'You hear a loud pop.',
            },
        ]) {
            const messages = [];
            const result = await applyFountainNymphActor({
                gone: specimen.gone,
                blind: specimen.blind,
                createMonster: specimen.gone
                    ? async () => {
                        throw new Error('gone species must not construct');
                    }
                    : async () => null,
                announce: async message => messages.push(message),
                trapAt: () => {
                    throw new Error('absent actor must not inspect traps');
                },
            });

            assert.equal(result.created, false);
            assert.equal(result.fallback, true);
            assert.equal(result.message, specimen.expected);
            assert.deepEqual(messages, [specimen.expected]);
        }
    });

test('water nymph resolves a display identity only when sighted', async () => {
    for (const blind of [false, true]) {
        const result = await applyFountainNymphActor({
            blind,
            createMonster: async () => ({}),
            nymphDescription: blind
                ? () => {
                    throw new Error(
                        'blind nymph must not resolve a display name',
                    );
                }
                : () => 'a grid bug',
        });

        assert.equal(result.message, blind
            ? 'You hear a seductive voice.'
            : 'You attract a grid bug!');
    }
});

test('water demon eligibility excludes gone and failed births', async () => {
    const gone = await applyFountainDemonActor({
        gone: true,
        createMonster: async () => {
            throw new Error('gone demon must not construct');
        },
        random: () => {
            throw new Error('gone demon must not roll for a wish');
        },
    });
    assert.equal(gone.created, false);
    assert.equal(gone.fallback, true);
    assert.equal(gone.wishRoll, null);
    assert.equal(gone.message,
        'The fountain bubbles furiously for a moment, then calms.');

    const failed = await applyFountainDemonActor({
        createMonster: async () => null,
        random: () => {
            throw new Error('failed demon birth must not roll for a wish');
        },
    });
    assert.equal(failed.created, false);
    assert.equal(failed.fallback, false);
    assert.equal(failed.message, '');
});

test('a losing water demon roll leaves the actor and resolves its trap',
    async () => {
        const monster = { trapped: true };
        const result = await applyFountainDemonActor({
            blind: true,
            difficulty: 3,
            createMonster: async () => monster,
            random: range => {
                assert.equal(range, 100);
                return 83;
            },
            trapAt: actor => actor.trapped,
            triggerTrap: async () => 'web',
            grantWish: async () => {
                throw new Error('losing demon must not grant a wish');
            },
        });

        assert.equal(result.created, true);
        assert.equal(result.message, 'You feel the presence of evil.');
        assert.equal(result.wishRoll, 83);
        assert.equal(result.grantedWish, false);
        assert.equal(result.trap, 'web');
    });

test('a winning water demon roll grants a wish instead of entering a trap',
    async () => {
        const monster = {};
        const result = await applyFountainDemonActor({
            difficulty: 1,
            createMonster: async () => monster,
            random: () => 82,
            demonIndefiniteName: () => 'a grid bug',
            demonPronouns: () => ({ possessive: 'its', pronoun: 'it' }),
            grantWish: async actor => { actor.wishGranted = true; },
            trapAt: () => {
                throw new Error('wish-granting demon must not enter a trap');
            },
        });

        assert.equal(result.created, true);
        assert.equal(result.message, 'You unleash a grid bug!');
        assert.equal(result.wishRoll, 82);
        assert.equal(result.grantedWish, true);
        assert.equal(result.wishMessage,
            'Grateful for its release, it grants you a wish!');
        assert.equal(result.trap, null);
        assert.equal(monster.wishGranted, true);
    });

test('water snakes pay their count even when the species is gone', async () => {
    const result = await applyFountainSnakeActors({
        gone: true,
        random: range => {
            assert.equal(range, 5);
            return 4;
        },
        createMonster: async () => {
            throw new Error('gone snakes must not construct actors');
        },
    });

    assert.equal(result.requested, 6);
    assert.deepEqual(result.created, []);
    assert.equal(result.message,
        'The fountain bubbles furiously for a moment, then calms.');
});

test('blind water snakes construct survivors and report completed traps',
    async () => {
        const first = { id: 0, trapped: true };
        const third = { id: 2, trapped: false };
        const monsters = [first, null, third];
        const result = await applyFountainSnakeActors({
            blind: true,
            hallucinating: true,
            random: () => 1,
            hallucinatedPlural: () => {
                throw new Error('blind snakes must not resolve display names');
            },
            createMonster: async index => monsters[index],
            trapAt: actor => actor.trapped,
            triggerTrap: async actor => `trap-${actor.id}`,
        });

        assert.equal(result.requested, 3);
        assert.deepEqual(result.created, [first, third]);
        assert.deepEqual(result.traps, [{ monster: first, trap: 'trap-0' }]);
        assert.equal(result.message, 'You hear something hissing!');
    });

test('sighted hallucinated snakes use their resolved plural identity',
    async () => {
        const result = await applyFountainSnakeActors({
            hallucinating: true,
            random: () => 0,
            hallucinatedPlural: () => 'grid bugs',
        });

        assert.equal(result.requested, 2);
        assert.equal(result.message,
            'An endless stream of grid bugs pours forth!');
    });
