import test from 'node:test';
import assert from 'node:assert/strict';

import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { ARROW } from '../js/object_data.js';
import { artifactObject } from './support/game-objects.js';
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
        pushKeys('invoke\na');

        await rhack('#'.charCodeAt(0));

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
        pushKeys('invoke\na');

        await rhack('#'.charCodeAt(0));

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
    pushKeys(`invoke\na${' '.repeat(20)}`);

    await rhack('#'.charCodeAt(0));

    assert.ok(eyes.age > game.moves);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'The feeling subsides.');
});
