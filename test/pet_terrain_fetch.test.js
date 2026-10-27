import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMove } from '../js/monmove.js';
import { DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a pet seeks a fetchable object after its engulfed master browses terrain', async () => {
    freshObjectRoom({ left: 10, right: 16, top: 10, bottom: 10,
        flags: { debug: true, tips: false, verbose: true } });
    requirePlayingGame(game);
    const pet = await createMonsterAt('kitten', 13, 10, NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    pet.edog.apport = 20;
    pet.edog.whistletime = game.moves;
    await floorObject(DAGGER, 15, 10);
    const worm = await createMonsterAt('purple worm', 10, 10, NO_MINVENT);
    game.u.ustuck = worm;
    game.u.uswallow = 1;
    vision_recalc(2);
    const input = resetInputState();
    await answerPrompts(runExtendedCommand('terrain'), input, [
        { prompt: /View which\?/, keys: 'd' },
        { prompt: /For instructions/, keys: ',' },
    ]);
    assert.equal(game.u.uswallow, 1);
    initRng(1n);
    await beginMonsterMove(pet, game);
    assert.equal(pet.mx, 14, 'the pet approaches the dagger rather than its engulfed master');
    assert.equal(pet.my, 10);
});
//# sourceMappingURL=pet_terrain_fetch.test.js.map