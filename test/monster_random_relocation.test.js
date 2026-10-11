import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER, MIGR_RANDOM, RLOC_NOMSG, STAIRS } from '../js/const.js';
import { game, requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { deliverMigratingMonsters, migrateMonsterOffLevel } from '../js/monster_migration.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { initRng } from '../js/rng.js';
import { controlMonsterTeleport, randomMonsterRelocation } from '../js/teleport.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
function stairsAt(x, y, { up = true, ladder = false, dungeon } = {}) {
    requirePlayingGame(game);
    game.level.requireAt(x, y).typ = ladder ? LADDER : STAIRS;
    game.stairs = {
        sx: x, sy: y, up, isladder: ladder, u_traversed: false,
        tolev: { dnum: dungeon ?? game.u.uz.dnum, dlevel: game.u.uz.dlevel + (up ? -1 : 1) },
        next: game.stairs,
    };
}
function tower(boundary, prototype = 'wizard2') {
    requirePlayingGame(game);
    game._activeSpecialLevel = { prototype, file: `${prototype}.lua`, downTeleportExclude: boundary };
    game.level.downTeleportRegion = { lx: 1, ly: 0, hx: 79, hy: 20, exclude: boundary };
    game.level.upTeleportRegion = { ...game.level.downTeleportRegion };
}
void test('the Wizard prefers the upstairs within the current dungeon', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    resetInputState().beforeRead = () => {
        throw new Error('The Wizard stair shortcut must not ask for a destination.');
    };
    const wizard = await createMonsterAt('Wizard of Yendor', 14, 10);
    stairsAt(16, 12);
    stairsAt(15, 12, { dungeon: game.u.uz.dnum + 1 });
    stairsAt(14, 12, { ladder: true });
    stairsAt(13, 12, { up: false });
    initRng(1n);
    await randomMonsterRelocation(wizard, { flags: RLOC_NOMSG });
    assert.deepEqual([wizard.mx, wizard.my], [16, 12]);
});
for (const bottom of [false, true]) {
    void test(`the Wizard blocks the tower ${bottom ? 'up' : 'down'} ladder when the hero is inside`, async () => {
        freshObjectRoom({ right: 30 });
        requirePlayingGame(game);
        tower({ lx: 8, ly: 6, hx: 18, hy: 14 }, bottom ? 'wizard3' : 'wizard2');
        const wizard = await createMonsterAt('Wizard of Yendor', 24, 10);
        stairsAt(23, 12);
        stairsAt(16, 12, { ladder: true });
        if (!bottom)
            stairsAt(14, 12, { ladder: true, up: false });
        initRng(1n);
        await randomMonsterRelocation(wizard, { flags: RLOC_NOMSG });
        assert.deepEqual([wizard.mx, wizard.my], [bottom ? 16 : 14, 12]);
    });
}
void test('the Wizard can cross the tower boundary to guard upstairs when the hero is outside', async () => {
    freshObjectRoom({ right: 30 });
    requirePlayingGame(game);
    tower({ lx: 20, ly: 6, hx: 28, hy: 14 });
    const wizard = await createMonsterAt('Wizard of Yendor', 24, 10);
    stairsAt(16, 12);
    stairsAt(23, 12, { ladder: true, up: false });
    initRng(1n);
    await randomMonsterRelocation(wizard, { flags: RLOC_NOMSG });
    assert.deepEqual([wizard.mx, wizard.my], [16, 12]);
});
void test('an occupied preferred stair sends the Wizard to an ordinary valid destination', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    const wizard = await createMonsterAt('Wizard of Yendor', 14, 10);
    stairsAt(16, 12);
    const blocker = await createMonsterAt('orc', 16, 12);
    initRng(1n);
    const result = await randomMonsterRelocation(wizard, { flags: RLOC_NOMSG });
    assert.ok(result);
    assert.equal(monsterAtPosition(game.level, 16, 12), blocker);
    assert.ok(wizard.mx !== 16 || wizard.my !== 12);
});
void test('a migrating Wizard does not take the upstairs shortcut', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    resetInputState().beforeRead = () => {
        throw new Error('A migrating monster must not ask for a destination.');
    };
    const wizard = await createMonsterAt('Wizard of Yendor', 14, 10);
    stairsAt(16, 12);
    await migrateMonsterOffLevel(wizard, game, { dst: { ...game.u.uz } }, { mode: MIGR_RANDOM });
    initRng(1n);
    assert.equal(await deliverMigratingMonsters(), 1);
    assert.ok(wizard.mx !== 16 || wizard.my !== 12);
});
for (const inside of [false, true]) {
    void test(`a tower migrant remains ${inside ? 'inside' : 'outside'} its boundary`, async () => {
        freshObjectRoom({ right: 24 });
        requirePlayingGame(game);
        tower({ lx: 12, ly: 6, hx: 18, hy: 14 });
        const orc = await createMonsterAt('orc', inside ? 14 : 20, 10);
        await migrateMonsterOffLevel(orc, game, { dst: { ...game.u.uz } }, { mode: MIGR_RANDOM });
        initRng(1n);
        assert.equal(await deliverMigratingMonsters(), 1);
        const landedInside = orc.mx >= 12 && orc.mx <= 18 && orc.my >= 6 && orc.my <= 14;
        assert.equal(landedInside, inside);
    });
}
void test('random arrival falls back to a legal square when its preferred region is inaccessible', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    game.level.downTeleportRegion = { lx: 50, ly: 10, hx: 55, hy: 12 };
    const orc = await createMonsterAt('orc', 14, 10);
    await migrateMonsterOffLevel(orc, game, { dst: { ...game.u.uz } }, { mode: MIGR_RANDOM });
    initRng(1n);
    assert.equal(await deliverMigratingMonsters(), 1);
    assert.ok(orc.mx >= 7 && orc.mx <= 24);
    assert.ok(orc.my >= 6 && orc.my <= 14);
    assert.equal(monsterAtPosition(game.level, orc.mx, orc.my), orc);
});
async function controlledRelocation(monster, keys, { force = null } = {}) {
    const input = resetInputState();
    const visible = [];
    const commands = [...keys];
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        visible.push(screen);
        if (screen.includes('--More--'))
            input.feed(' ');
        else if (screen.includes('force anyway?')) {
            assert.ok(force !== null, 'the selected destination must not ask for force');
            input.feed(force);
        }
        else {
            assert.ok(commands.length, `Unexpected input request: ${screen.split('\n')[0]}`);
            const command = commands.shift();
            assert.ok(command !== undefined);
            input.feed(command);
        }
    };
    const result = await randomMonsterRelocation(monster, { flags: RLOC_NOMSG });
    return { result, visible };
}
function enableMonsterControl() {
    game.flags.debug = true;
    game.flags.tips = false;
    game.flags.verbose = false;
    game._monTelecontrol = true;
}
void test('controlled relocation starts at the monster, not the hero or a travel target', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    game._travelTarget = { x: 21, y: 12 };
    const orc = await createMonsterAt('orc', 14, 10);
    game.context.move = 1;
    const { result, visible } = await controlledRelocation(orc, 'll.');
    assert.ok(result);
    assert.deepEqual([result.x, result.y], [16, 10]);
    assert.match(visible[0] ?? '', /Teleport the orc @ <14,10> where\?/);
    assert.deepEqual(game._travelTarget, { x: 21, y: 12 });
    assert.equal(game.context.move, 1);
});
void test('cancelling monster control resumes random relocation', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    const orc = await createMonsterAt('orc', 14, 10);
    initRng(1n);
    const { result } = await controlledRelocation(orc, '\x1b');
    assert.ok(result);
    assert.equal(game._pending_message, 'Picking random destination.');
    assert.equal(monsterAtPosition(game.level, orc.mx, orc.my), orc);
});
void test('the hero square cannot be forced as a controlled monster destination', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    const orc = await createMonsterAt('orc', 11, 10);
    initRng(1n);
    const { result } = await controlledRelocation(orc, 'h.');
    assert.ok(result);
    assert.ok(orc.mx !== game.u.ux || orc.my !== game.u.uy);
    assert.equal(game._pending_message, 'Picking random destination.');
});
for (const force of ['y', 'n']) {
    void test(`an invalid controlled destination can be ${force === 'y' ? 'forced' : 'declined'}`, async () => {
        freshObjectRoom({ right: 24 });
        requirePlayingGame(game);
        enableMonsterControl();
        const orc = await createMonsterAt('orc', 24, 10);
        initRng(1n);
        const { result, visible } = await controlledRelocation(orc, 'l.', { force });
        assert.ok(result);
        assert.ok(visible.some(screen => screen.includes('<24,10> is not considered viable; force anyway?')));
        if (force === 'y')
            assert.deepEqual([orc.mx, orc.my], [25, 10]);
        else {
            assert.ok(orc.mx !== 25 || orc.my !== 10);
            assert.equal(game._pending_message, 'Picking random destination.');
        }
    });
}
void test('the fuzzer falls back without offering to force an invalid destination', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    game.flags.debug_fuzzer = 1;
    const orc = await createMonsterAt('orc', 24, 10);
    initRng(1n);
    await controlledRelocation(orc, 'l.');
    assert.ok(orc.mx !== 25 || orc.my !== 10);
    assert.equal(game._pending_message, 'Picking random destination.');
});
for (const disabled of ['wizard mode', 'option']) {
    void test(`monster control does not prompt without ${disabled}`, async () => {
        freshObjectRoom({ right: 24 });
        requirePlayingGame(game);
        enableMonsterControl();
        if (disabled === 'wizard mode')
            game.flags.debug = false;
        else
            game._monTelecontrol = false;
        const orc = await createMonsterAt('orc', 14, 10);
        initRng(1n);
        const { result, visible } = await controlledRelocation(orc, '');
        assert.ok(result);
        assert.equal(visible.length, 0);
    });
}
void test('derived control uses the supplied destination and ignores teleport boundaries', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    const orc = await createMonsterAt('orc', 14, 10);
    game.level.downTeleportRegion = {
        lx: 1, ly: 0, hx: 79, hy: 20,
        exclude: { lx: 16, ly: 8, hx: 20, hy: 12 },
    };
    const input = resetInputState();
    input.feed('.');
    const point = await controlMonsterTeleport(orc, { x: 16, y: 10 }, { mode: 'near' });
    assert.ok(point);
    assert.equal(point.x, 16);
    assert.equal(point.y, 10);
    assert.deepEqual([orc.mx, orc.my], [14, 10], 'the selector leaves relocation to its caller');
});
void test('cancelling derived control leaves the caller to use its original destination', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    const orc = await createMonsterAt('orc', 14, 10);
    const input = resetInputState();
    input.feed('\x1b');
    const point = await controlMonsterTeleport(orc, { x: 16, y: 10 }, { mode: 'near' });
    assert.equal(point, null);
    assert.equal(game._pending_message, 'Using derived destination.');
    assert.deepEqual([orc.mx, orc.my], [14, 10]);
});
void test('an invalid control default starts at the monster current position', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    enableMonsterControl();
    const orc = await createMonsterAt('orc', 14, 10);
    const input = resetInputState();
    input.feed('l.');
    const point = await controlMonsterTeleport(orc, { x: 0, y: 0 }, { mode: 'near' });
    assert.ok(point);
    assert.equal(point.x, 15);
    assert.equal(point.y, 10);
});
//# sourceMappingURL=monster_random_relocation.test.js.map