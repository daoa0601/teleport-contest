import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_FLAGS2 } from '../js/monster_data.js';
import { AD_SPEL } from '../js/monster_attack_types.js';
import { resumeDeferredMovementSpell } from '../js/monmove.js';
import type { MonsterMovementAction } from '../js/monster_action_types.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';

void test('an arch-lich can summon demons through Gehennom summon-nasties', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Gehennom', flags: { hellish: true } })];
    const lich = await createMonsterAt('arch-lich', 14, 10,
        MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    lich.mux = game.u.ux;
    lich.muy = game.u.uy;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    const action: MonsterMovementAction = {
        monster: lich, calls: [],
        dochugContext: { entryMnum: lich.mnum, range: null, reachesFinalActions: false },
        movement: {
            oldx: lich.mx, oldy: lich.my, x: lich.mx, y: lich.my, moved: false,
            deferredAfterMovementSpell: true,
            spellCast: {
                spell: 'summon-monsters', cast: true, damageType: AD_SPEL,
                directed: false, deferredSpellEffect: true,
            },
        },
    };
    initRng(11n);

    const effect = await resumeDeferredMovementSpell(action, game);

    assert.ok(effect);
    assert.ok(effect.count > 0, 'Gehennom summon-nasties must create demons for a lich too');
    assert.ok(effect.created.every(monster => (MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x100));
    assert.match(effect.message ?? '', /monster.*appears? from nowhere/i);
});
