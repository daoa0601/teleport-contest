import assert from 'node:assert/strict';
import test from 'node:test';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { MONSTER_NAME, monsterIsPlayerMonster } from '../js/monster_data.js';
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION } from '../js/object_data.js';
import { selectHandToHandWeapon } from '../js/monster_weapon.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';

for (const pets of [0, 1]) {
    void test(`Astral arrival grants an equipped guardian while ${pets ? 'keeping' : 'preserving petless'} conduct`, async t => {
        freshObjectRoom({
            flags: { bones: false }, gameplaySeed: 37n,
            hero: { ualign: { type: 0, record: 9 }, uconduct: { pets } },
        });
        requirePlayingGame(game);
        await init_dungeons();
        await startLuaCore(t);
        const astral = game.astral_level;
        assert.ok(astral, 'the dungeon graph must identify Astral');
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');

        await gotoLevel(astral);

        const guardian = game.level.monsters.slice().reverse().find(monster => monster.isminion
            && monster.mpeaceful && monster.mnum === MONSTER_NAME.indexOf('Angel')
        && Math.max(Math.abs(monster.mx - game.u.ux), Math.abs(monster.my - game.u.uy)) === 1);
        assert.ok(guardian, 'the worthy hero must receive a peaceful guardian');
        assert.equal(guardian.mtame ?? 0, pets ? 10 : 0);
        assert.equal(game.u.uconduct.pets, pets ? 2 : 0);
        assert.equal(guardian.edog ?? guardian.mextra?.edog, undefined);
        assert.ok(guardian.m_lev >= 15 && guardian.m_lev <= 22);
        assert.ok(guardian.mhp >= guardian.m_lev + 31);
        const weapon = selectHandToHandWeapon(guardian);
        assert.ok(weapon?.blessed, 'the guardian must have a blessed melee weapon');
        assert.ok(guardian.minvent?.some(object =>
            object.otyp === AMULET_OF_REFLECTION || object.otyp === SHIELD_OF_REFLECTION));
        const opponents = game.level.monsters.filter(monster => monsterIsPlayerMonster(monster.mnum));
        assert.ok(opponents.length >= 3 && opponents.length <= 6);
        assert.ok(opponents.every(monster => monster.mgivenname && !monster.mpeaceful));
    });
}

void test('Conflict replaces the Astral guardian reward with hostile angels', async t => {
    freshObjectRoom({ flags: { bones: false }, gameplaySeed: 37n,
        hero: { ualign: { type: 0, record: 9 } } });
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    const astral = game.astral_level;
    assert.ok(astral);
    grantIntrinsicProperty('conflict', 'outside');
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await gotoLevel(astral);

    const angels = game.level.monsters.filter(monster => monster.isminion
        && monster.mnum === MONSTER_NAME.indexOf('Angel')
        && Math.max(Math.abs(monster.mx - game.u.ux), Math.abs(monster.my - game.u.uy)) === 1);
    assert.ok(angels.length >= 2 && angels.length <= 4,
        `Conflict must send two to four nearby angels; found ${angels.length}`);
    assert.ok(angels.every(monster => !monster.mpeaceful && !monster.mtame));
});
