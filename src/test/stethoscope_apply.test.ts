import test from 'node:test';
import assert from 'node:assert/strict';
import { CORPSTAT_FEMALE, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_RANDOM, CORR, DOOR, M_AP_OBJECT, PIT, SCORR, SDOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, FLINT, GAUNTLETS_OF_FUMBLING, GAUNTLETS_OF_POWER, OBJECT_NAMES, POT_HEALING, RUBY, STATUE, STETHOSCOPE } from '../js/object_data.js';
import { learnObjectType } from '../js/object_knowledge.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';
import { createSpecialLevel } from './support/topology.js';

const hiddenFeatures: [number, number, string][] = [[SDOOR, DOOR, 'door'], [SCORR, CORR, 'passage']];
for (const [hidden, revealed, noun] of hiddenFeatures) {
    void test(`a stethoscope reveals a secret ${noun}`, async () => {
        const level = freshPlayableRoom();
        const square = level.requireAt(game.u.ux + 1, game.u.uy);
        square.typ = hidden;
        const stethoscope = await addInventoryObject(STETHOSCOPE);

        await applyInventoryObject(stethoscope, 'l');

        assert.equal(square.typ, revealed);
        assert.match(game._pending_message, new RegExp(`This must be a secret ${noun}!`));
        assert.equal(game.context.move, 0);
    });
}

for (const [hidden, revealed, noun] of hiddenFeatures) {
    void test(`a stethoscope reveals a secret ${noun} with acoustics disabled`, async () => {
        const level = freshPlayableRoom({ flags: { acoustics: false } });
        const square = level.requireAt(game.u.ux + 1, game.u.uy);
        square.typ = hidden;
        const stethoscope = await addInventoryObject(STETHOSCOPE);

        await runExtendedCommand('apply', `${stethoscope.invlet}l`);

        assert.equal(square.typ, revealed);
        assert.equal(game._pending_message, '');
        assert.equal(game.context.move, 0);
    });
}

for (const acoustics of [false, true]) {
    void test(`an underwater stethoscope ${acoustics ? 'barely hears splashing' : 'suppresses splashing with acoustics disabled'}`, async () => {
        freshPlayableRoom({ flags: { acoustics } });
        game.underwater = true;
        const stethoscope = await addInventoryObject(STETHOSCOPE);

        await runExtendedCommand('apply', `${stethoscope.invlet}>`);

        assert.equal(game._pending_message, acoustics ? 'You barely hear faint splashing.' : '');
        assert.equal(game.context.move, 0);
    });
}

void test('a stethoscope suppresses hellfire sounds with acoustics disabled', async () => {
    freshPlayableRoom({ flags: { acoustics: false } });
    game.stronghold_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    const stethoscope = await addInventoryObject(STETHOSCOPE);

    await runExtendedCommand('apply', `${stethoscope.invlet}>`);

    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 0);
});

void test('a stethoscope suppresses typing sounds at the map edge with acoustics disabled', async () => {
    freshPlayableRoom({ heroX: 1, flags: { acoustics: false } });
    const stethoscope = await addInventoryObject(STETHOSCOPE);

    await runExtendedCommand('apply', `${stethoscope.invlet}h`);

    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 0);
});

for (const acoustics of [false, true]) {
    void test(`a cursed stethoscope ${acoustics ? 'hears the hero\'s heartbeat' : 'suppresses the heartbeat with acoustics disabled'}`, async () => {
        freshPlayableRoom({ flags: { acoustics } });
        const stethoscope = await addInventoryObject(STETHOSCOPE, { cursed: true });
        initRng(4);

        await runExtendedCommand('apply', `${stethoscope.invlet}l`);

        assert.equal(game._pending_message, acoustics ? 'You hear your heart beat.' : '');
        assert.equal(game.context.move, 0);
    });
}

void test('a deaf hero cannot use a stethoscope or spend time trying', async () => {
    freshPlayableRoom({ hero: { deaf: true, deafTurns: 12 } });
    const stethoscope = await addInventoryObject(STETHOSCOPE);

    await applyInventoryObject(stethoscope, 'l');

    assert.equal(game._pending_message, "You can't hear anything!");
    assert.equal(game.context.move, 0);
});

void test('a stethoscope diagnoses a corpse on the floor beneath the hero', async () => {
    freshPlayableRoom();
    await floorObject(CORPSE, game.u.ux, game.u.uy, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const stethoscope = await addInventoryObject(STETHOSCOPE);

    await applyInventoryObject(stethoscope, '>');

    assert.equal(game._pending_message, 'You determine that this unfortunate being is dead.');
    assert.equal(game.context.move, 0);
});

void test('a stethoscope diagnoses an adjacent statue without treating it as a creature', async () => {
    freshPlayableRoom();
    await floorObject(STATUE, game.u.ux + 1, game.u.uy, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const stethoscope = await addInventoryObject(STETHOSCOPE);

    await applyInventoryObject(stethoscope, 'l');

    assert.equal(game._pending_message, 'The newt is in fine health for a statue.');
});

void test('a swallowed hero diagnoses the engulfer instead of the adjacent floor', async () => {
    freshPlayableRoom();
    const holder = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    game.u.ustuck = holder;
    game.u.uswallow = true;
    const stethoscope = await addInventoryObject(STETHOSCOPE);
    const messages: string[] = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };

    await applyInventoryObject(stethoscope, 'h   ');

    assert.match(messages.join('\n'), /Status of the purple worm/);
    assert.equal(game.context.move, 0);
});

void test('a hallucinated corpse diagnosis takes time even on the first use', async () => {
    freshPlayableRoom({ hero: { hallucination: true, hallucinationTurns: 12 } });
    await floorObject(CORPSE, game.u.ux, game.u.uy, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const stethoscope = await addInventoryObject(STETHOSCOPE);

    await applyInventoryObject(stethoscope, '>');

    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /"It's dead, Jim\."/);
});

for (const identified of [false, true]) {
    void test(`a stethoscope ${identified ? 'names an identified potion disguise' : 'keeps an unknown potion disguise generic'}`, async () => {
        freshPlayableRoom();
        game.objectDescriptions ||= [];
        game.objectDescriptions[POT_HEALING] = 'pink';
        if (identified) learnObjectType(POT_HEALING);
        const mimic = await createMonsterAt('small mimic', 11, 10);
        mimic.m_ap_type = M_AP_OBJECT;
        mimic.mappearance = POT_HEALING;
        const stethoscope = await addInventoryObject(STETHOSCOPE);
        const messages: string[] = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };

        await applyInventoryObject(stethoscope, 'l   ');

        assert.match(messages.join('\n'), identified
            ? /That potion of healing is really a small mimic\./
            : /That potion is really a small mimic\./);
        assert.equal(mimic.m_ap_type, 0);
        assert.equal(game.context.move, 0);
    });
}

void test('a stethoscope at a seen pit edge cannot reach the bottom of the pit', async () => {
    const level = freshPlayableRoom();
    addTrap(level, PIT, game.u.ux, game.u.uy, { tseen: true });
    const stethoscope = await addInventoryObject(STETHOSCOPE);

    await applyInventoryObject(stethoscope, '>');

    assert.equal(game._pending_message, "You can't reach the bottom of the pit.");
    assert.equal(game.u.utrap ?? 0, 0);
    assert.equal(game.context.move, 0);
});

void test('a visible monster receives a fresh hallucinated identity in its stethoscope diagnosis', async () => {
    freshPlayableRoom({ hero: { hallucination: true, hallucinationTurns: 12 } });
    await createMonsterAt('newt', game.u.ux + 1, game.u.uy);
    const stethoscope = await addInventoryObject(STETHOSCOPE);
    initRng(1);

    await runExtendedCommand('apply', `${stethoscope.invlet}l`);

    assert.match(game._pending_message, /^Status of the flaming sphere \(/);
    assert.equal(game.context.move, 0);
});

const identifiedGems: [number, string][] = [[RUBY, 'ruby'], [FLINT, 'flint stone']];
for (const [type, name] of identifiedGems) {
    void test(`a stethoscope names an identified ${name} disguise`, async () => {
        freshPlayableRoom();
        learnObjectType(type);
        const mimic = await createMonsterAt('small mimic', game.u.ux + 1, game.u.uy);
        mimic.m_ap_type = M_AP_OBJECT;
        mimic.mappearance = type;
        const stethoscope = await addInventoryObject(STETHOSCOPE);
        const messages: string[] = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };

        await runExtendedCommand('apply', `${stethoscope.invlet}l   `);

        assert.ok(messages.includes(`That ${name} is really a small mimic.`), messages.join('\n'));
        assert.equal(mimic.m_ap_type, 0);
        assert.equal(game.context.move, 0);
    });
}

const clericStatues: [string, number, string][] = [
    ['cleric', CORPSTAT_FEMALE, 'priestess'],
    ['cleric', CORPSTAT_MALE, 'priest'],
    ['cleric', CORPSTAT_NEUTER, 'cleric'],
    ['aligned cleric', CORPSTAT_RANDOM, 'cleric'],
    ['high cleric', CORPSTAT_FEMALE, 'high priestess'],
];
for (const [species, gender, title] of clericStatues) {
    void test(`a stethoscope calls a ${species} statue with gender ${gender} a ${title}`, async () => {
        freshPlayableRoom();
        await floorObject(STATUE, game.u.ux + 1, game.u.uy, {
            corpsenm: MONSTER_NAME.indexOf(species), spe: gender,
        });
        const stethoscope = await addInventoryObject(STETHOSCOPE);

        await runExtendedCommand('apply', `${stethoscope.invlet}l`);

        assert.equal(game._pending_message, `The ${title} is in fine health for a statue.`);
        assert.equal(game.context.move, 0);
    });
}

const pairedDisguises: [number, string][] = [
    [GAUNTLETS_OF_POWER, 'gauntlets of power'],
    [GAUNTLETS_OF_FUMBLING, 'gauntlets of fumbling'],
    [OBJECT_NAMES.indexOf('gauntlets of dexterity'), 'gauntlets of dexterity'],
    [OBJECT_NAMES.indexOf('iron shoes'), 'iron shoes'],
];
for (const [type, name] of pairedDisguises) {
    void test(`a stethoscope uses plural grammar for an identified ${name} disguise`, async () => {
        freshPlayableRoom();
        learnObjectType(type);
        const mimic = await createMonsterAt('small mimic', game.u.ux + 1, game.u.uy);
        mimic.m_ap_type = M_AP_OBJECT;
        mimic.mappearance = type;
        const stethoscope = await addInventoryObject(STETHOSCOPE);
        const messages: string[] = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };

        await runExtendedCommand('apply', `${stethoscope.invlet}l   `);

        assert.ok(messages.includes(`Those pair of ${name} are really a small mimic.`), messages.join('\n'));
        assert.equal(mimic.m_ap_type, 0);
        assert.equal(game.context.move, 0);
    });
}
