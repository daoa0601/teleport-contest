import test from 'node:test';
import assert from 'node:assert/strict';

import { game, resetGame } from '../js/gstate.js';
import { init_objects } from '../js/o_init.js';
import {
    CHAIN_MAIL, CROSSBOW, CROSSBOW_BOLT, DWARVISH_CLOAK,
    DWARVISH_IRON_HELM, DWARVISH_MATTOCK, DWARVISH_MITHRIL_COAT,
    DWARVISH_ROUNDSHIELD, DWARVISH_SHORT_SWORD, DWARVISH_SPEAR,
    ORCISH_ARROW, ORCISH_BOW, ORCISH_CHAIN_MAIL, ORCISH_CLOAK,
    ORCISH_DAGGER, ORCISH_HELM, ORCISH_RING_MAIL, ORCISH_SHIELD,
    ORCISH_SHORT_SWORD, ORCISH_SPEAR, TOUCHSTONE, URUK_HAI_SHIELD,
    WAN_WISHING,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { aligns, races, roles } from '../js/roles.js';
import { uInitInventoryAttrs, uInitMisc } from '../js/u_init.js';

const FOOD_CLASS = 7;

function start(roleKey, raceName, { explore = false, seed = 123n } = {}) {
    resetGame();
    initRng(seed);
    game.urole = roles.find(role => role.key === roleKey);
    game.urace = races.find(race => race.name === raceName);
    game.initAlignment = aligns.find(alignment => alignment.name === 'chaotic');
    game.flags = { explore };
    init_objects();
    uInitMisc(1);
    assert.equal(uInitInventoryAttrs(), true);
    return game;
}

test('Gnome Ranger substitutes and equips its source crossbow loadout', () => {
    const state = start('ranger', 'gnome');

    assert.ok(state.inventory.some(object => object.otyp === CROSSBOW));
    assert.ok(state.inventory.some(object => object.otyp === CROSSBOW_BOLT));
    assert.equal(state.uswapwep?.otyp, CROSSBOW);
    assert.equal(state.uquiver?.otyp, CROSSBOW_BOLT);
});

test('Dwarf startup installs every racial object knowledge after role knowledge', () => {
    const state = start('archeologist', 'dwarf');
    const dwarfKnowledge = [
        DWARVISH_SPEAR, DWARVISH_SHORT_SWORD, DWARVISH_MATTOCK,
        DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT, DWARVISH_CLOAK,
        DWARVISH_ROUNDSHIELD,
    ];

    for (const otyp of dwarfKnowledge)
        assert.ok(state._knownObjectTypes.has(otyp), String(otyp));
    assert.ok(
        state._objectDiscoveryOrder.indexOf(TOUCHSTONE)
            < state._objectDiscoveryOrder.indexOf(DWARVISH_SPEAR),
    );
});

test('Orc startup adds compensation and complete knowledge outside Rogue', () => {
    const state = start('ranger', 'orc');
    const orcKnowledge = [
        ORCISH_SHORT_SWORD, ORCISH_ARROW, ORCISH_BOW, ORCISH_SPEAR,
        ORCISH_DAGGER, ORCISH_CHAIN_MAIL, ORCISH_RING_MAIL, ORCISH_HELM,
        ORCISH_SHIELD, URUK_HAI_SHIELD, ORCISH_CLOAK,
    ];

    for (const otyp of orcKnowledge)
        assert.ok(state._knownObjectTypes.has(otyp), String(otyp));

    // Seed 123 gives the Ranger its substituted tripe stack followed by two
    // distinct Xtra_food objects.  Their position witnesses u_init_race()
    // running after the complete role template, not inside Rogue startup.
    assert.equal(state.inventory.at(-1).oclass, FOOD_CLASS);
    assert.equal(state.inventory.at(-2).oclass, FOOD_CLASS);
    assert.ok(state.inventory.at(-2).o_id > state.inventory.at(-3).o_id);

    const wizard = start('wizard', 'orc');
    assert.equal(
        wizard.inventory.some(object => object.oclass === FOOD_CLASS),
        false,
    );
});

test('discover-mode wishing inventory is role-general and follows race startup', () => {
    for (const role of roles) {
        const state = start(role.key, 'human', { explore: true });
        assert.ok(
            state.inventory.some(object => object.otyp === WAN_WISHING),
            role.key,
        );
    }

    const orc = start('ranger', 'orc', { explore: true });
    const wishing = orc.inventory.find(object => object.otyp === WAN_WISHING);
    const lastRaceObject = orc.inventory
        .filter(object => object.oclass === FOOD_CLASS).at(-1);
    assert.ok(wishing.o_id > lastRaceObject.o_id);
});

test('role money is initialized after startup and cannot leak across reruns', () => {
    const healer = start('healer', 'human', { explore: true });
    assert.ok(healer._goldCount >= 1001 && healer._goldCount <= 2000);
    assert.equal(healer._initialGoldCount, healer._goldCount);
    assert.ok(healer.inventory.some(object => object.otyp === WAN_WISHING));

    healer.urole = roles.find(role => role.key === 'ranger');
    healer.urace = races.find(race => race.name === 'human');
    healer.flags = { explore: false };
    assert.equal(uInitInventoryAttrs(), true);
    assert.equal(healer._goldCount, 0);
    assert.equal(healer._initialGoldCount, 0);
});

test('startup race constants retain the object-table identities used by C', () => {
    assert.deepEqual(
        [CHAIN_MAIL, ORCISH_CHAIN_MAIL, ORCISH_RING_MAIL],
        [128, 129, 133],
    );
});
