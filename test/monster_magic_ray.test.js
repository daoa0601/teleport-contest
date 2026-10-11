import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { M_SEEN_MAGR, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { addInventoryItem } from '../js/u_init.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
const MAGIC_PROSE = /zaps you|hits you|bounces?|curses|medallion|You die|But wait|feel much better|killed|Goodbye|points|Welcome|experience/i;
function magicRoom(role = 'barbarian') {
    const input = freshTurnRoom({ role, left: 1, right: 18, top: 1, bottom: 18 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
    game.u.uhp = game.u.uhpmax = 500;
    game.flags.disclose = '-i -a -v -c -o';
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    installPagerInput(input, { expected: MAGIC_PROSE, limit: 32 });
    return { input, messages };
}
async function waitOneTurn(input, { heroDies = false } = {}) {
    input.feed('m.');
    const takeTurn = async () => {
        await moveloop_core();
        await moveloop_core();
        await flushPendingTopline();
    };
    if (heroDies)
        await takeTurn();
    else
        await finishAtCommandInput(input, takeTurn, /^(?:$)|zaps|hits|bounce|curses|medallion|die|killed|Goodbye|experience/i);
}
for (const [species, castingName, rayName, seed] of [
    ['Angel', 'magic missile', 'magic missile', 2n],
    ['Asmodeus', 'bolt of cold', 'cone of cold', 3n],
]) {
    void test(`${species} casts a damaging ray from beyond melee range`, async () => {
        const { input, messages } = magicRoom();
        requirePlayingGame(game);
        const caster = await createMonsterAt(species, 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        // makemon.c makes a bribe-demanding prince peaceful and invisible
        // even under MM_ANGRY; this one has refused the hero, who can see
        // invisible.
        caster.mpeaceful = 0;
        game.u.seeInvisible = true;
        caster.msleeping = 0;
        caster.movement = 12;
        initRng(seed);
        await waitOneTurn(input);
        const prose = messages.join('\n');
        assert.ok(prose.includes(`zaps you with a ${castingName}!`), prose);
        assert.ok(prose.includes(`The ${rayName} hits you!`), prose);
        assert.ok(game.u.uhp < 500);
    });
}
void test('a failed casting opportunity is not presented as a melee miss', async () => {
    const { input, messages } = magicRoom();
    requirePlayingGame(game);
    const angel = await createMonsterAt('Angel', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    angel.msleeping = 0;
    angel.movement = 12;
    initRng(1n);
    await waitOneTurn(input);
    assert.doesNotMatch(messages.join('\n'), /misses|zaps you/);
    assert.equal(game.u.uhp, 500);
});
void test('a cancelled Angel curses instead of casting a ray', async () => {
    const { input, messages } = magicRoom();
    requirePlayingGame(game);
    const angel = await createMonsterAt('Angel', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    angel.msleeping = 0;
    angel.mcan = 1;
    angel.movement = 12;
    initRng(2n);
    await waitOneTurn(input);
    assert.match(messages.join('\n'), /points at you, then curses/);
    assert.doesNotMatch(messages.join('\n'), /zaps you/);
    assert.equal(game.u.uhp, 500);
});
void test('an Angel remembers visible magic resistance and curses on its next spell', async () => {
    const { input, messages } = magicRoom();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(OBJECT_NAMES.indexOf('cloak of magic resistance')));
    findArmorClass();
    const angel = await createMonsterAt('Angel', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    angel.msleeping = 0;
    angel.movement = 12;
    initRng(2n);
    await waitOneTurn(input);
    assert.match(messages.join('\n'), /The missiles bounce off!/);
    assert.ok((angel.seen_resistance ?? 0) & M_SEEN_MAGR);
    assert.equal(game.u.uhp, 500);
    messages.length = 0;
    await waitOneTurn(input);
    assert.match(messages.join('\n'), /points at you, then curses/);
    assert.doesNotMatch(messages.join('\n'), /zaps you/);
});
for (const lifeSaving of [false, true]) {
    void test(`fatal monster magic ${lifeSaving ? 'continues past a life-saved hero' : 'stops before the next target'}`, async () => {
        const { input } = magicRoom();
        requirePlayingGame(game);
        game.u.uhp = 1;
        let amulet;
        if (lifeSaving) {
            amulet = await addInventoryObject(OBJECT_NAMES.indexOf('amulet of life saving'));
            await wearHeroAccessory(amulet, 'uamul');
        }
        const angel = await createMonsterAt('Angel', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        angel.msleeping = 0;
        angel.movement = 12;
        const target = await createMonsterAt('goblin', 9, 10, NO_MINVENT);
        target.mhp = 1;
        target.mcanmove = 0;
        target.mfrozen = 20;
        target.mpeaceful = 1;
        initRng(2n);
        await waitOneTurn(input, { heroDies: !lifeSaving });
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        if (lifeSaving) {
            assert.ok(game.u.uhp > 0);
            assert.ok(amulet, 'The test supplied a life-saving amulet');
            assert.ok(!game.inventory.includes(amulet));
            assert.ok(!game.level.monsters.includes(target));
            assert.equal(game.u.uconduct.killer || 0, 0);
            assert.equal(game.u.uexp || 0, 0);
        }
        else {
            assert.equal(target.mhp, 1);
        }
    });
}
void test('a carried Orb of Detection keeps protection when temporary half spell damage expires', async () => {
    const losses = [];
    for (const protection of ['orb', 'orb with expiring timeout']) {
        const { input } = magicRoom('archeologist');
        requirePlayingGame(game);
        await addInventoryItem(await artifactObject('The Orb of Detection'));
        if (protection === 'orb with expiring timeout') {
            game.u.halfSpellDamage = true;
            game.u.halfSpellDamageTurns = 1;
        }
        const angel = await createMonsterAt('Asmodeus', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        angel.mpeaceful = 0; // makemon.c births bribing princes peaceful
        angel.msleeping = 0;
        angel.movement = 12;
        initRng(3n);
        await waitOneTurn(input);
        losses.push(500 - game.u.uhp);
    }
    assert.ok(losses[0] !== undefined && losses[0] > 0);
    assert.equal(losses[1], losses[0]);
});
void test('hallucinatory ray names do not change the real magic damage into lightning', async () => {
    const { input, messages } = magicRoom();
    requirePlayingGame(game);
    game.u.hallucinationTurns = 30;
    const angel = await createMonsterAt('Angel', 14, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    angel.msleeping = 0;
    angel.movement = 12;
    initRng(2n);
    await waitOneTurn(input);
    const prose = messages.join('\n');
    assert.match(prose, /zaps you with a blast of /);
    assert.match(prose, /The blast of [^!]+ hits you!/);
    assert.ok(game.u.uhp < 500);
    assert.equal(game.u.blindTurns || 0, 0);
});
//# sourceMappingURL=monster_magic_ray.test.js.map