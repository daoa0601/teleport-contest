import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { POT_WATER, SCR_SCARE_MONSTER } from '../js/object_data.js';
import { heroIsPolymorphed } from '../js/polyself.js';
import { setHeroLycanthropy } from '../js/were.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('holy water permits a werebeast to return to human form beside a monster afraid of its square', async () => {
    const input = freshTurnRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const hero = installPolymorphedHero('wererat', { hitPoints: 100 });
    setHeroLycanthropy(hero.umonnum);
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mpeaceful = 0;
    await floorObject(SCR_SCARE_MONSTER, 10, 10);
    const water = await addInventoryObject(POT_WATER, { blessed: true });
    installPagerInput(input, { expected: /unencumbered|awe|purified|burns|affinity|return|rat|flee/, limit: 12 });
    pushKeys(`q${water.invlet}`);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /unencumbered|awe|purified|burns|affinity|return|flee|^$/);

    assert.equal(heroIsPolymorphed(game), false);
    assert.equal(game.u.ulycn, -1);
});
