import assert from 'node:assert/strict';
import test from 'node:test';
import { initializePet } from '../js/dog.js';
import { finishLivingGame } from '../js/end.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { LEASH } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createDungeon } from './support/topology.js';

void test('escaping pets use their given names and native companion order', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: 'none' } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const first = await createMonsterAt('little dog', 11, 10);
    const second = await createMonsterAt('kitten', 9, 10);
    first.mtame = second.mtame = 10;
    setMonsterGivenName(first, 'Alpha');
    setMonsterGivenName(second, 'Beta');
    const screens: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
            assert.ok(screens.length < 8, 'Escaping with two pets must finish the summary');
            return 32;
        },
    };

    await finishLivingGame('escaped');

    assert.ok(screens.some(screen => screen.includes('You and Alpha and Beta')),
        'The summary must preserve each companion name and native list order');
});

void test('a diagonally adjacent grid bug cannot accompany an escape', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: 'none' } });
    game.iflags.toptenwin = false;
    const bug = await createMonsterAt('grid bug', 11, 11);
    bug.mtame = 10;
    const input = resetInputState();
    input.feed('    ');

    await finishLivingGame('escaped');

    assert.equal(requireGameLevel().monsters.includes(bug), true);
    assert.equal(bug.mx, 11);
    assert.equal(bug.my, 11);
});

void test('ascension pluralizes the final maximum hit point count', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 1 }, flags: { bones: false, disclose: 'none' } });
    game.iflags.toptenwin = false;
    let summary = '';
    const input = resetInputState();
    input.display = {
        async readKey() {
            summary = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(summary, /You were level/, 'Ascension should reach its summary page');
            return 32;
        },
    };

    await finishLivingGame('ascended');

    assert.match(summary, /a maximum of 1 hit point when you ascended\./);
});

for (const outcome of ['escaped', 'ascended'] as const) {
    void test(`${outcome} awards the current HP of an adjacent tame pet after clearing restraints`, async () => {
        const level = freshObjectRoom({
            hero: { uz: { dnum: 0, dlevel: 1 }, urexp: 1000, ualignbase: [0, 0] },
            flags: { bones: false, disclose: 'none' },
        });
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
        game.storage = memoryStorage();
        game.iflags.toptenwin = false;
        game.iflags.nofollowers = true;
        const pet = await createMonsterAt('little dog', 11, 10);
        initializePet(pet);
        pet.pet = false; // Native pet eligibility depends on mtame.
        setMonsterGivenName(pet, 'Companion');
        pet.mhp = 17;
        pet.mhpmax = 30;
        pet.mtrapped = pet.msleeping = pet.mleashed = 1;
        pet.meating = 5;
        pet.mfrozen = 8;
        pet.mcanmove = 0;
        const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
        const distant = await createMonsterAt('kitten', 15, 10);
        initializePet(distant);
        setMonsterGivenName(distant, 'Distant');
        const pursuer = await createMonsterAt('watchman', 9, 10);
        pursuer.pet = true;
        pursuer.msleeping = 0;
        setMonsterGivenName(pursuer, 'Pursuer');
        const dead = await createMonsterAt('kitten', 10, 11);
        initializePet(dead);
        dead.mhp = 0;
        setMonsterGivenName(dead, 'Dead');
        const screens: string[] = [];
        resetInputState().display = {
            async readKey() {
                screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
                assert.ok(screens.length < 8, 'The ending must finish its summary');
                return 32;
            },
        };

        await finishLivingGame(outcome);

        const score = (outcome === 'ascended' ? 2000 : 1000) + 17;
        assert.equal(game.u.urexp, score, 'Only the surviving companion HP is added, after the ascension bonus');
        const summary = screens.find(screen => screen.includes('You and Companion'));
        assert.ok(summary, 'The ending must name the pet despite its previous restraints');
        assert.match(summary, new RegExp(`with ${score} points,`));
        assert.doesNotMatch(summary, /Distant|Pursuer|Dead/);
        assert.equal(level.monsters.includes(pet), false);
        assert.ok(level.monsters.includes(distant));
        assert.ok(level.monsters.includes(pursuer));
        assert.equal(pet.mtrapped, 0);
        assert.equal(pet.meating, 0);
        assert.equal(pet.msleeping, 0);
        assert.equal(pet.mfrozen, 0);
        assert.equal(pet.mcanmove, 1);
        assert.equal(leash.leashmon, pet.m_id);
    });
}
