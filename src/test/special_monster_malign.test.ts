import test from 'node:test';
import assert from 'node:assert/strict';

import { A_NEUTRAL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { init_dungeons } from '../js/dungeon.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { init_objects } from '../js/o_init.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('killing a peaceful unaligned high priest counts as murder for a neutral hero with negative alignment', async t => {
    freshObjectRoom({
        flags: { bones: false }, gameplaySeed: 731n,
        hero: { ualign: { type: A_NEUTRAL, record: -1 }, uluck: 0 },
    });
    requirePlayingGame(game);
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua, 'level generation should initialize themed-room Lua');
    const room = game.level.rooms.find(isRoom);
    assert.ok(room, 'level generation should create a room for the temple');
    game.in_mklev = true;

    await lua.executeAsync(`
        des.region({ region = { ${room.lx}, ${room.ly}, ${room.hx}, ${room.hy} },
                     lit = 1, type = "temple", filled = 0 })
        des.altar({ x = ${room.lx}, y = ${room.ly}, align = "noalign", type = "sanctum" })
    `);
    const priest = game.level.monsters.find(monster => monster.ispriest
        && MONSTER_NAME[monster.mnum] === 'high cleric');
    assert.ok(priest, 'the sanctum should create its high priest');
    assert.equal(priest.mpeaceful, 1);
    game.in_mklev = false;
    grantIntrinsicProperty('telepathy', 'outside', game);
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /You murderer!/, limit: 1 });

    await finishHeroMonsterKill(priest, priest.mx, priest.my, {
        showKillMessage: false, noCorpse: true,
    });
    messages.push(game._pending_message);

    assert.equal(game.u.telepathy, false);
    assert.ok(game.u.uluck === -2 || game.u.uluck === -3,
        `Murder must cost two luck, plus an optional peaceful-kill penalty; received ${game.u.uluck}`);
    assert.match(messages.join('\n'), /You murderer!/);
    assert.equal(game.u.ualign.record, 1);
});

for (const fixedCoordinate of [true, false]) {
    void test(`killing a pony forced hostile by Lua ${fixedCoordinate ? 'at a fixed coordinate' : 'at a random location'} rewards the co-aligned hero`, async t => {
        freshGame({
            flags: { bones: false },
            hero: { ulevel: 8, ualign: { type: 0, record: 0 } },
        });
        requirePlayingGame(game);
        initRng(731n);
        init_objects();
        await init_dungeons();
        await startLuaCore(t);
        await mklev();
        const lua = currentLuaLifecycle().getThemedState(game, 0);
        assert.ok(lua, 'level generation should initialize themed-room Lua');
        const room = game.level.rooms.find(isRoom);
        assert.ok(room, 'level generation should create a room');
        const coordinates = fixedCoordinate
            ? `x = ${room.lx}, y = ${room.ly + 1},` : '';
        game.in_mklev = true;
        initRng(2n);

        await lua.executeAsync(`
            des.monster({ id = "pony", name = "Lua pony", peaceful = 0, ${coordinates} })
        `);
        const pony = game.level.monsters.find(monster => monster.mgivenname === 'Lua pony');
        assert.ok(pony, 'the level file should create its named pony');
        assert.equal(pony.mpeaceful, 0);
        game.in_mklev = false;

        await finishHeroMonsterKill(pony, pony.mx, pony.my, {
            showKillMessage: false, noCorpse: true,
        });

        assert.equal(game.u.ualign.record, 3);
    });
}
