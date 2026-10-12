import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, A_DEX, A_STR, DOOR, SDOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, W_ARMF } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { KICKING_BOOTS } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { kickDirection } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const type of [DOOR, SDOOR]) {
    void test(`kicking boots open a ${type === SDOOR ? 'secret' : 'closed'} door even with weak attributes`, async () => {
        for (let seed = 1n; seed <= 12n; seed++) {
            const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
            requireFixtureGame(game);
            for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 3;
            game.uarmf = await addInventoryObject(KICKING_BOOTS, { initialize: false, owornmask: W_ARMF });
            const door = level.requireAt(11, 10);
            door.typ = type;
            door.doormask = D_CLOSED;

            await kickDirection('l');

            assert.equal(door.typ, DOOR, `The boots must uncover the door (seed ${seed}).`);
            assert.equal(door.doormask, type === SDOOR ? D_ISOPEN : D_BROKEN,
                `The boots must open the door (seed ${seed}).`);
            assert.equal(game.u.uhp, 100, `A successful kick must not injure the hero (seed ${seed}).`);
        }
    });
}

for (const [type, mask, outcome, terrain, symbol] of [
    [SDOOR, D_CLOSED, D_ISOPEN, 'open door', '-'],
    [SDOOR, D_LOCKED, D_LOCKED, 'closed door', '+'],
    [SDOOR, D_CLOSED | D_TRAPPED, D_NODOOR, 'doorway', '.'],
    [DOOR, D_CLOSED, D_BROKEN, 'doorway', '.'],
    [DOOR, D_CLOSED | D_TRAPPED, D_NODOOR, 'doorway', '.'],
] as const) {
    const description = `${mask & D_TRAPPED ? 'trapped ' : ''}${type === SDOOR ? 'secret' : 'closed'} door`;
    void test(`a blind hero remembers a kicked ${description} as ${terrain}`, async () => {
        const level = freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        game.symset = '';
        for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 3;
        game.uarmf = await addInventoryObject(KICKING_BOOTS, { initialize: false, owornmask: W_ARMF });
        const door = level.requireAt(11, 10);
        door.typ = type;
        door.doormask = mask;
        vision_reset();
        vision_recalc(0);
        newsym(11, 10);
        const before = door.remembered_glyph;
        assert.ok(before?.kind === 'terrain');
        assert.equal(before.terrainName, type === SDOOR ? 'wall' : 'closed door');
        setHeroBlindnessTurns(20);
        installPagerInput(resetInputState(), { expected: /door|booby-trapped|stagger/, limit: 5 });

        await kickDirection('l');
        await flush_screen();

        assert.equal(door.doormask, outcome);
        const remembered = door.remembered_glyph;
        assert.ok(remembered?.kind === 'terrain');
        assert.equal(remembered.terrainName, terrain);
        assert.equal(requireGameDisplay(game).grid[11]?.[10]?.ch, symbol);
    });
}
