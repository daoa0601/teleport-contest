import assert from 'node:assert/strict';
import test from 'node:test';
import { DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setMonsterApparentHeroPosition } from '../js/monster_perception.js';
import { initRng, rn2 } from '../js/rng.js';
import { couldsee, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { surface, name, accessible } of [
    { surface: DB_ICE, name: 'ice', accessible: true },
    { surface: DB_MOAT, name: 'water', accessible: false },
    { surface: DB_LAVA, name: 'lava', accessible: false },
    { surface: DB_FLOOR, name: 'bedrock', accessible: false },
]) {
    void test(`an invisible hero's guessed position ${accessible ? 'can' : 'cannot'} lie on ${name} beneath a raised drawbridge`, async () => {
        const level = freshObjectRoom({ hero: { invisibleTurns: 50 } });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 13, 10, NO_MINVENT);
        const bridge = level.requireAt(11, 11);
        bridge.typ = DRAWBRIDGE_UP;
        bridge.drawbridgemask = surface;
        vision_recalc(0);
        assert.equal(couldsee(11, 11), true, 'The exposed surface must be in line of sight');
        let guessesOnBridge = 0;

        for (let seed = 0; seed < 64; seed++) {
            goblin.mux = 0;
            goblin.muy = 0;
            initRng(BigInt(seed));
            setMonsterApparentHeroPosition(goblin, game, rn2);
            if (goblin.mux === 11 && goblin.muy === 11) guessesOnBridge++;
        }

        if (accessible) assert.ok(guessesOnBridge > 0, 'Some guesses must land on the exposed ice');
        else assert.equal(guessesOnBridge, 0, `The exposed ${name} cannot support the guessed position`);
    });
}
