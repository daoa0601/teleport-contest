import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { A_CON, A_DEX, A_STR, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, DOOR, SDOOR, W_ARMF } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { KICKING_BOOTS, LOCK_PICK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { untrap } from '../js/untrap.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon } from './support/topology.js';
async function fatalDoor(mask = D_CLOSED, type = DOOR) {
    const level = freshPlayableRoom({
        hero: { uhp: 1, uhpmax: 100 },
        flags: { verbose: true, autoopen: true, bones: false,
            disclose: '-i -a -v -c -o', tombstone: false },
    });
    requireFixtureGame(game);
    game.plname = 'Victim';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    for (const attribute of [A_STR, A_DEX, A_CON])
        game.u.acurr.a[attribute] = 25;
    const { roomno } = await createStaffedShop({
        left: 12, right: 16, top: 9, bottom: 11,
        keeperX: 14, keeperY: 10, doorX: 11, doorY: 10,
    });
    const door = level.requireAt(11, 10);
    door.typ = type;
    door.doormask = mask | D_TRAPPED;
    door.roomno = roomno;
    door.edge = true;
    vision_reset();
    vision_recalc(0);
    newsym(11, 10);
    return { level, door };
}
for (const command of ['o', 'l']) {
    void test(`a fatal explosion during ${command === 'o' ? 'explicit' : 'automatic'} opening leaves the shop door intact`, async () => {
        const { level, door } = await fatalDoor();
        pushKeys(`${command === 'o' ? 'l' : ''}${' '.repeat(100)}`);
        await rhack(command.charCodeAt(0));
        assert.equal(game.program_state.gameover, true);
        assert.equal(door.doormask, D_CLOSED | D_TRAPPED);
        assert.equal(level.damagelist?.length ?? 0, 0);
    });
}
void test('a fatal explosion while picking a shop lock leaves the door locked and unbilled', async () => {
    const { level, door } = await fatalDoor(D_LOCKED);
    const tool = await knownObject(LOCK_PICK);
    game.u.dx = 1;
    game.u.dy = 0;
    game._occupation = { key: 'pick-lock', text: 'picking the lock', remaining: 51,
        usedtime: 0, door, x: 11, y: 10, tool, chance: 100 };
    pushKeys(' '.repeat(100));
    await continueCountedCommand();
    assert.equal(game.program_state.gameover, true);
    assert.equal(door.doormask, D_LOCKED | D_TRAPPED);
    assert.equal(level.damagelist?.length ?? 0, 0);
});
void test('a fatal explosion when disarming a shop door leaves the trap and door intact', async () => {
    const { level, door } = await fatalDoor();
    game.u.fumbling = true;
    initRng(1n);
    pushKeys(' '.repeat(100));
    await untrap({
        chooseDirection: async () => ({ dx: 1, dy: 0, dz: 0, key: 'l' }),
        ask: async () => 'y',
    });
    assert.equal(game.program_state.gameover, true);
    assert.equal(door.doormask, D_CLOSED | D_TRAPPED);
    assert.equal(level.damagelist?.length ?? 0, 0);
});
for (const type of [DOOR, SDOOR]) {
    void test(`a fatal explosion when kicking a ${type === SDOOR ? 'secret ' : ''}shop door stops before remembering or billing the damage`, async () => {
        const { level, door } = await fatalDoor(D_CLOSED, type);
        game.uarmf = await addInventoryObject(KICKING_BOOTS, { initialize: false, owornmask: W_ARMF });
        setHeroBlindnessTurns(20);
        pushKeys(`l${' '.repeat(100)}`);
        await rhack(4);
        assert.equal(game.program_state.gameover, true);
        assert.equal(door.doormask, D_NODOOR);
        const remembered = door.remembered_glyph;
        assert.ok(remembered?.kind === 'terrain');
        assert.equal(remembered.terrainName, type === SDOOR ? 'wall' : 'closed door');
        assert.equal(level.damagelist?.length ?? 0, 0);
    });
}
//# sourceMappingURL=door_booby_trap_death.test.js.map