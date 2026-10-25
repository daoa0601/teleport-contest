import assert from 'node:assert/strict';
import test from 'node:test';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { CORR, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_reset } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';

const PM_EARTH_ELEMENTAL = MONSTER_NAME.indexOf('earth elemental');
const PM_XORN = MONSTER_NAME.indexOf('xorn');

// C dig.c dig(): after a finished dig on the Plane of Earth, one swing in
// three raises the debris as an earth elemental or a xorn.
void test('finished Earth digs raise their debris as elementals or xorn', async () => {
    const expectations = [
        [1n, PM_XORN],
        [9n, PM_EARTH_ELEMENTAL],
    ] as const;
    for (const [seed, species] of expectations) {
        const level = freshObjectRoom();
        game.earth_level = createSpecialLevel({
            dnum: game.u.uz?.dnum ?? 0, dlevel: game.u.uz?.dlevel ?? 8,
            flags: { town: false },
        });
        const pick = await addInventoryObject(PICK_AXE, { spe: 0 });
        game.uwep = game.u.uwep = pick;
        level.requireAt(11, 10).typ = STONE;
        vision_reset();
        const input = resetInputState();
        input.display = { async readKey() { return ' '.charCodeAt(0); } };
        input.feed(`${pick.invlet}l`);
        initRng(seed);

        await rhack('a'.charCodeAt(0));
        for (let swing = 0; game._occupation && swing < 20; swing++)
            await continueCountedCommand();

        assert.match(String(game._pending_message),
            /The debris from your digging comes to life!$/);
        assert.ok(level.monsters.some(monster => monster.mnum === species
            && monster.mx === 11 && monster.my === 10),
            `seed ${seed} must raise a ${MONSTER_NAME[species]} in the dug square`);
        assert.equal(level.requireAt(11, 10).typ, CORR);
    }
});
