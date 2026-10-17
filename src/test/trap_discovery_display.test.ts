import assert from 'node:assert/strict';
import test from 'node:test';

import { ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, RUST_TRAP, SLP_GAS_TRAP, SQKY_BOARD, VIBRATING_SQUARE, WEB } from '../js/const.js';
import { flush_screen, newsym, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { triggerImmediateMonsterTrap, resumeDeferredMonsterTrap } from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const [type, name, species, glyph, beforeMessage] of [
    [VIBRATING_SQUARE, 'vibrating square', 'giant', 'H', true],
    [ANTI_MAGIC, 'anti-magic trap', 'gnomish wizard', 'G', true],
    [SLP_GAS_TRAP, 'sleeping gas trap', 'giant', 'H', false],
    [SQKY_BOARD, 'squeaky board', 'giant', 'H', false],
    [BEAR_TRAP, 'bear trap', 'giant', 'H', false],
    [WEB, 'web', 'human', '@', false],
    [FIRE_TRAP, 'fire trap', 'giant', 'H', false],
] as const) {
    void test(`a newly discovered ${name} draws its occupant at the native message boundary`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(type, {
            monster: { species, hitPoints: 100 }, trap: { tseen: false },
        });
        requirePlayingGame(game);
        placeMonsterAt(monster, 12, 10);
        newsym(11, 10);
        newsym(12, 10);
        await flush_screen(1);
        placeMonsterAt(monster, 11, 10);
        newsym(12, 10);
        const shown: string[] = [];
        const publish = async () => {
            await flush_screen(1);
            shown.push(requireScreenCell(10, 11).ch);
        };

        const action = await triggerImmediateMonsterTrap(monster, game, {
            random: () => 1, rollOne: () => 1, rollDice: () => 2,
        });
        await resumeDeferredMonsterTrap(action, game, { publish, rollDice: () => 2 });
        await publish();

        assert.equal(shown[0], beforeMessage ? glyph : '.', 'map when the effect is announced');
        assert.equal(shown.at(-1), glyph, 'map when the next message is published');
        assert.equal(trap.tseen, true);
    });
}


for (const [type, name] of [
    [ARROW_TRAP, 'arrow'], [DART_TRAP, 'dart'], [SQKY_BOARD, 'squeaky board'],
    [SLP_GAS_TRAP, 'sleeping gas'], [RUST_TRAP, 'rust'],
    [ANTI_MAGIC, 'anti-magic'], [FIRE_TRAP, 'fire'],
] as const) {
    void test(`discovering a ${name} trap draws the hero before its announcement`, async () => {
        const level = freshObjectRoom();
        const trap = addTrap(level, type, 11, 10, { tseen: false });
        newsym(11, 10);
        await flush_screen(1);
        game.u.ux = 11;
        await plineWithContinuation('You hear something moving nearby in the darkness.');
        const input = resetInputState();

        const action = triggerHeroTrap(trap, { forceTrap: true });
        await input.waitUntilBlocked();
        const shownAtMessage = requireScreenCell(10, 11).ch;
        input.feed(' '.repeat(30));
        await action;

        assert.equal(shownAtMessage, '@');
    });
}
