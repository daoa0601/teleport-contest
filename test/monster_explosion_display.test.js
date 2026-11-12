import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { monsterExplodes } from '../js/explode.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_ACID, AD_DRST, AT_BOOM } from '../js/monster_attack_types.js';
import { CLR_GREEN, CLR_ORANGE } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
void test('a poisonous monster explosion displays a noxious green blast', async () => {
    await freshObjectRoom({ context: { mon_moving: true } });
    game.symset = 'ASCII';
    const colors = [];
    game.animationFrame = async () => { colors.push(requireScreenCell(13, 10).color); };
    const golem = await createMonsterAt('iron golem', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    golem.mhp = 0;
    await monsterExplodes(golem, [AT_BOOM, AD_DRST, 0, 0]);
    assert.ok(colors.length > 0, 'The explosion was displayed.');
    assert.ok(colors.every(color => color === CLR_GREEN), 'The noxious blast is green.');
});
void test('an unsupported monster explosion style reports the damage type and continues with a fiery blast', async () => {
    await freshObjectRoom({ context: { mon_moving: true } });
    const input = resetInputState();
    installPagerInput(input, { expected: /bad explosion type|Program in disorder|Please report/, limit: 6 });
    let diagnosticShown = false;
    input.beforeRead = () => {
        const message = requireScreenRow(0).map(cell => cell.ch).join('');
        diagnosticShown ||= message.includes(`adtyp_to_expltype: bad explosion type ${AD_ACID}`);
    };
    game.animationFrame = async () => {
        assert.equal(requireScreenCell(13, 10).color, CLR_ORANGE);
    };
    const golem = await createMonsterAt('iron golem', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    golem.mhp = 0;
    await monsterExplodes(golem, [AT_BOOM, AD_ACID, 0, 0]);
    assert.ok(diagnosticShown, 'The native impossible() diagnostic appears before the fallback blast.');
});
//# sourceMappingURL=monster_explosion_display.test.js.map