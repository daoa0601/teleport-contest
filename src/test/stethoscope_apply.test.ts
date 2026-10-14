import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, DOOR, M_AP_OBJECT, PIT, SCORR, SDOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, POT_HEALING, STATUE, STETHOSCOPE } from '../js/object_data.js';
import { learnObjectType } from '../js/object_knowledge.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';

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
