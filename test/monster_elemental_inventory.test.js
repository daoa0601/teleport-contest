import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { OBJECT_NAMES, RIN_PROTECTION, SPE_BOOK_OF_THE_DEAD } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { destroyMonsterInventoryByElement, INVENTORY_DAMAGE } from '../js/zap.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [label, type, seed, survives] of [
    ['a charged ring survives without recharging', RIN_PROTECTION, 2n, true],
    ['a charged ring can still crumble', RIN_PROTECTION, 5n, false],
    ['an uncharged ring gets no extra protection', OBJECT_NAMES.indexOf('warning'), 2n, false],
]) {
    void test(`monster inventory electricity: ${label}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
        const charge = type === RIN_PROTECTION ? 3 : 0;
        const ring = await equipMonsterObject(monster, await knownObject(type, { spe: charge }), 0);
        initRng(seed);
        const damage = await destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.ELECTRIC, 30);
        assert.equal(monster.minvent.includes(ring), survives);
        assert.equal(ring.where, survives ? 'minvent' : 'gone');
        assert.equal(ring.spe, charge);
        assert.equal(damage, 0, 'crumbling rings do not hurt their carrier');
    });
}
for (const perception of ['sighted', 'hallucinating', 'detected invisible']) {
    void test(`a distant monster's Book survives fire when the hero is ${perception}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 15, 10, MM_NOGRP | NO_MINVENT);
        const book = await equipMonsterObject(monster, await knownObject(SPE_BOOK_OF_THE_DEAD, {
            dknown: false, known: false, typeKnown: false,
        }), 0);
        if (perception === 'hallucinating')
            await makeHallucinated(20, { talk: false });
        if (perception === 'detected invisible') {
            monster.minvis = 1;
            grantIntrinsicProperty('detectMonsters', 'potion');
        }
        const messages = [];
        initRng(2n);
        const damage = await destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.FIRE, 30, {
            visible: canSeeMonster(monster),
            publish: async (message) => messages.push(message),
        });
        assert.equal(book.where, 'minvent');
        assert.ok(monster.minvent.includes(book));
        assert.equal(damage, 0);
        assert.equal(book.dknown, false, 'a distant glow does not reveal the book appearance');
        if (perception === 'detected invisible')
            assert.deepEqual(messages, []);
        else if (perception === 'hallucinating') {
            assert.match(messages.join(' '), /^The spellbook glows a strange .+, but remains intact\.$/);
            assert.doesNotMatch(messages.join(' '), /a strange dark red/);
        }
        else {
            assert.deepEqual(messages, ['The spellbook glows a strange dark red, but remains intact.']);
        }
    });
}
//# sourceMappingURL=monster_elemental_inventory.test.js.map