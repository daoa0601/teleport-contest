import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NEED_WEAPON, NO_MINVENT, W_WEP } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { DAGGER, MUMMY_WRAPPING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const scenario of [
    { name: 'a sighted jackal hits a visible hero', species: 'jackal',
        invisible: false, blind: false, margin: 1, hit: true },
    { name: 'a jackal misses an invisible hero it has located', species: 'jackal',
        invisible: true, blind: false, margin: 1, hit: false },
    { name: 'a blind jackal misses a visible hero it has located', species: 'jackal',
        invisible: false, blind: true, margin: 1, hit: false },
    { name: 'blindness and invisibility apply one accuracy penalty together', species: 'jackal',
        invisible: true, blind: true, margin: 3, hit: true },
    { name: 'a stalker sees an invisible hero without losing accuracy', species: 'stalker',
        invisible: true, blind: false, margin: 1, hit: true },
    { name: 'a blind stalker loses accuracy despite seeing invisible', species: 'stalker',
        invisible: true, blind: true, margin: 1, hit: false },
]) {
    void test(scenario.name, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100, uac: 0 } });
        requirePlayingGame(game);
        if (scenario.invisible)
            grantIntrinsicProperty('invisible', 'outside');
        const monster = await createMonsterAt(scenario.species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        monster.mcansee = scenario.blind ? 0 : 1;
        installPagerInput(resetInputState(), { expected: /jackal|stalker|It |Something/, limit: 4 });
        const attackRoll = 10 + monster.m_lev - scenario.margin;
        await performMonsterHeroAttack(monster, game, {
            rollOne: () => attackRoll, rollDice: count => count,
        });
        assert.equal(game.u.uhp < 100, scenario.hit, `${scenario.name}: the hero has ${game.u.uhp} of 100 health`);
    });
}
void test('mummy wrapping prevents hidden invisibility from reducing monster accuracy', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('invisible', 'outside');
    wearHeroArmor(await addInventoryObject(MUMMY_WRAPPING));
    game.u.uac = 0;
    const jackal = await createMonsterAt('jackal', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    jackal.mux = game.u.ux;
    jackal.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /jackal/, limit: 4 });
    await performMonsterHeroAttack(jackal, game, {
        rollOne: () => 10 + jackal.m_lev - 1, rollDice: count => count,
    });
    assert.ok(game.u.uhp < 100, 'the visible, wrapped hero receives the otherwise accurate bite');
});
for (const species of ['goblin', 'ettin']) {
    void test(`a ${species} readies its dagger before trying the wrong hero location`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        grantIntrinsicProperty('invisible', 'outside');
        const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.mux = 10;
        monster.muy = 9;
        monster.weaponCheck = NEED_WEAPON;
        const dagger = await knownObject(DAGGER, { spe: 0 });
        await addObjectToMonsterInventory(monster, dagger, game);
        const messages = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /goblin|ettin/, limit: 4 });
        input.beforeRead = () => { messages.push(game._pending_message); };
        await performMonsterHeroAttack(monster, game, { random: () => 0 });
        await flushPendingTopline();
        assert.equal(monster.mw, dagger, 'the monster must wield before testing the apparent target');
        assert.equal(dagger.owornmask, W_WEP);
        assert.equal(game.u.uhp, 100);
        const text = messages.join('\n');
        assert.match(text, /wields.*dagger/);
        if (species === 'goblin') {
            assert.doesNotMatch(text, /wildly|beside you|thin air/, 'wielding consumes the goblin\'s only attack');
        }
        else {
            assert.match(text, /wildly.*misses|beside you|thin air/, 'the ettin can still use its second weapon attack after wielding');
        }
    });
}
//# sourceMappingURL=monster_miss_dispatch.test.js.map