import type { RaceName } from '../js/roles.js';
import type { RoleKey } from '../js/roles.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import {
    CROSSBOW, CROSSBOW_BOLT, DWARVISH_CLOAK,
    DWARVISH_IRON_HELM, DWARVISH_MATTOCK, DWARVISH_MITHRIL_COAT,
    DWARVISH_ROUNDSHIELD, DWARVISH_SHORT_SWORD, DWARVISH_SPEAR,
    ORCISH_ARROW, ORCISH_BOW, ORCISH_CHAIN_MAIL, ORCISH_CLOAK,
    ORCISH_DAGGER, ORCISH_HELM, ORCISH_RING_MAIL, ORCISH_SHIELD,
    ORCISH_SHORT_SWORD, ORCISH_SPEAR, TOUCHSTONE, URUK_HAI_SHIELD,
    WAN_WISHING,
} from '../js/object_data.js';
import { races, roles } from '../js/roles.js';
import { uInitInventoryAttrs } from '../js/u_init.js';
import { completeHeroStartup } from './support/startup.js';

const FOOD_CLASS = 7;

async function start(roleKey: RoleKey, raceName: RaceName, { explore = false, seed = 123n } = {}) {
    return await completeHeroStartup({
        role: roleKey,
        race: raceName,
        flags: { explore },
        seed,
    });
}

void test('Gnome Ranger substitutes and equips its source crossbow loadout', async () => {
    const state = await start('ranger', 'gnome');

    assert.ok(state.inventory.some(object => object.otyp === CROSSBOW));
    assert.ok(state.inventory.some(object => object.otyp === CROSSBOW_BOLT));
    assert.equal(state.uswapwep?.otyp, CROSSBOW);
    assert.equal(state.uquiver?.otyp, CROSSBOW_BOLT);
});

void test('Dwarf startup installs every racial object knowledge after role knowledge', async () => {
    const state = await start('archeologist', 'dwarf');
    const dwarfKnowledge = [
        DWARVISH_SPEAR, DWARVISH_SHORT_SWORD, DWARVISH_MATTOCK,
        DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT, DWARVISH_CLOAK,
        DWARVISH_ROUNDSHIELD,
    ];

    for (const otyp of dwarfKnowledge)
        assert.ok(state._knownObjectTypes?.has(otyp), String(otyp));
    assert.ok(state._objectDiscoveryOrder != null, 'Expected state._objectDiscoveryOrder to be initialized');
    assert.ok(
        state._objectDiscoveryOrder.indexOf(TOUCHSTONE)
            < state._objectDiscoveryOrder.indexOf(DWARVISH_SPEAR),
    );
});

void test('Orc startup adds compensation and complete knowledge outside Rogue', async () => {
    const state = await start('ranger', 'orc');
    const orcKnowledge = [
        ORCISH_SHORT_SWORD, ORCISH_ARROW, ORCISH_BOW, ORCISH_SPEAR,
        ORCISH_DAGGER, ORCISH_CHAIN_MAIL, ORCISH_RING_MAIL, ORCISH_HELM,
        ORCISH_SHIELD, URUK_HAI_SHIELD, ORCISH_CLOAK,
    ];

    for (const otyp of orcKnowledge)
        assert.ok(state._knownObjectTypes?.has(otyp), String(otyp));

    // Seed 123 gives the Ranger its substituted tripe stack followed by two
    // distinct Xtra_food objects.  Their position witnesses u_init_race()
    // running after the complete role template, not inside Rogue startup.
    const last = state.inventory.at(-1), penultimate = state.inventory.at(-2), prior = state.inventory.at(-3);
    assert.ok(last && penultimate && prior);
    assert.equal(last.oclass, FOOD_CLASS);
    assert.equal(penultimate.oclass, FOOD_CLASS);
    assert.ok(penultimate.o_id > prior.o_id);

    const wizard = await start('wizard', 'orc');
    assert.equal(
        wizard.inventory.some(object => object.oclass === FOOD_CLASS),
        false,
    );
});

void test('discover-mode wishing inventory is role-general and follows race startup', async () => {
    for (const role of roles) {
        const state = await start(role.key, 'human', { explore: true });
        assert.ok(
            state.inventory.some(object => object.otyp === WAN_WISHING),
            role.key,
        );
    }

    const orc = await start('ranger', 'orc', { explore: true });
    const wishing = orc.inventory.find(object => object.otyp === WAN_WISHING);
    const lastRaceObject = orc.inventory
        .filter(object => object.oclass === FOOD_CLASS).at(-1);
    assert.ok(lastRaceObject != null, 'Expected lastRaceObject to be initialized');
    assert.ok(wishing != null, 'Expected wishing to be initialized');
    assert.ok(wishing.o_id > lastRaceObject.o_id);
});

void test('role money is initialized after startup and cannot leak across reruns', async () => {
    const healer = await start('healer', 'human', { explore: true });
    assert.ok(heroGoldAmount(healer) >= 1001 && heroGoldAmount(healer) <= 2000);
    assert.equal(healer._initialGoldCount, heroGoldAmount(healer));
    assert.ok(healer.inventory.some(object => object.otyp === WAN_WISHING));

    const ranger = roles.find(role => role.key === 'ranger');
    const human = races.find(race => race.name === 'human');
    assert.ok(ranger && human);
    healer.urole = ranger;
    healer.urace = human;
    healer.flags = { explore: false };
    assert.equal(await uInitInventoryAttrs(), true);
    assert.equal(heroGoldAmount(healer), 0);
    assert.equal(healer._initialGoldCount, 0);
});
