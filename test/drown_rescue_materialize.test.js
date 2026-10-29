import assert from 'node:assert/strict';
import test from 'node:test';
import { A_CON, A_STR, POOL, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, LEATHER_ARMOR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
const noDisplay = {
    recalculateVision: () => { },
    resetVision: () => { },
    repaint: () => { },
};
function poolAtHero() {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = POOL;
    game.u.acurr.a[A_STR] = 3;
    game.u.acurr.a[A_CON] = 3;
    game.u.uhp = 20;
    return level;
}
// C trap.c:5189: the life-saving rescue runs safe_teleds(TELEDS_TELEPORT),
// and teleds() prints the verbose "You materialize in ... location!" line
// for every teleport-flagged relocation (teleport.c:545-547).  Only the
// "a different" variant can occur here: a drowning hero stands on liquid,
// and goodpos() rejects that liquid square as a destination for a
// non-swimming youmonst (teleport.c:133-143), so the rescue can never
// land where it started.  The same/different selection still mirrors
// teleds() exactly.
void test('a life-saved drowning hero still materializes audibly at the rescue spot', async () => {
    const level = poolAtHero();
    requireFixtureGame(game);
    level.requireAt(20, 5).typ = ROOM;
    await addInventoryObject(LEATHER_ARMOR, { oclass: 3 });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        oclass: 5, worn: true,
    });
    game.uamul = amulet;
    game.u.uamul = amulet;
    game._helplessTurns = 5; // a helpless hero cannot crawl out of the pool
    const messages = [];
    await heroLiquidEffects({
        ...noDisplay,
        publish: async (message) => messages.push(message),
        random: range => range === 21 ? 5 : range - 1,
        rollDice: () => 10,
        rollOne: () => 20,
        die: async () => assert.fail('life saving should prevent death'),
    });
    const text = messages.join(' | ');
    assert.match(text, /You materialize in a different location!/, text);
    assert.deepEqual([game.u.ux, game.u.uy], [20, 5]);
});
void test('a drowning rescue preserves the submerged view during its relocation announcement', async () => {
    const level = poolAtHero();
    for (let x = 9; x <= 13; x++)
        for (let y = 8; y <= 12; y++)
            level.requireAt(x, y).typ = POOL;
    level.requireAt(20, 5).typ = ROOM;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, { worn: true });
    game.uamul = amulet;
    game.u.uamul = amulet;
    const input = resetInputState();
    let sawRescue = false;
    let acknowledgements = 0;
    input.beforeRead = () => {
        assert.ok(++acknowledgements <= 24, 'drowning and rescue must finish their messages');
        const line = requireScreenRow(0).map(cell => cell.ch).join('');
        if (line.includes('materialize')) {
            sawRescue = true;
            assert.equal(game.u.uinwater, 1, 'the hero still has the submerged view while the rescue announcement is on screen');
        }
        input.feed(' ');
    };
    await rhack('l'.charCodeAt(0));
    assert.equal(sawRescue, true);
    assert.equal(game.u.uinwater, 0);
    assert.equal(amulet.where, 'gone');
});
//# sourceMappingURL=drown_rescue_materialize.test.js.map