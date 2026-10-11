import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT, W_AMUL } from '../js/const.js';
import { canSeeMonster, glyphAt, pline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    checkMonsterWandBackfire, consumeMonsterItem, presentMonsterHornUse,
    presentMonsterScrollRead, presentMonsterWandUse,
} from '../js/monster_item_use.js';
import { AMULET_OF_LIFE_SAVING, FIRE_HORN, POT_HEALING, SCR_EARTH, WAN_FIRE } from '../js/object_data.js';
import type { KnownObjectOverrides } from './support/game-objects.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function itemRoom(type: number, properties: KnownObjectOverrides = {}) {
    const level = freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const item = await addObjectToMonsterInventory(monster, await knownObject(type, {
        spe: 3, typeKnown: false, ...properties,
    }), game);
    assert.ok(item);
    installPagerInput(resetInputState(), {
        expected: /wand|zaps|explodes|medallion|looks much better|killed|stop searching/,
        limit: 8,
    });
    return { state: game, level, monster, item };
}

void test('a visible wand use observes its appearance, spends a charge, and interrupts searching', async () => {
    const { state, monster, item } = await itemRoom(WAN_FIRE, { dknown: false });
    pushKeys('12s');
    await rhack(0);
    assert.ok(state._occupation);
    const messages: string[] = [];

    await presentMonsterWandUse(monster, item, { state, publish: message => { messages.push(message); } });

    assert.equal(item.spe, 2);
    assert.equal(item.dknown, true);
    assert.equal(item.where, 'minvent');
    assert.equal(monster.minvent?.[0], item);
    assert.equal(state._occupation, null);
    assert.match(messages[0] ?? '', /^The orc zaps a .+ wand!$/);
    assert.ok(messages.includes('You stop searching.'));
    assert.equal(state._knownObjectTypes?.has(WAN_FIRE) ?? false, false);
});

void test('wand charges and hero occupation wait for the visible zap message to resume', async () => {
    const { state, monster, item } = await itemRoom(WAN_FIRE);
    pushKeys('12s');
    await rhack(0);
    const occupation = state._occupation;
    assert.ok(occupation);
    const input = resetInputState();
    await pline('The corridor stretches away into the cold and silent darkness.');
    const use = presentMonsterWandUse(monster, item, { state });
    await input.waitUntilBlocked();
    try {
        assert.match(requireGameDisplay(state).grid[0]?.map(cell => cell.ch).join('') ?? '', /--More--/);
        assert.equal(item.spe, 3);
        assert.equal(state._occupation, occupation);
        assert.equal(monster.minvent?.[0], item);
    } finally {
        installPagerInput(input, { expected: /wand|zaps|stop searching/, limit: 3 });
        input.feed(' ');
        await use;
    }
    assert.equal(item.spe, 2);
    assert.equal(state._occupation, null);
});

void test('a self-zapped wand displays its known charges before spending one and leaves searching alone', async () => {
    const { state, monster, item } = await itemRoom(WAN_FIRE, { known: true, recharged: 2 });
    pushKeys('12s');
    await rhack(0);
    const occupation = state._occupation;
    const messages: string[] = [];

    await presentMonsterWandUse(monster, item, {
        state, self: true, publish: message => { messages.push(message); },
    });

    assert.equal(item.spe, 2);
    assert.equal(state._occupation, occupation);
    assert.match(messages[0] ?? '', /zaps (?:himself|herself|itself) with .*\(2:3\)!$/);
});

for (const deaf of [false, true]) {
    for (const type of [WAN_FIRE, FIRE_HORN]) {
        void test(`unseen ${type === WAN_FIRE ? 'wand' : 'horn'} use loses charge knowledge ${deaf ? 'without sound for a deaf hero' : 'with a nearby sound'}`, async () => {
            const { state, monster, item } = await itemRoom(type, {
                known: true, dknown: true, bknown: true, rknown: true,
            });
            monster.minvis = true;
            state.u.deafTurns = deaf ? 10 : 0;
            assert.equal(canSeeMonster(monster), false);
            const messages: string[] = [];

            const present = type === WAN_FIRE ? presentMonsterWandUse : presentMonsterHornUse;
            await present(monster, item, { state, publish: message => { messages.push(message); } });

            assert.equal(item.spe, 2);
            assert.equal(item.known, false);
            assert.equal(item.dknown, false);
            assert.equal(item.bknown, false);
            assert.equal(item.rknown, false);
            if (deaf) assert.equal(messages.length, 0);
            else assert.equal(messages[0], type === WAN_FIRE
                ? 'You hear a nearby zap.' : 'You hear a horn being played nearby.');
        });
    }
}

void test('a visible horn identifies its type after describing its unrecognized appearance', async () => {
    const { state, monster, item } = await itemRoom(FIRE_HORN, { known: false, dknown: false });
    const messages: string[] = [];

    await presentMonsterHornUse(monster, item, { state, publish: message => { messages.push(message); } });

    assert.equal(item.spe, 2);
    assert.equal(item.dknown, true);
    assert.equal(state._knownObjectTypes?.has(FIRE_HORN), true);
    assert.match(messages[0] ?? '', /^The orc plays a horn directed at you!$/);
});

void test('a visible reader describes one scroll without consuming its stack', async () => {
    const { state, monster, item } = await itemRoom(SCR_EARTH, { quan: 3, blessed: true, bknown: true });
    const messages: string[] = [];

    await presentMonsterScrollRead(monster, item, { state, publish: message => { messages.push(message); } });

    assert.equal(item.quan, 3);
    assert.equal(item.where, 'minvent');
    assert.equal(item.dknown, true);
    assert.match(messages[0] ?? '', /^The orc reads a blessed scroll labeled .+!$/);
    assert.doesNotMatch(messages[0] ?? '', /3 |scrolls/);
});

void test('an unseen confused reader reveals its label and remembered location through speech', async () => {
    const { state, monster, item } = await itemRoom(SCR_EARTH, { dknown: false, known: false });
    monster.minvis = true;
    monster.meverseen = true;
    monster.mconf = true;
    assert.ok(state.objectDescriptions);
    state.objectDescriptions[SCR_EARTH] = 'EARTH WORDS';
    const messages: string[] = [];

    await presentMonsterScrollRead(monster, item, { state, publish: message => { messages.push(message); } });

    assert.equal(item.dknown, true);
    assert.equal(item.where, 'minvent');
    assert.equal(glyphAt(monster.mx, monster.my)?.kind, 'invisible');
    assert.match(messages[0] ?? '', /^You hear an orc attempting to incant EARTH WORDS\.$/);
    assert.match(messages[1] ?? '', /^Being confused, (?:he|she|it) mispronounces the magic words\.\.\.$/);
});

void test('a deaf hero learns nothing from an unseen scroll reading', async () => {
    const { state, monster, item } = await itemRoom(SCR_EARTH, { dknown: false });
    monster.minvis = true;
    state.u.deafTurns = 10;
    const messages: string[] = [];

    await presentMonsterScrollRead(monster, item, { state, publish: message => { messages.push(message); } });

    assert.equal(item.dknown, false);
    assert.equal(messages.length, 0);
    assert.notEqual(glyphAt(monster.mx, monster.my)?.kind, 'invisible');
});

void test('using one scroll keeps the remaining carried stack and recalculates its weight', async () => {
    const { state, monster, item } = await itemRoom(SCR_EARTH, { quan: 3 });
    const weight = item.owt;

    await consumeMonsterItem(monster, item, state);

    assert.equal(item.quan, 2);
    assert.equal(item.quantity, 2);
    assert.equal(item.owt * 3, weight * 2);
    assert.equal(monster.minvent?.[0], item);
    assert.equal(item.ocarry, monster);
});

void test('a surviving cursed-wand explosion consumes the real wand and resumes ordinary combat', async () => {
    const { state, monster, item } = await itemRoom(WAN_FIRE, { cursed: true, spe: 3 });
    monster.mhp = monster.mhpmax = 100;
    const messages: string[] = [];

    const result = await checkMonsterWandBackfire(monster, item, {
        state, random: () => 0, rollDice: count => count,
        publish: message => { messages.push(message); },
    });

    assert.equal(result.exploded, true);
    assert.equal(result.nativeResult, 0);
    assert.equal(result.monsterDied, false);
    assert.equal(monster.mhp, 95);
    assert.equal(item.where, 'gone');
    assert.equal(monster.minvent?.includes(item), false);
    assert.equal(item.ocarry, null);
    assert.match(messages[0] ?? '', /zaps a .+ wand, which suddenly explodes!$/);
});

void test('backfire consumption and damage wait for the visible explosion message', async () => {
    const { state, monster, item } = await itemRoom(WAN_FIRE, { cursed: true, spe: 3 });
    monster.mhp = monster.mhpmax = 100;
    const input = resetInputState();
    await pline('The corridor stretches away into the cold and silent darkness.');
    const blast = checkMonsterWandBackfire(monster, item, { state, random: () => 0, rollDice: count => count });
    await input.waitUntilBlocked();
    try {
        assert.equal(monster.mhp, 100);
        assert.equal(item.where, 'minvent');
        assert.equal(monster.minvent?.[0], item);
    } finally {
        input.feed(' ');
        await blast;
    }
    assert.equal(monster.mhp, 95);
    assert.equal(item.where, 'gone');
});

void test('a deaf hero sees a wand explosion on a visible square even when its user is invisible', async () => {
    const { state, monster, item } = await itemRoom(WAN_FIRE, { cursed: true });
    monster.minvis = true;
    monster.mhp = monster.mhpmax = 100;
    state.u.deafTurns = 10;
    assert.equal(canSeeMonster(monster), false);
    const messages: string[] = [];

    const result = await checkMonsterWandBackfire(monster, item, {
        state, random: () => 0, rollDice: count => count,
        publish: message => { messages.push(message); },
    });

    assert.equal(result.exploded, true);
    assert.match(messages[0] ?? '', /^It zaps .+, which suddenly explodes!$/);
    assert.doesNotMatch(messages.join('\n'), /hear/);
});

void test('a cursed wand survives a backfire saving roll without spending its charge', async () => {
    const { state, monster, item } = await itemRoom(WAN_FIRE, { cursed: true });
    const health = monster.mhp;

    const result = await checkMonsterWandBackfire(monster, item, { state, random: () => 1 });

    assert.equal(result.exploded, false);
    assert.equal(result.nativeResult, 0);
    assert.equal(item.spe, 3);
    assert.equal(item.where, 'minvent');
    assert.equal(monster.mhp, health);
});

void test('a lethal wand backfire resolves ordinary monster death without hero kill credit', async () => {
    const { state, level, monster, item } = await itemRoom(WAN_FIRE, { cursed: true });
    monster.mhp = 1;
    const kills = state.u.uconduct.killer ?? 0;

    const result = await checkMonsterWandBackfire(monster, item, {
        state, random: () => 0, rollDice: count => count, publish: () => {},
    });

    assert.equal(result.nativeResult, 1);
    assert.equal(result.monsterDied, true);
    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.includes(monster), false);
    assert.equal(item.where, 'gone');
    assert.equal(state.u.uconduct.killer ?? 0, kills);
});

void test('life saving preserves native backfire result one while keeping the monster alive', async () => {
    const { state, level, monster, item } = await itemRoom(WAN_FIRE, { cursed: true });
    const amulet = await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    monster.mhp = 1;
    monster.mhpmax = 30;

    const result = await checkMonsterWandBackfire(monster, item, {
        state, random: () => 0, rollDice: count => count, publish: () => {},
    });

    assert.equal(result.exploded, true);
    assert.equal(result.nativeResult, 1);
    assert.equal(result.monsterDied, false);
    assert.equal(level.monsters.includes(monster), true);
    assert.equal(monster.mhp, monster.mhpmax);
    assert.equal(item.where, 'gone');
    assert.equal(amulet.where, 'gone');
});

for (const type of [POT_HEALING, FIRE_HORN]) {
    void test(`cursed ${type === FIRE_HORN ? 'horns' : 'potions'} do not use the wand backfire rule`, async () => {
        const { state, monster, item } = await itemRoom(type, { cursed: true });
        const health = monster.mhp;

        const result = await checkMonsterWandBackfire(monster, item, { state, random: () => 0 });

        assert.equal(result.exploded, false);
        assert.equal(item.where, 'minvent');
        assert.equal(item.spe, 3);
        assert.equal(monster.mhp, health);
    });
}
