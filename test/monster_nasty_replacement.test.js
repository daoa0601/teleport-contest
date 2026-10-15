import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
void test('a monster replaces genocided summon-nasties choices with ordinary monsters', async () => {
    let summoned = false;
    for (let seed = 1; seed <= 64 && !summoned; seed++) {
        const caster = await prepareSpellCaster('arch-lich', 17);
        requirePlayingGame(game);
        game.u.ulevel = 1;
        game.u.uz.dlevel = 1;
        game.level.flags.rndmongen = true;
        game.mvitals ??= [];
        for (const [species, name] of MONSTER_NAME.entries()) {
            const vital = game.mvitals[species] ??= { born: 0, died: 0, mvflags: 0 };
            if (name !== 'goblin')
                vital.mvflags |= G_GENOD;
        }
        const messages = await finishSpellTurn(seed);
        if (/monster.*appears? from nowhere/i.test(messages)) {
            const replacements = game.level.monsters.filter(monster => monster !== caster && !monster.dead);
            assert.ok(replacements.length > 0, 'A successful summon must create monsters');
            assert.ok(replacements.every(monster => MONSTER_NAME[monster.mnum] === 'goblin'), 'Only a surviving, non-genocided species may replace the direct choice');
            summoned = true;
        }
    }
    assert.ok(summoned, 'Summon nasties must still work when every nasty species is genocided');
});
//# sourceMappingURL=monster_nasty_replacement.test.js.map