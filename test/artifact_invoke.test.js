import { floorObjectsAt } from './support/level-state.js';
import { requireScreenRow } from './support/screen.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { artifactByName } from '../js/artifacts.js';
import { A_WIS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { heroHasConflict } from '../js/hero_conflict.js';
import { heroIsInvisible, syncHeroInvisibility } from '../js/hero_invisibility.js';
import { ARROW } from '../js/object_data.js';
import { artifactObject } from './support/game-objects.js';
import { dropInventoryObject, invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the Staff heals injuries and cures illness, slime, and blindness', async () => {
    freshObjectRoom({
        role: 'healer',
        hero: {
            uhp: 4,
            uhpmax: 12,
            sick: true,
            sickTurns: 8,
            sickType: 3,
            slimed: true,
            slimedTurns: 5,
            blindTurns: 7,
            ucreamed: 2,
        },
        moves: 50,
    });
    requirePlayingGame(game);
    const staff = await artifactObject('The Staff of Aesculapius', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [staff];
    await invokeInventoryObject(staff);
    assert.equal(game.u.uhp, 8);
    assert.equal(game.u.sick, false);
    assert.equal(game.u.slimed, false);
    assert.equal(game.u.blindTurns, 2);
    assert.ok(staff.age > game.moves);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You feel better.');
});
void test('the Mitre restores a small energy deficit completely', async () => {
    freshObjectRoom({
        hero: { uen: 4, uenmax: 20 },
        moves: 70,
    });
    requirePlayingGame(game);
    const mitre = await artifactObject('The Mitre of Holiness');
    game.inventory = [mitre];
    await invokeArtifactPower(mitre, artifactByName('The Mitre of Holiness'), {
        state: game,
        publish: async () => { },
        scaledRandom: () => 100,
    });
    assert.equal(game.u.uen, 20);
    assert.equal(mitre.age, 170);
});
void test('the Longbow creates arrows through the normal inventory path', async () => {
    freshObjectRoom({
        role: 'ranger',
        hero: { ualign: { type: -1, record: 10 } },
        moves: 90,
    });
    requirePlayingGame(game);
    const bow = await artifactObject('The Longbow of Diana', {
        invlet: 'a',
        where: 'inventory',
        blessed: true,
        bknown: true,
    });
    game.inventory = [bow];
    await invokeInventoryObject(bow);
    const arrows = game.inventory.find((object) => object.otyp === ARROW);
    assert.ok(arrows);
    assert.ok(arrows.quan >= 7 && arrows.quan <= 21);
    assert.equal(arrows.blessed, true);
    assert.equal(arrows.bknown, true);
    assert.equal(arrows.where, 'inventory');
    assert.ok(bow.age > game.moves);
    assert.equal(game.context.move, 1);
});
void test('the Eyes show magical enlightenment when invoked', async () => {
    freshObjectRoom({ role: 'monk', moves: 110 });
    requirePlayingGame(game);
    game.plname = 'Seer';
    game.u._exercise = [0, 0, 0, 0, 0, 0];
    const eyes = await artifactObject('The Eyes of the Overworld', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [eyes];
    const input = resetInputState();
    const invoking = invokeInventoryObject(eyes);
    await input.waitUntilBlocked();
    const page = requireScreenRow(0)
        .map((cell) => cell.ch)
        .join('');
    const message = game._pending_message;
    input.feed(' ');
    await invoking;
    assert.match(page, /Seer the Monk's attributes/);
    assert.doesNotMatch(message, /self-knowledgeable/);
    assert.ok(eyes.age > game.moves);
    assert.equal(game.context.move, 1);
    assert.doesNotMatch(game._pending_message, /feeling subsides/);
    assert.equal(game.u._exercise[A_WIS], 0);
});
void test('the Sceptre turns conflict on', async () => {
    freshObjectRoom({ role: 'caveman', hero: { ualign: { type: 1, record: 10 } }, moves: 130 });
    requirePlayingGame(game);
    const sceptre = await artifactObject('The Sceptre of Might', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [sceptre];
    await invokeInventoryObject(sceptre);
    assert.equal(heroHasConflict(game), true);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You feel like a rabble-rouser.');
});
void test('the Orb turns the hero invisible', async () => {
    freshObjectRoom({ role: 'archeologist', hero: { ualign: { type: 1, record: 10 } }, moves: 150 });
    requirePlayingGame(game);
    const orb = await artifactObject('The Orb of Detection', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [orb];
    await invokeInventoryObject(orb);
    assert.equal(heroIsInvisible(game), true);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'Your body takes on a strange transparency...');
});
void test('turning an invoked property off starts its cooldown', async () => {
    freshObjectRoom({ moves: 170 });
    requirePlayingGame(game);
    const orb = await artifactObject('The Orb of Detection');
    const artifact = artifactByName('The Orb of Detection');
    assert.ok(artifact);
    const messages = [];
    const options = {
        state: game,
        publish: async (message) => {
            messages.push(message);
        },
        rollDice: () => 30,
        scaledRandom: () => 100,
    };
    await invokeArtifactPower(orb, artifact, options);
    await invokeArtifactPower(orb, artifact, options);
    const cooldown = orb.age;
    await invokeArtifactPower(orb, artifact, options);
    assert.equal(heroIsInvisible(game), false);
    assert.equal(cooldown, 270);
    assert.equal(orb.age, 300);
    assert.equal(messages.at(-1), 'You feel that the crystal ball named the Orb of Detection is ignoring you.');
});
void test('another invisibility source stays active when the Orb is invoked', async () => {
    freshObjectRoom({ moves: 190 });
    requirePlayingGame(game);
    grantIntrinsicProperty('invisible', 'outside', game);
    syncHeroInvisibility(game);
    const orb = await artifactObject('The Orb of Detection');
    game.inventory = [orb];
    const messages = [];
    await invokeArtifactPower(orb, artifactByName('The Orb of Detection'), {
        state: game,
        publish: async (message) => {
            messages.push(message);
        },
    });
    assert.equal(heroIsInvisible(game), true);
    assert.deepEqual(messages, ['You feel a surge of power, but nothing seems to happen.']);
});
void test('dropping the invoked Orb ends its invisibility', async () => {
    const level = freshObjectRoom({ role: 'archeologist', moves: 210 });
    requirePlayingGame(game);
    const orb = await artifactObject('The Orb of Detection', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [orb];
    await invokeArtifactPower(orb, artifactByName('The Orb of Detection'), {
        state: game,
        publish: async () => { },
    });
    await dropInventoryObject(orb, ' '.repeat(5));
    assert.equal(heroIsInvisible(game), false);
    assert.equal(game.inventory.includes(orb), false);
    assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy).includes(orb), true);
});
//# sourceMappingURL=artifact_invoke.test.js.map