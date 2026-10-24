import test from 'node:test';
import assert from 'node:assert/strict';
import { A_WIS, P_CLERIC_SPELL, P_DIVINATION_SPELL, P_EXPERT } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPE_LIGHT, SPE_PROTECTION } from '../js/object_data.js';
import { ensureHeroSkills } from '../js/skills.js';
import { castSpell, forceLearnSpell } from '../js/spell.js';
import { viewKnownSpells } from '../js/spell_menu.js';
import { freshObjectRoom } from './support/object-room.js';
import { trainSpellSkill } from './support/spells.js';
for (const { role, category } of [
    { role: 'priest', category: 'clerical' },
    { role: 'wizard', category: 'divination' },
]) {
    void test(`${role} sees light in the ${category} spell school`, async () => {
        freshObjectRoom({ role });
        forceLearnSpell(SPE_LIGHT);
        const input = resetInputState();
        const viewing = viewKnownSpells();
        await input.waitUntilBlocked();
        const row = requireGameDisplay().grid.map(cells => cells.map(cell => cell.ch).join(''))
            .find(line => line.includes(' - light'));
        input.feed(' ');
        await viewing;
        assert.ok(row, 'the spell menu lists the memorized light spell');
        assert.match(row, new RegExp(`light\\s+1\\s+${category}\\s+`));
    });
}
void test('casting light as a Priest practices clerical spells', async () => {
    freshObjectRoom({ role: 'priest', hero: { ulevel: 30, uen: 100, uenmax: 100 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_WIS] = game.u.amax.a[A_WIS] = 25;
    await trainSpellSkill(SPE_PROTECTION, P_EXPERT);
    forceLearnSpell(SPE_LIGHT);
    const skills = ensureHeroSkills(game);
    const clerical = skills?.[P_CLERIC_SPELL];
    const divination = skills?.[P_DIVINATION_SPELL];
    assert.ok(clerical && divination);
    const clericalPractice = clerical.advance;
    const divinationPractice = divination.advance;
    await castSpell(SPE_LIGHT);
    assert.equal(game.u.uen, 95, 'the Priest successfully casts the level-one spell');
    assert.equal(clerical.advance, clericalPractice + 1);
    assert.equal(divination.advance, divinationPractice);
});
//# sourceMappingURL=priest_light_school.test.js.map