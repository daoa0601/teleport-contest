import assert from 'node:assert/strict';
import test from 'node:test';

import { ALLOW_M, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { startCorpseTimeout } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { mfndpos } from '../js/monmove.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const species of ['goblin', 'large kobold', 'gnome lord', 'dwarf lord', 'Woodland-elf', 'fire giant', 'Kop Lieutenant']) {
    void test(`a zombie can approach ${species} to zombify it`, async () => {
        freshObjectRoom({ heroX: 15, heroY: 12 });
        requirePlayingGame(game);
        const zombie = await createMonsterAt('kobold zombie', 10, 10, MM_ANGRY | NO_MINVENT);
        const living = await createMonsterAt(species, 11, 10, MM_ANGRY | NO_MINVENT);

        assert.ok(mfndpos(zombie, game).some(square =>
            square.x === living.mx && square.y === living.my && square.info & ALLOW_M));
        assert.ok(mfndpos(living, game).some(square =>
            square.x === zombie.mx && square.y === zombie.my && square.info & ALLOW_M),
        'a potential zombie victim can fight back');
    });
}

void test('a goblin corpse requested for zombification is scheduled to rise', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('goblin'));

    startCorpseTimeout(corpse, { zombify: true });

    const [timer] = objectTimers(corpse);
    assert.ok(timer, 'the corpse must have a revival timer');
    assert.equal(timer.kind, OBJECT_TIMER_KIND.ZOMBIFY_MON);
    assert.ok(timer.deadline >= game.moves + 5 && timer.deadline <= game.moves + 19);
});
