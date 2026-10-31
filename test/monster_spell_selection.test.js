import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_CLRC, AD_SPEL } from '../js/monster_attack_types.js';
import { chooseMonsterSpell } from '../js/mcastu.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function spellCaster(level) {
    await freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    const caster = await createMonsterAt('kobold shaman', 12, 10, MM_NOWAIT | NO_MINVENT);
    caster.mpeaceful = 0;
    caster.msleeping = 0;
    caster.mhp = caster.mhpmax = 100;
    caster.m_lev = level;
    caster.mstrategy = 0;
    return caster;
}
// C mcastu.c:choose_monster_spell(): the level roll admits spells up to the
// rolled value, so a minimum roll selects only each list's level-zero spell.
void test('a minimum level roll admits only the level-zero spell of each list', async () => {
    const wizardCaster = await spellCaster(23);
    const clericCaster = await spellCaster(23);
    requirePlayingGame(game);
    assert.equal(chooseMonsterSpell(wizardCaster, AD_SPEL, game, () => 0, []).key, 'psi-bolt');
    assert.equal(chooseMonsterSpell(clericCaster, AD_CLRC, game, () => 0, []).key, 'open-wounds');
});
// C mcastu.c:choose_monster_spell() with spell_would_be_useless(): the table
// walk skips higher spells the caster cannot use.  clone-wizard needs the
// caster to be the Wizard of Yendor, so a strong ordinary shaman falls
// through to summon-monsters.
void test('a strong non-Wizard caster skips clone-wizard and summons instead', async () => {
    const caster = await spellCaster(23);
    requirePlayingGame(game);
    // rn2(23) rolls 22, above the wizard list's top level, and the
    // rn2(maxLevel) retry also misses, so the value is rerolled to 19.
    const spell = chooseMonsterSpell(caster, AD_SPEL, game, limit => limit - 1, []);
    assert.equal(spell.key, 'summon-monsters');
});
//# sourceMappingURL=monster_spell_selection.test.js.map