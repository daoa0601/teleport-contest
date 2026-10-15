import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
void test('a silver weapon sears a vampire hero after its hit message', async () => {
    freshRoomWithPolymorphedHero('vampire', { polymorph: { hitPoints: 100 }, hero: { uac: 10 } });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    goblin.mux = game.u.ux;
    goblin.muy = game.u.uy;
    await equipMonsterObject(goblin, await knownObject(OBJECT_NAMES.indexOf('silver dagger')), W_WEP);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /goblin|silver/, limit: 8 });
    await performMonsterHeroAttack(goblin, game, {
        random: range => range - 1, rollOne: () => 1, rollDice: count => count,
    });
    assert.ok(game.u.mh < 100);
    assert.match([...messages, game._pending_message].join('\n'), /goblin hits!.*The silver sears your flesh!/s);
});
//# sourceMappingURL=monster_hero_silver.test.js.map