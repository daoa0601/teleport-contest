import test from 'node:test';
import assert from 'node:assert/strict';

import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { artifactByName } from '../js/artifacts.js';
import { game } from '../js/gstate.js';
import { heroHasConflict } from '../js/hero_conflict.js';
import {
    heroIsInvisible, syncHeroInvisibility,
} from '../js/hero_invisibility.js';
import { ARROW } from '../js/object_data.js';
import { artifactObject } from './support/game-objects.js';
import {
    dropInventoryObject, invokeInventoryObject,
} from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

test('the Staff heals injuries and cures illness, slime, and blindness',
    async () => {
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
        const staff = artifactObject('The Staff of Aesculapius', {
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

test('the Mitre restores a small energy deficit completely', async () => {
    freshObjectRoom({
        hero: { uen: 4, uenmax: 20 },
        moves: 70,
    });
    const mitre = artifactObject('The Mitre of Holiness');
    game.inventory = [mitre];

    await invokeArtifactPower(
        mitre, artifactByName('The Mitre of Holiness'), {
            state: game,
            publish: async () => {},
            scaledRandom: () => 100,
        },
    );

    assert.equal(game.u.uen, 20);
    assert.equal(mitre.age, 170);
});

test('the Longbow creates arrows through the normal inventory path',
    async () => {
        freshObjectRoom({
            role: 'ranger',
            hero: { ualign: { type: -1, record: 10 } },
            moves: 90,
        });
        const bow = artifactObject('The Longbow of Diana', {
            invlet: 'a',
            where: 'inventory',
            blessed: true,
            bknown: true,
        });
        game.inventory = [bow];

        await invokeInventoryObject(bow);

        const arrows = game.inventory.find(object => object.otyp === ARROW);
        assert.ok(arrows);
        assert.ok(arrows.quan >= 7 && arrows.quan <= 21);
        assert.equal(arrows.blessed, true);
        assert.equal(arrows.bknown, true);
        assert.equal(arrows.where, 'inventory');
        assert.ok(bow.age > game.moves);
        assert.equal(game.context.move, 1);
    });

test('the Eyes show magical enlightenment when invoked', async () => {
    freshObjectRoom({ role: 'monk', moves: 110 });
    const eyes = artifactObject('The Eyes of the Overworld', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [eyes];

    await invokeInventoryObject(eyes, ' '.repeat(20));

    assert.ok(eyes.age > game.moves);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'The feeling subsides.');
});

test('the Sceptre turns conflict on', async () => {
    freshObjectRoom({ role: 'caveman', moves: 130 });
    const sceptre = artifactObject('The Sceptre of Might', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [sceptre];

    await invokeInventoryObject(sceptre);

    assert.equal(heroHasConflict(game), true);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You feel like a rabble-rouser.');
});

test('the Orb turns the hero invisible', async () => {
    freshObjectRoom({ role: 'archeologist', moves: 150 });
    const orb = artifactObject('The Orb of Detection', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [orb];

    await invokeInventoryObject(orb);

    assert.equal(heroIsInvisible(game), true);
    assert.equal(game.context.move, 1);
    assert.equal(
        game._pending_message,
        'Your body takes on a strange transparency...',
    );
});

test('turning an invoked property off starts its cooldown', async () => {
    freshObjectRoom({ moves: 170 });
    const orb = artifactObject('The Orb of Detection');
    const artifact = artifactByName('The Orb of Detection');
    const messages = [];
    const options = {
        state: game,
        publish: async message => messages.push(message),
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
    assert.equal(
        messages.at(-1),
        'You feel that The Orb of Detection is ignoring you.',
    );
});

test('another invisibility source stays active when the Orb is invoked',
    async () => {
        freshObjectRoom({ moves: 190 });
        game.u.intrinsicInvisible = true;
        syncHeroInvisibility(game);
        const orb = artifactObject('The Orb of Detection');
        game.inventory = [orb];
        const messages = [];

        await invokeArtifactPower(orb, artifactByName('The Orb of Detection'), {
            state: game,
            publish: async message => messages.push(message),
        });

        assert.equal(heroIsInvisible(game), true);
        assert.deepEqual(messages, [
            'You feel a surge of power, but nothing seems to happen.',
        ]);
    });

test('dropping the invoked Orb ends its invisibility', async () => {
    const level = freshObjectRoom({ role: 'archeologist', moves: 210 });
    const orb = artifactObject('The Orb of Detection', {
        invlet: 'a',
        where: 'inventory',
    });
    game.inventory = [orb];
    await invokeArtifactPower(orb, artifactByName('The Orb of Detection'), {
        state: game,
        publish: async () => {},
    });

    await dropInventoryObject(orb, ' '.repeat(5));

    assert.equal(heroIsInvisible(game), false);
    assert.equal(game.inventory.includes(orb), false);
    assert.equal(
        level.objects[game.u.ux][game.u.uy].includes(orb),
        true,
    );
});
