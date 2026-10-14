import test from 'node:test';
import assert from 'node:assert/strict';
import { doeat } from '../js/eat.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_NAMES, TIN } from '../js/object_data.js';
import { heroIsPolymorphed } from '../js/polyself.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('metal eaten with a tin still nourishes a hero whose infection ends the metal-eating form', async () => {
    freshObjectRoom({ gameplaySeed: 71n, hero: { uhunger: 200 } });
    requirePlayingGame(game);
    const dagger = await addInventoryObject(OBJECT_NAMES.indexOf('silver dagger'));
    await setPrimaryWeapon(dagger);
    installPolymorphedHero('rock mole', { hitPoints: 1 });
    const tin = await addInventoryObject(TIN, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf('wererat', 260),
        spe: -7, known: true,
    });
    const input = resetInputState();
    installPagerInput(input, {
        expected: /tin|consume|cannibal|bad feeling|handle|dagger|return|human|normal form|molting/i,
        limit: 20,
    });
    input.feed(tin.invlet);
    await doeat();
    assert.equal(heroIsPolymorphed(game), false, 'silver contact after infection ends the fragile rock mole form');
    assert.equal(game.u.ulycn, MONSTER_NAME.indexOf('wererat'));
    assert.equal(tin.where, 'gone');
    assert.equal(game.u.uhunger, 255, 'the smoked contents provide 50 nutrition and the swallowed metal provides 5');
});
//# sourceMappingURL=eat_metal_tin.test.js.map