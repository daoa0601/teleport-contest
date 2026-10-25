import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { TRIPE_RATION } from '../js/object_data.js';
import { beginPetEating, finishPetEating } from '../js/pet_eating.js';
import { restoreGame, saveGame } from '../js/save.js';
import { heroTeleportRestricted } from '../js/teleport_rules.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
for (const saveWhileAway of [false, true]) {
    void test(`stasis keeps its remaining turns while the level is cached${saveWhileAway ? ' across a save' : ''}`, async () => {
        const { source } = freshConnectedLevels();
        requirePlayingGame(game);
        game.flags.verbose = false;
        source.flags.stasis_until = game.moves + 5;
        await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
        game.moves += 20;
        if (saveWhileAway) {
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            assert.equal(restoreGame(game.plname, storage), true);
        }
        await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
        assert.equal(heroTeleportRestricted(), true, 'Cached stasis must still block teleportation');
        game.moves += 5;
        assert.equal(heroTeleportRestricted(), true, 'The final stasis turn remains blocked');
        game.moves++;
        assert.equal(heroTeleportRestricted(), false, 'Stasis ends after its remaining turns');
    });
}
void test('a cached pet keeps its feeding deadline and delivery reward interval while away', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const pet = await createMonsterAt('little dog', 15, 10, MM_NOGRP | NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    pet.edog.hungrytime = game.moves;
    pet.edog.droptime = game.moves - 10;
    pet.edog.dropdist = 10;
    pet.edog.apport = 5;
    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    assert.ok(source.monsters.includes(pet), 'The distant pet stays behind');
    game.moves += 800;
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
    assert.ok((pet.mtame ?? 0) > 0, 'Separation reduces tameness without starving a previously fed pet');
    const food = await floorObject(TRIPE_RATION, 15, 10, { invlet: 'a' });
    installPagerInput(resetInputState(), { expected: /dog eats/, limit: 2 });
    await finishPetEating(pet, beginPetEating(pet, food, { x: 15, y: 10 }));
    assert.equal(pet.edog.apport, 15, 'Off-level time does not dilute the delivery reward');
});
//# sourceMappingURL=cached_level_clock.test.js.map