import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { NEED_WEAPON, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AKLYS } from '../js/object_data.js';
import { mksobj } from '../js/mklev.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

for (const peaceful of [false, true]) {
    void test(`a disturbed ${peaceful ? 'peaceful' : 'hostile'} gnome announces waking before wielding`, async () => {
        freshObjectRoom({ hero: { aggravateMonster: true, uac: -1000 } });
        requirePlayingGame(game);
        const gnome = await createMonsterAt('gnome', 11, 10, NO_MINVENT);
        await addObjectToMonsterInventory(gnome, await mksobj(AKLYS, true, false), game);
        gnome.msleeping = 1;
        gnome.mpeaceful = peaceful;
        gnome.movement = 12;
        gnome.weaponCheck = NEED_WEAPON;
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /gnome/, limit: 5 });

        await finishAtCommandInput(input, moveloop_core, /gnome|^$/);

        const prose = [...messages, game._pending_message].join('\n');
        assert.ok(prose.includes(`The gnome wakes up${peaceful ? '.' : '!'}`));
        assert.equal(gnome.msleeping, 0);
        if (!peaceful) {
            assert.match(prose, /The gnome wakes up!.*The gnome wields a thonged club!/s);
            assert.equal(gnome.mw?.otyp, AKLYS);
        }
    });
}
