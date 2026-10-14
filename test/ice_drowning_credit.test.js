import test from 'node:test';
import assert from 'node:assert/strict';
import { ICE, ICED_POOL, W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { meltIce } from '../js/ice.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
for (const monsterMoving of [false, true]) {
    void test(`${monsterMoving ? 'environmental thawing' : 'hero melting ice'} assigns native drowning credit`, async () => {
        const level = freshPlayableRoom();
        const rat = await createMonsterAt('giant rat', 11, 10);
        const square = level.requireAt(11, 10);
        square.typ = ICE;
        square.icedpool = ICED_POOL;
        game.context.mon_moving = monsterMoving;
        const kills = game.u.uconduct?.killer ?? 0;
        const experience = game.u.uexp ?? 0;
        pushKeys(' '.repeat(10));
        await meltIce(11, 10);
        assert.equal(rat.dead, true);
        assert.equal(game.u.uconduct?.killer ?? 0, kills + (monsterMoving ? 0 : 1));
        assert.equal((game.u.uexp ?? 0) > experience, !monsterMoving);
        assert.match(game._pending_message, monsterMoving ? /The giant rat drowns\./ : /You drown the giant rat\./);
    });
}
void test('hero-caused drowning breaks pacifist conduct even when the monster is life-saved', async () => {
    const level = freshPlayableRoom();
    const rat = await createMonsterAt('giant rat', 11, 10);
    const amulet = await equipMonsterObject(rat, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const square = level.requireAt(11, 10);
    square.typ = ICE;
    square.icedpool = ICED_POOL;
    game.context.mon_moving = false;
    const kills = game.u.uconduct?.killer ?? 0;
    const experience = game.u.uexp ?? 0;
    pushKeys(' '.repeat(20));
    await meltIce(11, 10);
    assert.equal(amulet.where, 'gone');
    assert.ok(rat.mhp > 0);
    assert.equal(game.u.uconduct?.killer ?? 0, kills + 1);
    assert.equal(game.u.uexp ?? 0, experience);
    assert.notEqual(level.requireAt(rat.mx, rat.my).typ, square.typ);
});
//# sourceMappingURL=ice_drowning_credit.test.js.map