import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_ALIGNMENT, MONSTER_FLAGS2 } from '../js/monster_data.js';
import { msummon } from '../js/minion.js';
import { AD_SPEL } from '../js/monster_attack_types.js';
import { mcastSpell, movementSpellContext } from '../js/mcastu.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test('an arch-lich can summon demons through Gehennom summon-nasties', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Gehennom', flags: { hellish: true } })];
    const lich = await createMonsterAt('arch-lich', 14, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    lich.mux = game.u.ux;
    lich.muy = game.u.uy;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    const summonedBefore = new Set(game.level.monsters.map(monster => monster.m_id));
    const messages = [];
    const action = {
        monster: lich, calls: [],
        dochugContext: { entryMnum: lich.mnum, range: null, reachesFinalActions: false },
        movement: {
            oldx: lich.mx, oldy: lich.my, x: lich.mx, y: lich.my, moved: false,
            spellCast: {
                spell: 'summon-monsters', cast: true, damageType: AD_SPEL,
                directed: false,
            },
        },
    };
    initRng(11n);
    await mcastSpell(lich, 'summon-monsters', 0, movementSpellContext(lich, game, action.calls, {
        publish: async (message) => { messages.push(message); },
    }));
    const created = game.level.monsters.filter(monster => !summonedBefore.has(monster.m_id));
    assert.match(messages.join('\n'), /monster.*appears? from nowhere/i);
    assert.ok(created.length > 0, 'Gehennom summon-nasties must create demons for a lich too');
    assert.ok(created.every(monster => (MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x100));
});
void test('Wizard-style demon summoning can choose lawful demons without a caster', async () => {
    let lawfulSummons = 0;
    for (let seed = 1; seed <= 32; seed++) {
        await freshObjectRoom({ hero: { ulevel: 20, uz: { dnum: 0, dlevel: 20 } } });
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        initRng(BigInt(seed));
        const effect = await msummon();
        lawfulSummons += effect.created.filter(monster => (MONSTER_ALIGNMENT[monster.mnum] ?? 0) > 0).length;
    }
    assert.ok(lawfulSummons > 0, 'an unrestricted Wizard summon must admit lawful demons');
});
//# sourceMappingURL=monster_nasty_demons.test.js.map