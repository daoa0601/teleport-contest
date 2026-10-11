import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import {
    MM_ANGRY, MM_NOGRP, NO_MINVENT, NO_WEAPON_WANTED, WAND_BACKFIRE_CHANCE,
} from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { WAN_STRIKING } from '../js/object_data.js';
import { initRng, rn2 } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a paged wand backfire resumes fatal contact and displays the committed zero HP', async () => {
    freshObjectRoom({
        flags: { verbose: false, disclose: '-i -a -v -c -o', tombstone: false },
        hero: { uhp: 1, uhpmax: 10, uac: 10 },
    });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    goblin.mux = game.u.ux;
    goblin.muy = game.u.uy;
    goblin.mhp = goblin.mhpmax = 100;
    goblin.weaponCheck = NO_WEAPON_WANTED;
    // The real given name makes the backfire announcement require a pager.
    setMonsterGivenName(goblin, 'Grubnak the Goblin Who Cannot Be Trusted With Fragile Wands');
    const wand = await knownObject(WAN_STRIKING, { spe: 2, cursed: true });
    await addObjectToMonsterInventory(goblin, wand, game);
    const input = resetInputState();
    let sawBackfire = false;
    let sawFatalContact = false;
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (/suddenly explodes/i.test(screen) && !sawBackfire) {
            sawBackfire = true;
            assert.equal(game.u.uhp, 1, 'the backfire announcement precedes the goblin contact damage');
        }
        if (/hits!/i.test(screen) && game.u.uhp === 0 && !game.program_state.gameover) {
            sawFatalContact = true;
            assert.match(screen, /HP:0\(10\)/,
                'the fatal contact pager must display the HP already lost to the hit');
        }
    };
    installPagerInput(input, {
        expected: /Grubnak|goblin|wand|explodes|hits|die|Goodbye|points|You were/i,
        limit: 12,
    });
    initRng(1n);

    const result = await performMonsterHeroAttack(goblin, game, {
        random: limit => limit === WAND_BACKFIRE_CHANCE ? 0 : rn2(limit),
        rollDice: count => count,
    });

    assert.equal(sawBackfire, true, 'the backfire must reach actual pager input');
    assert.equal(sawFatalContact, true, 'ordinary contact must resume through its fatal pager');
    assert.equal(wand.where, 'gone');
    assert.equal(goblin.mhp, 96, 'the goblin survives its own wand explosion');
    assert.equal(result.nativeResult, 0);
    assert.equal(result.heroDied, true);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.u.umortality, 1);
});
