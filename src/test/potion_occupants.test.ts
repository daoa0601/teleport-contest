import type { GameObject } from '../js/object_types.js';
import type { InventoryObjectOverrides } from './support/game-objects.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { G_EXTINCT, G_GENOD } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { POT_HEALING } from '../js/object_data.js';
import { grantMonsterWish, releasePotionOccupant } from '../js/potion_occupants.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const ghost = MONSTER_NAME.indexOf('ghost');
const djinni = MONSTER_NAME.indexOf('djinni');

async function bottle(appearance: string, properties: InventoryObjectOverrides = {}, seed = 17n) {
    const source = await addInventoryObject(POT_HEALING, properties);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[POT_HEALING] = appearance;
    initRng(seed);
    return source;
}

async function open(source: GameObject) {
    resetInputState().feed('                    nothing\n');
    return releasePotionOccupant(source);
}

void test('an ordinary bottle appearance never releases an occupant', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('ruby');
    assert.equal((await open(source)).released, false);
    assert.equal(game.level.monsters.length, 0);
    assert.ok(game.inventory.includes(source));
});

void test('an unopened occupant roll leaves the potion available to its effect owner', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('milky', {}, 1n);
    assert.equal((await open(source)).released, false);
    assert.ok(game.inventory.includes(source));
    assert.equal(game.level.monsters.length, 0);
});

for (const [appearance, species] of [['milky', ghost], ['smoky', djinni]] satisfies [string, number][]) {
    for (const [name, flag] of [['extinct', G_EXTINCT], ['genocided', G_GENOD]] satisfies [string, number][]) {
        void test(`${name} ${appearance} occupants cannot emerge`, async () => {
            freshObjectRoom();
            requirePlayingGame(game);
            const source = await bottle(appearance);
            assert.ok(game.mvitals);
            game.mvitals[species] = { born: 0, died: 0, mvflags: flag };
            assert.equal((await open(source)).released, false);
            assert.equal(game.level.monsters.length, 0);
        });
    }
}

void test('a sighted ghost release creates a real nearby ghost and frightens the hero', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const source = await bottle('milky');
    assert.equal((await open(source)).released, true);
    const monster = game.level.monsters.find(actor => actor.mnum === ghost);
    assert.ok(monster);
    assert.ok(Math.max(Math.abs(monster.mx - game.u.ux), Math.abs(monster.my - game.u.uy)) === 1);
    assert.equal(game._helplessTurns, 3);
    assert.equal(game._helplessReason, 'being frightened to death');
    assert.match(game._pending_message, /frightened to death/);
    assert.ok(game.inventory.includes(source));
});

void test('a blind ghost release has vague feedback and does not frighten the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    setHeroBlindnessTurns(20);
    const source = await bottle('milky');
    assert.equal((await open(source)).released, true);
    assert.ok(game.level.monsters.some(actor => actor.mnum === ghost));
    assert.ok(!game._helplessTurns);
    assert.match(game._pending_message, /something emerges/);
});

void test('hallucinated ghost feedback does not change the actual released species', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    const source = await bottle('milky');
    await open(source);
    assert.ok(game.level.monsters.some(actor => actor.mnum === ghost));
    assert.equal(game._helplessTurns, 3);
    assert.match(game._pending_message, /As you open the bottle, an enormous .* emerges!/);
});

void test('ghost fright does not shorten an existing longer involuntary delay', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('milky');
    game._helplessTurns = 6;
    await open(source);
    assert.equal(game._helplessTurns, 6);
});

void test('a thankful djinni becomes a real initialized pet', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('smoky', {}, 75n);
    assert.equal((await open(source)).released, true);
    const monster = game.level.monsters.find(actor => actor.mnum === djinni);
    assert.ok(monster);
    assert.ok((monster.mtame ?? 0) > 0);
    assert.equal(monster.mpeaceful, 1);
    assert.ok(monster.edog);
    assert.match(game._pending_message, /Thank you for freeing me/);
});

void test('a peaceful djinni remains untamed and has peaceful alignment value', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('smoky');
    await open(source);
    const monster = game.level.monsters.find(actor => actor.mnum === djinni);
    assert.ok(monster);
    assert.equal(monster.mpeaceful, 1);
    assert.ok(!monster.mtame);
    assert.ok(monster.malign !== undefined && monster.malign < 0);
});

void test('a disturbed djinni is hostile', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('smoky', {}, 48n);
    await open(source);
    const monster = game.level.monsters.find(actor => actor.mnum === djinni);
    assert.ok(monster);
    assert.equal(monster.mpeaceful, 0);
    assert.ok(monster.malign !== undefined && monster.malign > 0);
    assert.match(game._pending_message, /disturbed me, fool/);
});

void test('a departing djinni vanishes without dying or leaving a corpse', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('smoky', {}, 27n);
    await open(source);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.mvitals?.[djinni]?.died ?? 0, 0);
    assert.match(game._pending_message, /vanishes/);
});

void test('blessing can turn a peaceful outcome into a wish', async () => {
    freshObjectRoom({ context: { move: 1 } });
    requirePlayingGame(game);
    const source = await bottle('smoky', { blessed: true });
    const result = await open(source);
    assert.equal(result.released, true);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.u.uconduct?.wishes ?? 0, 0); // Explicitly declining remains wishless.
    assert.equal(game.context.move, 1);
});

void test('cursing can turn a peaceful outcome into hostility', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('smoky', { cursed: true });
    await open(source);
    assert.equal(game.level.monsters.find(actor => actor.mnum === djinni)?.mpeaceful, 0);
});

void test('a blessed bottle can still release a hostile djinni', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('smoky', { blessed: true }, 48n);
    await open(source);
    assert.equal(game.level.monsters.find(actor => actor.mnum === djinni)?.mpeaceful, 0);
});

void test('a cursed bottle can still release a djinni that simply leaves', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await bottle('smoky', { cursed: true }, 47n);
    await open(source);
    assert.equal(game.level.monsters.length, 0);
    assert.match(game._pending_message, /vanishes/);
});

void test('a blind and deaf hero still receives the djinni speech', async () => {
    freshObjectRoom({ hero: { deafTurns: 30 } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(20);
    const source = await bottle('smoky', { cursed: true });
    await open(source);
    assert.ok(game.level.monsters.some(actor => actor.mnum === djinni));
    assert.match(game._pending_message, /disturbed me, fool/);
});

void test('the wish giver leaves the world before the real wish prompt while its image remains', async () => {
    freshObjectRoom({ context: { move: 1 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('djinni', 11, 10);
    newsym(monster.mx, monster.my);
    const input = resetInputState();
    const wish = grantMonsterWish(monster);
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /For what do you wish/);
        assert.ok(!game.level.monsters.includes(monster));
        assert.equal(glyphAt(11, 10)?.kind, 'monster');
    } finally {
        input.feed('potion of healing\n');
        await wish;
    }
    assert.ok(game.inventory.some(object => object.otyp === POT_HEALING));
    assert.equal(game.u.uconduct?.wishes, 1);
    assert.equal(game.context.move, 1);
    assert.notEqual(glyphAt(11, 10)?.kind, 'monster');
    assert.equal(game.mvitals?.[djinni]?.died ?? 0, 0);
});
