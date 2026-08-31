import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ARROW_TRAP, CORR, SCORR, SDOOR,
} from '../js/const.js';
import { mapLevel } from '../js/detect.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('mapping finds secret corridors but preserves other secrets', () => {
    const level = freshWeaponArena();
    level.flags.hero_memory = true;
    level.at(30, 9).typ = SCORR;
    level.at(31, 9).typ = SDOOR;
    const hiddenTrap = {
        ttyp: ARROW_TRAP, tx: 32, ty: 9, tseen: false,
    };
    const knownTrap = {
        ttyp: ARROW_TRAP, tx: 33, ty: 9, tseen: true,
    };
    level.traps.push(hiddenTrap, knownTrap);

    mapLevel();

    assert.equal(level.at(30, 9).typ, CORR);
    assert.equal(level.at(31, 9).typ, SDOOR);
    assert.equal(hiddenTrap.tseen, false);
    assert.equal(level.at(33, 9).remembered_glyph.kind, 'trap');
});
