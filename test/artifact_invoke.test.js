import test from 'node:test';
import assert from 'node:assert/strict';

import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
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
