import assert from 'node:assert/strict';
import test from 'node:test';

import { BEAR_TRAP, HOLE, LANDMINE, MAGIC_PORTAL, PIT, ROCKTRAP, ROLLING_BOULDER_TRAP, VIBRATING_SQUARE, WEB } from '../js/const.js';
import { flush_screen, newsym, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
import { createDungeon } from './support/topology.js';

for (const blind of [false, true]) {
    for (const [type, name] of [
        [PIT, 'pit'], [WEB, 'web'], [LANDMINE, 'land mine'],
        [ROCKTRAP, 'falling rock'], [ROLLING_BOULDER_TRAP, 'rolling boulder'],
        [HOLE, 'hole'], [MAGIC_PORTAL, 'magic portal'], [BEAR_TRAP, 'bear trap'],
    ] as const) {
        void test(`feeling a ${name} maps it before its message${blind ? ' while blind' : ' while invisible'}`, async () => {
            const level = freshObjectRoom({ hero: { invisible: true, uhp: 1000, uhpmax: 1000 } });
            game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
            if (blind) {
                setHeroBlindnessTurns(20);
                vision_recalc(0);
            }
            newsym(10, 10);
            await flush_screen(1);
            const trap = addTrap(level, type, 10, 10, {
                tseen: false, dst: { dnum: 0, dlevel: 9 },
            });
            await plineWithContinuation('You hear something moving nearby in the darkness.');
            const input = resetInputState();

            const action = triggerHeroTrap(trap, { forceTrap: true, gotoLevel: async () => true });
            await input.waitUntilBlocked();
            const shownAtMessage = requireScreenCell(9, 11).ch;
            const rememberedAtMessage = level.requireAt(10, 10).remembered_glyph?.kind;
            input.feed(' '.repeat(80));
            await action;

            assert.equal(rememberedAtMessage, 'trap', 'touch must remember the trap beneath the hero');
            assert.equal(shownAtMessage, blind ? '@' : type === WEB ? '"' : '^',
                'the hero keeps normal display priority');
        });
    }
}

for (const seen of [false, true]) {
    void test(`a blind levitating hero feels a ${seen ? 'known' : 'new'} vibrating square`, async () => {
        const level = freshObjectRoom({ hero: { levitating: true } });
        setHeroBlindnessTurns(20);
        vision_recalc(0);
        newsym(10, 10);
        await flush_screen(1);
        const trap = addTrap(level, VIBRATING_SQUARE, 10, 10, { tseen: seen });

        await triggerHeroTrap(trap);
        await plineWithContinuation('You hover here.');
        await flush_screen(1);

        assert.equal(level.requireAt(10, 10).remembered_glyph?.kind, 'trap');
        assert.equal(requireScreenCell(9, 11).ch, '@');
    });
}
