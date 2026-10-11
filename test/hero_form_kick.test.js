import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, Upolyd, W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { kickWithMonsterForm } from '../js/hero_form_kick.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, IRON_SHOES, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { kickDirection } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function kickRoom(form, defender = 'hill giant', formHealth = 200) {
    const level = freshObjectRoom({
        left: 8, right: 15, top: 8, bottom: 12,
        flags: { verbose: true },
        hero: { uhitinc: 100, uhp: 200, uhpmax: 200 },
    });
    if (form)
        installPolymorphedHero(form, { hitPoints: formHealth });
    const monster = await createMonsterAt(defender, 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mhp = monster.mhpmax = 500;
    monster.mcanmove = 1;
    monster.minvis = 0;
    monster.mundetected = 0;
    return { level, monster };
}
async function kickEast(expected, seed = 1n) {
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 10 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    initRng(seed);
    await kickDirection('l');
    messages.push(game._pending_message);
    return messages.join('\n');
}
void test('a ki-rin kick command uses both kicks and omits its head butt and spell', async () => {
    const { monster } = await kickRoom('ki-rin');
    const messages = await kickEast(/hill giant/);
    assert.equal(messages.match(/You kick the hill giant/g)?.length, 2);
    assert.doesNotMatch(messages, /head butt|cast|reels|evading/);
    const damage = 500 - monster.mhp;
    assert.ok(damage >= 4 && damage <= 16, `Two 2d4 kicks dealt ${damage}`);
    assert.equal(monster.mx, 11);
    assert.equal(monster.my, 10);
    assert.equal(game.context.move, 1);
});
void test('a horse kick command uses its hoof damage and omits its bite', async () => {
    const { monster } = await kickRoom('horse');
    const messages = await kickEast(/hill giant/);
    assert.equal(messages.match(/You kick the hill giant/g)?.length, 1);
    assert.doesNotMatch(messages, /bite/);
    assert.ok(500 - monster.mhp >= 1 && 500 - monster.mhp <= 8);
});
void test('an abbot kick applies the form\'s stun attack', async () => {
    const { monster } = await kickRoom('abbot');
    const messages = await kickEast(/hill giant/);
    assert.equal(monster.mstun, 1);
    assert.match(messages, /staggers/);
    assert.ok(500 - monster.mhp >= 3 && 500 - monster.mhp <= 6);
});
void test('a shade stops a multi-kick sequence at the first harmless contact', async () => {
    const { monster } = await kickRoom('ki-rin', 'shade');
    const messages = await kickEast(/shade/);
    assert.equal(monster.mhp, 500);
    assert.equal(messages.match(/kick passes harmlessly through/g)?.length, 1);
    assert.doesNotMatch(messages, /You kick/);
});
void test('blessed boots hurt a shade without adding their enchantment to a natural kick', async () => {
    const { monster } = await kickRoom('monk', 'shade');
    const boots = await addInventoryObject(IRON_SHOES, { blessed: true, spe: 20 });
    wearHeroArmor(boots);
    const messages = await kickEast(/shade/);
    assert.match(messages, /You kick the shade/);
    assert.ok(500 - monster.mhp >= 1 && 500 - monster.mhp <= 4);
    assert.equal(boots.spe, 20);
});
void test('a missed natural kick still provokes the Oracle\'s passive and loses the form', async () => {
    const { monster } = await kickRoom('mountain centaur', 'Oracle', 1);
    game.u.uhitinc = -100;
    const messages = await kickEast(/Oracle|magic missiles|human|normal|return/);
    assert.equal(monster.mhp, 500);
    assert.equal(Upolyd(game.u), false);
    assert.match(messages, /magic missiles/);
    assert.equal(messages.match(/You miss the Oracle/g)?.length, 1, 'After losing the centaur body, the later slot is no longer a kick.');
});
void test('a floating eye can stop the second natural kick through paralysis', async () => {
    const { monster } = await kickRoom('mountain centaur', 'floating eye');
    const messages = await kickEast(/floating eye|frozen/, 1n);
    assert.ok((game._helplessTurns ?? 0) > 0);
    assert.match(messages, /You are frozen/);
    assert.equal(messages.match(/You kick the floating eye/g)?.length, 1);
    assert.ok(500 - monster.mhp >= 1 && 500 - monster.mhp <= 6);
});
void test('natural kick contact uses the boots to protect against petrification', async () => {
    const { monster } = await kickRoom('monk', 'cockatrice');
    const boots = await addInventoryObject(IRON_SHOES);
    wearHeroArmor(boots);
    const messages = await kickEast(/cockatrice/);
    assert.equal(!!game.program_state.gameover, false);
    assert.ok(Upolyd(game.u));
    assert.ok(monster.mhp < 500);
    assert.equal(game.uarmf, boots);
    assert.doesNotMatch(messages, /turn to stone/);
});
void test('life saving ends a lethal first kick before the second form kick', async () => {
    const { level, monster } = await kickRoom('mountain centaur');
    monster.mhp = 1;
    const amulet = await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const messages = await kickEast(/hill giant|medallion|But wait/);
    assert.ok(level.monsters.includes(monster));
    assert.equal(monster.mhp, monster.mhpmax);
    assert.equal(amulet.where, 'gone');
    assert.equal(messages.match(/You kick the hill giant/g)?.length, 1);
});
for (const form of [null, 'minotaur']) {
    void test(`${form ?? 'an ordinary hero'} leaves kicking to the ordinary owner without a form kick`, async () => {
        const { monster } = await kickRoom(form);
        const handled = await kickWithMonsterForm(monster, 11, 10);
        assert.equal(handled, false);
        assert.equal(monster.mhp, 500);
        assert.equal(game._pending_message, '');
    });
}
void test('a form without kick slots still reaches ordinary kicking through the command', async () => {
    const { monster } = await kickRoom('minotaur');
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('high boots'), { spe: 10 });
    wearHeroArmor(boots);
    const messages = await kickEast(/hill giant/);
    assert.equal(messages.match(/You kick the hill giant/g)?.length, 1);
    assert.doesNotMatch(messages, /head butt/);
    assert.ok(500 - monster.mhp >= 10, 'Ordinary kicking includes boot enchantment.');
});
//# sourceMappingURL=hero_form_kick.test.js.map