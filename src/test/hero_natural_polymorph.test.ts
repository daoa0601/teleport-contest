import test from 'node:test';
import assert from 'node:assert/strict';
import { monsterAtPosition } from '../js/monster_location.js';

import { M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, NO_MINVENT, W_AMUL, W_ARMC } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { applyHeroNaturalPolymorph } from '../js/hero_natural_polymorph.js';
import { resetInputState } from '../js/input.js';
import { magicNegation } from '../js/magic_negation.js';
import { AD_POLY, AT_CLAW } from '../js/monster_attack_types.js';
import { cancelMonster } from '../js/monster_cancellation.js';
import { monsterHasMagicResistance } from '../js/anti_magic_trap.js';
import { AMULET_OF_LIFE_SAVING, CLOAK_OF_PROTECTION, CORPSE, DAGGER } from '../js/object_data.js';
import { plineWithContinuation } from '../js/display.js';
import { d, initRng, rn2, rnd } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import type { HeroNaturalEffectContext } from '../js/hero_natural_types.js';
import type { Monster } from '../js/monster_types.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function polymorphRoom(): string[] {
    freshObjectRoom({ flags: { verbose: true } });
    installPolymorphedHero('genetic engineer');
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        const screen = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(screen, /--More--/, 'a natural polymorph only needs message acknowledgement');
        messages.push(game._pending_message || screen);
        input.feed(' ');
    };
    return messages;
}

function effectContext(monster: Monster, damage = 2): HeroNaturalEffectContext {
    requirePlayingGame(game);
    return {
        state: game, publish: plineWithContinuation, random: rn2, rollDice: d, rollOne: rnd,
        attack: [AT_CLAW, AD_POLY, 1, 4], damage, specialDamage: 0,
        target: { x: monster.mx, y: monster.my },
    };
}

for (const guard of ['wielded weapon', 'lethal damage'] as const) {
    void test(`a natural polymorph with ${guard} leaves ordinary damage to its caller`, async () => {
        polymorphRoom();
        const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        orc.mhp = orc.mhpmax = 20;
        const species = orc.mnum;
        if (guard === 'wielded weapon') await setPrimaryWeapon(await addInventoryObject(DAGGER));
        const damage = guard === 'lethal damage' ? 20 : 2;
        initRng(1n);

        const result = await applyHeroNaturalPolymorph(orc, effectContext(orc, damage));

        assert.equal(result.done, false);
        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.equal(result.damage, damage);
        assert.equal(orc.mnum, species);
        assert.equal(orc.mhp, 20, 'the ordinary damage belongs to the caller');
        assert.equal(game._pending_message, '');
    });
}

void test('worn magic negation blocks transformation while preserving the ordinary hit', async () => {
    polymorphRoom();
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    orc.mhp = orc.mhpmax = 20;
    await equipMonsterObject(orc, await knownObject(CLOAK_OF_PROTECTION), W_ARMC);
    assert.equal(magicNegation(orc), 3);
    const species = orc.mnum;
    initRng(1n);

    const result = await applyHeroNaturalPolymorph(orc, effectContext(orc));

    assert.equal(result.done, false);
    assert.equal(result.damage, 2);
    assert.equal(orc.mnum, species);
    assert.equal(orc.mhp, 20);
    assert.match(game._pending_message, /The orc is not transformed\./);
});

for (const [species, antimagic] of [['baby gray dragon', true], ['arch-lich', false]] as const) {
    void test(`${antimagic ? 'antimagic' : 'general magic resistance'} completes a polymorph hit without subtracting its ordinary damage`, async () => {
        const messages = polymorphRoom();
        const target = await createMonsterAt(species, 11, 10, NO_MINVENT);
        target.mhp = target.mhpmax = 100;
        assert.equal(monsterHasMagicResistance(target), antimagic);
        const originalSpecies = target.mnum;
        initRng(1n);

        const result = await applyHeroNaturalPolymorph(target, effectContext(target));

        assert.equal(result.done, true);
        assert.equal(result.nativeResult, M_ATTK_HIT);
        assert.equal(result.damage, 2);
        assert.equal(target.mhp, 100);
        assert.equal(target.mnum, originalSpecies);
        assert.match([...messages, game._pending_message].join('\n'), /resists!/);
    });
}

void test('an unarmed genetic engineer transforms its target and teleports even when the hero cancellation flag is set', async () => {
    const messages = polymorphRoom();
    requirePlayingGame(game);
    game.u.mcan = true;
    const target = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    target.mhp = target.mhpmax = 100;
    const species = target.mnum;
    const heroX = game.u.ux, heroY = game.u.uy;
    const polymorphs = game.u.uconduct.polyselfs ?? 0;
    initRng(1n);

    const result = await applyHeroNaturalPolymorph(target, effectContext(target));

    assert.equal(result.done, true);
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(result.damage, 0);
    assert.notEqual(target.mnum, species);
    assert.equal(game.level.monsters.includes(target), true);
    assert.ok(target.mhp > 0);
    assert.ok(game.u.ux !== heroX || game.u.uy !== heroY, 'the genetic engineer teleports after transforming its target');
    assert.equal(game.u.uconduct.polyselfs ?? 0, polymorphs);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.match([...messages, game._pending_message].join('\n'), /undergoes a freakish metamorphosis and turns into/);
});

async function cancelledOrc(hitPoints: number, lifeSaving = false) {
    const messages = polymorphRoom();
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    orc.mhpmax = 100;
    orc.mhp = hitPoints;
    assert.equal((await cancelMonster(orc, { attackLevel: 12 })).cancelled, true);
    const amulet = lifeSaving
        ? await equipMonsterObject(orc, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL)
        : null;
    return { orc, amulet, messages };
}

void test('natural system shock removes half the maximum HP plus the hit and credits only a lethal shock', async () => {
    let shockSeed: number | null = null;
    for (let seed = 1; seed <= 150; seed++) {
        const { orc, messages } = await cancelledOrc(100);
        requirePlayingGame(game);
        const originalSpecies = orc.mnum;
        initRng(BigInt(seed));
        const result = await applyHeroNaturalPolymorph(orc, effectContext(orc));
        if (orc.mnum !== originalSpecies || orc.mhp !== 48) continue;
        shockSeed = seed;
        assert.equal(result.done, true);
        assert.equal(result.nativeResult, M_ATTK_HIT);
        assert.equal(result.damage, 0);
        assert.equal(game.u.uconduct.killer ?? 0, 0);
        assert.match([...messages, game._pending_message].join('\n'), /The orc shudders!/);
        break;
    }
    assert.ok(shockSeed !== null, 'a cancelled ordinary monster must be susceptible to system shock');

    for (const lifeSaving of [false, true]) {
        const { orc, amulet } = await cancelledOrc(20, lifeSaving);
        requirePlayingGame(game);
        initRng(BigInt(shockSeed));

        const result = await applyHeroNaturalPolymorph(orc, effectContext(orc));

        assert.equal(result.done, true);
        assert.equal(result.damage, 0);
        assert.equal(result.nativeResult, lifeSaving ? M_ATTK_HIT : M_ATTK_HIT | M_ATTK_DEF_DIED);
        assert.equal(monsterAtPosition(game.level, orc.mx, orc.my) === orc, lifeSaving);
        assert.equal(game.u.uconduct.killer, 1, 'the hero kill attempt owns conduct, including life saving');
        assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === CORPSE), false);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok(orc.mhp > 0);
        }
    }

    const messages = polymorphRoom();
    const ordinary = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    ordinary.mhp = ordinary.mhpmax = 100;
    initRng(BigInt(shockSeed));
    await applyHeroNaturalPolymorph(ordinary, effectContext(ordinary));
    assert.ok(ordinary.mhp > 0);
    assert.doesNotMatch([...messages, game._pending_message].join('\n'), /shudders/,
        'ordinary uncancelled monsters do not use wand system-shock rules');
});

void test('a failed form change still completes the polymorph hit without subtracting damage', async () => {
    let unchanged = false;
    for (let seed = 1; seed <= 20 && !unchanged; seed++) {
        const messages = polymorphRoom();
        const erinys = await createMonsterAt('erinys', 11, 10, NO_MINVENT);
        erinys.mhp = erinys.mhpmax = 100;
        const species = erinys.mnum;
        initRng(BigInt(seed));

        const result = await applyHeroNaturalPolymorph(erinys, effectContext(erinys));

        assert.equal(result.done, true);
        assert.equal(result.nativeResult, M_ATTK_HIT);
        assert.equal(result.damage, 2);
        assert.equal(erinys.mhp, 100);
        assert.equal(erinys.mnum, species);
        unchanged = [...messages, game._pending_message].join('\n').includes('Nothing happens.');
    }
    assert.ok(unchanged, 'an erinys rejects a new form after the magic resistance check is passed');
});
