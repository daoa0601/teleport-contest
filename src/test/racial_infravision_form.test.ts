import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { uInitMisc } from '../js/u_init.js';
import { races } from '../js/roles.js';
import { vision_recalc } from '../js/vision.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('gnome and dwarf infravision follows the current body while elf and orc infravision survives polymorph', async () => {
    for (const name of ['gnome', 'dwarf', 'elf', 'orc']) {
        const race = races.find(candidate => candidate.name === name);
        assert.ok(race);
        const level = freshObjectRoom({ race });
        uInitMisc(1);
        grantIntrinsicProperty('warning', 'outside');
        const monster = await createMonsterAt('soldier', 14, 10, MM_NOGRP | NO_MINVENT);
        monster.mpeaceful = false;
        monster.m_lev = 12;
        level.requireAt(14, 10).lit = false;
        vision_recalc(0);
        newsym(14, 10);
        await flush_screen(1);
        assert.equal(requireScreenCell(13, 11).ch, '@', `${name} sees the soldier before polymorph`);

        installPolymorphedHero('piranha');
        newsym(14, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(13, 11).ch, name === 'elf' || name === 'orc' ? '@' : '3',
            `${name} uses the native racial and form sources after polymorph`);
        assert.equal(game.u.infravision, name === 'elf' || name === 'orc');
    }
});
