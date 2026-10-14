import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ALTAR, AM_CHAOTIC, AM_LAWFUL, AM_NEUTRAL, D_BROKEN, D_TRAPPED, DOOR, M_AP_FURNITURE, PIT, WEB } from '../js/const.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
async function lookEast() {
    resetInputState().feed('l. ');
    await rhack(';'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(game.context.move, 0);
    return requireGameDisplay().grid.slice(0, 2).map(row => row.map(cell => cell.ch).join('')).join('');
}
for (const [type, name] of [[PIT, 'pit'], [WEB, 'web']]) {
    void test(`quick look identifies a displayed ${name}`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        level.traps.push({ tx: 11, ty: 10, ttyp: type, tseen: true, once: false, launch: { x: 0, y: 0 } });
        newsym(11, 10);
        assert.match(await lookEast(), new RegExp(`\\b${name}\\b`));
    });
}
void test('quick look at an object over a known pit describes the object', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    level.traps.push({ tx: 11, ty: 10, ttyp: PIT, tseen: true, once: false, launch: { x: 0, y: 0 } });
    await floorObject(DAGGER, 11, 10);
    newsym(11, 10);
    assert.match(await lookEast(), /dagger/);
});
void test('quick look gives the alignment of a displayed altar', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    const altar = level.requireAt(11, 10);
    altar.typ = ALTAR;
    altar.flags = AM_LAWFUL;
    newsym(11, 10);
    assert.match(await lookEast(), /lawful altar/);
});
for (const [mask, alignment] of [[AM_LAWFUL, 'lawful'], [AM_NEUTRAL, 'neutral'],
    [AM_CHAOTIC, 'chaotic']]) {
    void test(`quick look uses the ${alignment} alignment of an altar mimic`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        const mimic = await createMonsterAt('small mimic', 11, 10);
        mimic.m_ap_type = M_AP_FURNITURE;
        mimic.mappearance = CmapSymbol.altar;
        mimic.mcorpsenm = mask;
        const location = level.requireAt(11, 10);
        location.typ = ALTAR;
        location.flags = mask === AM_CHAOTIC ? AM_LAWFUL : AM_CHAOTIC;
        newsym(11, 10);
        assert.match(await lookEast(), new RegExp(`\\b${alignment} altar\\b`));
        assert.equal(mimic.m_ap_type, M_AP_FURNITURE);
    });
}
void test('quick look describes a broken doorway even when its trap bit is set', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_BROKEN | D_TRAPPED;
    newsym(11, 10);
    const input = resetInputState();
    input.feed('l.');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /broken door[\s\S]*--More--/, keys: ' ' },
    ]);
});
//# sourceMappingURL=pager_features.test.js.map