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
                expectedCreations: 0,
            },
            {
                gone: false,
                blind: true,
                expected: 'You hear a loud pop.',
                expectedCreations: 1,
            },
        ]) {
            let creations = 0;
            let traps = 0;
            const messages = [];
            const result = await applyFountainNymphActor({
                gone: specimen.gone,
                blind: specimen.blind,
                createMonster: async () => { creations++; return null; },
                announce: async message => messages.push(message),
                trapAt: () => { traps++; return true; },
            });

            assert.equal(result.created, false);
            assert.equal(result.fallback, true);
            assert.equal(result.message, specimen.expected);
            assert.equal(creations, specimen.expectedCreations);
            assert.equal(traps, 0);
            assert.deepEqual(messages, [specimen.expected]);
        }
    });

test('water nymph resolves a display identity only when sighted', async () => {
    for (const blind of [false, true]) {
        let nameResolutions = 0;
        const result = await applyFountainNymphActor({
            blind,
            createMonster: async () => ({}),
            nymphDescription: () => {
                nameResolutions++;
                return 'a grid bug';
            },
        });

        assert.equal(result.message, blind
            ? 'You hear a seductive voice.'
            : 'You attract a grid bug!');
        assert.equal(nameResolutions, blind ? 0 : 1);
    }
});

test('water demon eligibility excludes gone and failed births', async () => {
    let goneCreations = 0;
    let goneRolls = 0;
    const gone = await applyFountainDemonActor({
        gone: true,
        createMonster: async () => { goneCreations++; return {}; },
        random: () => { goneRolls++; return 99; },
    });
    assert.equal(gone.created, false);
    assert.equal(gone.fallback, true);
    assert.equal(gone.wishRoll, null);
    assert.equal(gone.message,
        'The fountain bubbles furiously for a moment, then calms.');
    assert.equal(goneCreations, 0);
    assert.equal(goneRolls, 0);

    let failedRolls = 0;
    const failed = await applyFountainDemonActor({
        createMonster: async () => null,
        random: () => { failedRolls++; return 99; },
    });
    assert.equal(failed.created, false);
    assert.equal(failed.fallback, false);
    assert.equal(failed.message, '');
    assert.equal(failedRolls, 0);
});

test('a losing water demon roll leaves the actor and resolves its trap',
    async () => {
        const monster = { trapped: true };
        let wishGrants = 0;
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
            grantWish: async () => { wishGrants++; },
        });

        assert.equal(result.created, true);
        assert.equal(result.message, 'You feel the presence of evil.');
        assert.equal(result.wishRoll, 83);
        assert.equal(result.grantedWish, false);
        assert.equal(result.trap, 'web');
        assert.equal(wishGrants, 0);
    });

test('a winning water demon roll grants a wish instead of entering a trap',
    async () => {
        const monster = {};
        let grantedMonster = null;
        let trapChecks = 0;
        const result = await applyFountainDemonActor({
            difficulty: 1,
            createMonster: async () => monster,
            random: () => 82,
            demonIndefiniteName: () => 'a grid bug',
            demonPronouns: () => ({ possessive: 'its', pronoun: 'it' }),
            grantWish: async actor => { grantedMonster = actor; },
            trapAt: () => { trapChecks++; return true; },
        });

        assert.equal(result.created, true);
        assert.equal(result.message, 'You unleash a grid bug!');
        assert.equal(result.wishRoll, 82);
        assert.equal(result.grantedWish, true);
        assert.equal(result.wishMessage,
            'Grateful for its release, it grants you a wish!');
        assert.equal(result.trap, null);
        assert.equal(grantedMonster, monster);
        assert.equal(trapChecks, 0);
    });

test('water snakes pay their count even when the species is gone', async () => {
    let creations = 0;
    const result = await applyFountainSnakeActors({
        gone: true,
        random: range => {
            assert.equal(range, 5);
            return 4;
        },
        createMonster: async () => { creations++; return {}; },
    });

    assert.equal(result.requested, 6);
    assert.deepEqual(result.created, []);
    assert.equal(result.message,
        'The fountain bubbles furiously for a moment, then calms.');
    assert.equal(creations, 0);
});

test('blind water snakes construct survivors and report completed traps',
    async () => {
        const first = { id: 0, trapped: true };
        const third = { id: 2, trapped: false };
        const monsters = [first, null, third];
        let hallucinatedNames = 0;
        const result = await applyFountainSnakeActors({
            blind: true,
            hallucinating: true,
            random: () => 1,
            hallucinatedPlural: () => { hallucinatedNames++; return 'bogons'; },
            createMonster: async index => monsters[index],
            trapAt: actor => actor.trapped,
            triggerTrap: async actor => `trap-${actor.id}`,
        });

        assert.equal(result.requested, 3);
        assert.deepEqual(result.created, [first, third]);
        assert.deepEqual(result.traps, [{ monster: first, trap: 'trap-0' }]);
        assert.equal(result.message, 'You hear something hissing!');
        assert.equal(hallucinatedNames, 0);
    });

test('sighted hallucinated snakes use their resolved plural identity',
    async () => {
        let nameResolutions = 0;
        const result = await applyFountainSnakeActors({
            hallucinating: true,
            random: () => 0,
            hallucinatedPlural: () => {
                nameResolutions++;
                return 'grid bugs';
            },
        });

        assert.equal(result.requested, 2);
        assert.equal(result.message,
            'An endless stream of grid bugs pours forth!');
        assert.equal(nameResolutions, 1);
    });
