import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, W_ARM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CHAIN_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const under of [DB_FLOOR, DB_ICE]) {
    void test(`sitting below a raised bridge over ${under === DB_FLOOR ? 'ground' : 'ice'} keeps armor dry`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const square = level.requireAt(10, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        const armor = await addInventoryObject(CHAIN_MAIL, { blessed: false, oeroded: 0 });
        game.uarm = game.u.uarm = armor;
        armor.owornmask = W_ARM;
        initRng(49n);
        await runExtendedCommand('sit', ' '.repeat(10));
        assert.equal(armor.oeroded, 0);
        assert.match(game._pending_message, under === DB_ICE
            ? /You sit on the ice/ : /Having fun sitting on the ground/);
        assert.equal(game.context.move, 1);
    });
}
void test('sitting below a raised bridge reaches its lava', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const square = level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_LAVA;
    setHeroSpecies(MONSTER_NAME.indexOf('fire elemental'));
    game.u.mtimedone = 100;
    await runExtendedCommand('sit', ' '.repeat(10));
    assert.match(game._pending_message, /The lava feels warm/);
});
for (const raised of [false, true]) {
    void test(`sitting ${raised ? 'below a raised' : 'on a lowered'} bridge over water reaches ${raised ? 'water' : 'the bridge'}`, async () => {
        const level = freshObjectRoom();
        const square = level.requireAt(10, 10);
        square.typ = raised ? DRAWBRIDGE_UP : DRAWBRIDGE_DOWN;
        square.drawbridgemask = DB_MOAT;
        await runExtendedCommand('sit', ' '.repeat(10));
        assert.match(game._pending_message, raised ? /You sit in the water/ : /You sit on the drawbridge/);
    });
}
//# sourceMappingURL=sit_drawbridge.test.js.map