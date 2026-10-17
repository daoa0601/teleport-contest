import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { P_EXPERT } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import {
    POT_INVISIBILITY, SPE_INVISIBILITY, WAN_MAKE_INVISIBLE,
} from '../js/object_data.js';
import { castSpell } from '../js/spell.js';
import { learnSpell } from './support/spells.js';
import { dozap } from '../js/zap.js';
import {
    addInventoryObject, chargedWand,
} from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshCasterRoom } from './support/hero-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';

void test('drinking an invisibility potion makes the hero invisible', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const potion = await addInventoryObject(POT_INVISIBILITY, {
        initialize: false,
        invlet: 'a',
    });
    pushKeys('a');

    await rhack('q'.charCodeAt(0));

    assert.equal(game.u.invisible, true);
    assert.ok((game.u.invisibleTurns ?? 0) > 100);
    assert.equal(game.inventory.includes(potion), false);
});

// C potion.c peffect_invisibility(): the hero's square is redrawn before
// the cursed potion's second message makes the first one wait.
void test('a cursed invisibility potion hides the hero before its warning pages', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await addInventoryObject(POT_INVISIBILITY, { initialize: false, invlet: 'a', cursed: true });
    const heroCells: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey(): Promise<number> {
            const display = requireGameDisplay();
            const topline = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
            if (topline.includes("can't see yourself"))
                heroCells.push(display.grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch ?? '');
            return ' '.charCodeAt(0);
        },
    };
    await flush_screen(1);
    assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@');
    pushKeys('a');

    await rhack('q'.charCodeAt(0));

    assert.equal(heroCells.length, 1);
    assert.notEqual(heroCells[0], '@');
});

void test('the invisibility spell affects the hero without asking for a direction',
    async () => {
        freshCasterRoom();
        requireFixtureGame(game);

        await learnSpell(SPE_INVISIBILITY, { skill: P_EXPERT });

        await castSpell(SPE_INVISIBILITY);

        assert.equal(game.u.invisible, true);
        assert.ok((game.u.invisibleTurns ?? 0) > 100);
        assert.equal(game.u.uen, 20);
        assert.equal(game.context.move, 1);
    });

void test('a make-invisible wand turns a visible monster transparent', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.seeInvisible = true;
    const monster = await createMonsterAt('jackal', 12, 10);
    const wand = await chargedWand(WAN_MAKE_INVISIBLE, { charges: 2 });
    game.inventory = [wand];
    pushKeys('al');

    await dozap();

    assert.equal(monster.minvis, 1);
    assert.equal(wand.typeKnown, true);
    assert.equal(wand.spe, 1);
});
