import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { init_dungeons } from '../js/dungeon.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { mklev } from '../js/mklev.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
import { pline } from '../js/display.js';
import { cansee, vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('a Lua shapechanger in a fire-elemental body illuminates nearby dark floor before the next message', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    await lua.executeAsync(`des.map({ x = 7, y = 6, lit = false,
        map = [[..........
..........
..........
..........
..........
..........
..........
..........
..........]] })`);
    game.in_mklev = false;
    game.u.ux = 10;
    game.u.uy = 10;
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(cansee(14, 10), false);
    initRng(2n);

    await lua.executeAsync(`des.monster({ id = "chameleon", x = 6, y = 4,
        appear_as = "mon:fire elemental", group = 0, name = "Glowing body" })`);
    await pline('You look around.');

    const monster = game.level.monsters.find(candidate => candidate.mgivenname === 'Glowing body');
    assert.ok(monster);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('fire elemental'));
    assert.equal(monster.mx, 13);
    assert.equal(monster.my, 10);
    assert.equal(cansee(14, 10), true, 'the new body lights adjacent floor without moving the hero');
    assert.equal(game.level.requireAt(14, 10).lit, false, 'body light is temporary illumination');
});

for (const female of [undefined, false, true]) {
    void test(`Lua vampire-class creation uses ${female === true ? 'explicit female' : female === false ? 'explicit male' : 'default male'} sex through shape changes`, async t => {
        const lua = await roomBindings(t);
        requirePlayingGame(game);
        initRng(2n);
        await lua.executeAsync(`
            des.map({ map = [[......
......
......]], contents = function()
                for x = 0, 5 do
                    des.monster({ class = "V", x = x, y = 1,
                        ${female === undefined ? '' : `female = ${female ? 1 : 0},`}
                        group = 0, peaceful = 0 })
                end
            end })
        `);
        const vampires = game.level.monsters.filter(monster =>
            monster.cham === MONSTER_NAME.indexOf('vampire')
            || monster.cham === MONSTER_NAME.indexOf('vampire leader'));
        assert.equal(vampires.length, 6);

        for (const vampire of vampires) {
            assert.equal(!!vampire.female, female ?? false);
            const naturalForm = vampire.cham;
            assert.ok(naturalForm !== undefined);
            await changeMonsterForm(vampire, naturalForm, game);
            assert.equal(!!vampire.female, female ?? false);
        }
    });
}

void test('Lua class and random monster requests default to male after birth', async t => {
    freshObjectRoom();
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.in_mklev = true;
    initRng(41n);

    await lua.executeAsync(`
        for i = 1, 8 do
            des.monster({ class = "h", name = "Class birth " .. i, group = 0 })
        end
        des.monster({ name = "Random birth", group = 0 })
    `);

    const monsters = game.level.monsters.filter(monster =>
        monster.mgivenname?.startsWith('Class birth ') || monster.mgivenname === 'Random birth');
    assert.equal(monsters.length, 9);
    for (const monster of monsters) {
        assert.equal(monster.female, false,
            `${monster.mgivenname} should have the Lua default gender`);
    }
});

void test('Lua honors explicit gender for a named species but preserves a fixed species gender', async t => {
    freshObjectRoom();
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.in_mklev = true;

    await lua.executeAsync(`
        des.monster({ id = "dwarf leader", name = "Female dwarf", female = true, group = 0 })
        des.monster({ id = "dwarf lady", name = "Male dwarf", female = false, group = 0 })
        des.monster({ id = "wood nymph", name = "Fixed female", female = false, group = 0 })
    `);

    const femaleDwarf = game.level.monsters.find(monster => monster.mgivenname === 'Female dwarf');
    const maleDwarf = game.level.monsters.find(monster => monster.mgivenname === 'Male dwarf');
    const nymph = game.level.monsters.find(monster => monster.mgivenname === 'Fixed female');
    assert.ok(femaleDwarf && maleDwarf && nymph);
    assert.equal(femaleDwarf.female, true);
    assert.equal(maleDwarf.female, false);
    assert.equal(nymph.female, true);
});

void test('a Lua vampire appearance changes its body back to a vampire', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    initRng(2n);

    await lua.executeAsync(`des.monster({ id = "vampire", x = 2, y = 1,
        appear_as = "mon:vampire", group = 0, name = "Natural vampire" })`);

    const vampire = game.level.monsters.find(monster => monster.mgivenname === 'Natural vampire');
    assert.ok(vampire);
    assert.equal(vampire.mnum, MONSTER_NAME.indexOf('vampire'));
    assert.equal(vampire.m_ap_type ?? 0, 0, 'the requested body is a real form, not a disguise');
    assert.equal(vampire.cham, MONSTER_NAME.indexOf('vampire'));
});

void test('a waiting Lua vampire starts in its natural body', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    initRng(2n);

    await lua.executeAsync(`des.monster({ id = "vampire", x = 2, y = 1,
        waiting = 1, group = 0, name = "Waiting vampire" })`);

    const vampire = game.level.monsters.find(monster => monster.mgivenname === 'Waiting vampire');
    assert.ok(vampire);
    assert.equal(vampire.mnum, MONSTER_NAME.indexOf('vampire'));
});
