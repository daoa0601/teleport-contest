import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { CANDELABRUM_OF_INVOCATION, HELMET, OBJECT_SUBTYPE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

const POTION_CLASS = 8, SCROLL_CLASS = 9, WAND_CLASS = 11;

function statusText() {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}

for (const name of ['gnome queen', 'ogre king']) {
    void test(`${name} receives single melee weapons and launchers enchanted to at least +1`, async () => {
        let armedBirths = 0;
        for (let seed = 1n; seed <= 12n; seed++) {
            freshObjectRoom({ gameplaySeed: seed });
            const prince = await createMonsterAt(name, 12, 10, MM_NOGRP | MM_NOMSG);
            // Throwing stacks from m_initthrow() retain their raw enchantment.
            const weapons = (prince.minvent ?? []).filter(object => object.oclass === 2
                && object.quan === 1
                && (OBJECT_SUBTYPE[object.otyp] ?? 0) >= 0);

            if (weapons.length) armedBirths++;
            for (const weapon of weapons)
                assert.ok(weapon.spe >= 1, `${name} weapon ${weapon.otyp} has ${weapon.spe} enchantment at seed ${seed}`);
        }
        assert.ok(armedBirths > 0, `${name} must receive weapons in these births`);
    });
}

void test('lawful minions receive uncursed, sound, erosion-proof magical supplies', async () => {
    let suppliedBirths = 0;
    for (let seed = 1n; seed <= 12n; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        const archon = await createMonsterAt('Archon', 12, 10, MM_NOGRP | MM_NOMSG);
        // Archon weapons and shields bypass mongets(); magical supplies do not.
        const supplies = (archon.minvent ?? []).filter(object =>
            [POTION_CLASS, SCROLL_CLASS, WAND_CLASS].includes(object.oclass));

        if (supplies.length) suppliedBirths++;
        for (const object of supplies) {
            const item = `Archon supply ${object.otyp} at seed ${seed}`;
            assert.equal(object.cursed, false, `${item} must be uncursed`);
            assert.ok(object.spe >= 0, `${item} has negative charges: ${object.spe}`);
            assert.equal(object.oerodeproof, true, `${item} must be erosion-proof`);
        }
    }
    assert.ok(suppliedBirths > 0, 'Archons must receive magical supplies in these births');
});

void test('Vlad receives an empty, unlit, uncursed candelabrum', async () => {
    freshObjectRoom();
    const vlad = await createMonsterAt('Vlad the Impaler', 12, 10, MM_NOGRP | MM_NOMSG);
    const candelabrum = (vlad.minvent ?? []).find(object => object.otyp === CANDELABRUM_OF_INVOCATION);

    assert.ok(candelabrum);
    assert.equal(candelabrum.spe, 0);
    assert.equal(candelabrum.age, 0);
    assert.equal(candelabrum.lamplit, false);
    assert.equal(candelabrum.blessed, false);
    assert.equal(candelabrum.cursed, false);
});

void test('a dressing-completion pager retains AC until the delayed action finishes', async () => {
    const input = freshTurnRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const helmet = await addInventoryObject(HELMET, { spe: 0 });
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    goblin.movement = 12;
    setMonsterGivenName(goblin, 'Captain of the northern goblin patrol');
    let pages = 0;
    input.display = {
        async readKey() {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            if (message.includes('--More--')) {
                assert.match(message, /goblin patrol.*(?:hits|misses)/);
                assert.match(statusText(), /AC:10\b/);
                pages++;
                return 32;
            }
            return 27;
        },
    };
    input.feed(`W${helmet.invlet}`);

    await moveloop_core();
    await moveloop_core();

    assert.equal(pages, 1, 'Dressing completion should page the earlier attack');
    assert.match(statusText(), /AC:9\b/);
});
