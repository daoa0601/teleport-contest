import assert from 'node:assert/strict';
import test from 'node:test';
import { BEAR_TRAP, HWALL, PIT, ROOM, TER_TRP, TT_PIT, TT_WEB, WEB, W_WEP } from '../js/const.js';
import { digActualHole } from '../js/digging_terrain.js';
import { map_trap } from '../js/display.js';
import { game } from '../js/gstate.js';
import { continueHeroDigging, ensureDiggingContext } from '../js/hero_digging.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { resetInputState } from '../js/input.js';
import { browseDetectionMap } from '../js/magic_map_display.js';
import { LARGE_BOX, PICK_AXE, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { repairShopDamage } from '../js/shop_damage.js';
import { floatHeroUp } from '../js/terrain_movement.js';
import { openHoldingTrap } from '../js/trap_magic.js';
import { untrap } from '../js/untrap.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
function assertImaginaryNames(names, realName) {
    assert.ok([...names].some(name => name !== realName), `Hallucination must sometimes change ${realName}; observed: ${[...names].join(', ')}`);
}
for (const seen of [false, true]) {
    void test(`digging destroys a ${seen ? 'known' : 'hidden'} web under a hallucinated name`, async () => {
        const names = new Set();
        for (let seed = 1; seed <= 8; seed++) {
            const level = freshPlayableRoom({ hero: { hallucinationTurns: 30 } });
            level.flags.hardfloor = true;
            const trap = addTrap(level, WEB, 10, 10, { tseen: seen });
            const pick = await addInventoryObject(PICK_AXE, { owornmask: W_WEP });
            game.uwep = game.u.uwep = pick;
            const digging = ensureDiggingContext(game);
            digging.pos = { x: 10, y: 10 };
            assert.ok(game.u.uz);
            digging.level = { ...game.u.uz };
            digging.down = true;
            digging.effort = 60;
            initRng(seed);
            await continueHeroDigging();
            assert.equal(level.traps.includes(trap), false);
            const match = /^You destroy (?:the|an?) (.+) with /.exec(game._lastPlineMessage ?? '');
            assert.ok(match?.[1], `Expected trap destruction: ${game._lastPlineMessage}`);
            names.add(match[1]);
        }
        assertImaginaryNames(names, 'web');
    });
}
void test('hurtling over a known trap uses a hallucinated name', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshPlayableRoom({ hero: { hallucinationTurns: 30 } });
        addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
        initRng(seed);
        await hurtleHero(1, 0, 1);
        assert.equal(game.u.ux, 11);
        const match = /^You pass right over (?:an?|the) (.+)\.$/.exec(game._lastPlineMessage ?? '');
        assert.ok(match?.[1], `Expected passing a trap: ${game._lastPlineMessage}`);
        names.add(match[1]);
    }
    assertImaginaryNames(names, 'bear trap');
});
void test('the trap detection cursor describes hallucinated traps', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshPlayableRoom({ flags: { tips: false, verbose: false } });
        const trap = addTrap(level, WEB, 11, 10, { tseen: true });
        map_trap(trap, true);
        game.u.hallucinationTurns = 30;
        initRng(seed);
        const input = resetInputState();
        input.feed('l');
        let reads = 0;
        input.display = { async readKey() {
                assert.equal(++reads, 1, 'accepting the trap cursor must finish browsing');
                names.add(game._pending_message);
                return '.'.charCodeAt(0);
            } };
        await browseDetectionMap(TER_TRP, 'a trap');
        assert.equal(reads, 1);
    }
    assertImaginaryNames(names, 'web');
});
void test('digging a new pit keeps the real trap name while hallucinating', async () => {
    const level = freshPlayableRoom({ hero: { hallucinationTurns: 30 } });
    await digActualHole(11, 10, 'you', PIT);
    assert.equal(game._lastPlineMessage, 'You dig an adjacent pit.');
    assert.equal(level.traps.find(trap => trap.tx === 11 && trap.ty === 10)?.ttyp, PIT);
});
void test('floating out of a pit uses a hallucinated name', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        freshPlayableRoom({ hero: { utrap: 3, utraptype: TT_PIT, hallucinationTurns: 30 } });
        initRng(seed);
        await floatHeroUp();
        assert.equal(game.u.utrap, 0);
        const match = /^You float up, out of the (.+)!$/.exec(game._lastPlineMessage ?? '');
        assert.ok(match?.[1], `Expected pit escape: ${game._lastPlineMessage}`);
        names.add(match[1]);
    }
    assertImaginaryNames(names, 'pit');
});
void test('floating while caught in a web follows the native leg-still-stuck branch', async () => {
    freshPlayableRoom({ hero: { utrap: 3, utraptype: TT_WEB, hallucinationTurns: 30 } });
    await floatHeroUp();
    assert.match(game._lastPlineMessage ?? '', /^You float up slightly, but your .+ is still stuck\.$/);
    assert.equal(game.u.utrap, 3);
});
for (const seen of [false, true]) {
    void test(`opening a monster's ${seen ? 'known' : 'hidden'} holding trap uses an imaginary name`, async () => {
        const names = new Set();
        for (let seed = 1; seed <= 8; seed++) {
            const level = freshPlayableRoom({ hero: { hallucinationTurns: 30 } });
            const monster = await createMonsterAt('gnome', 13, 10);
            monster.mtrapped = 1;
            addTrap(level, WEB, 13, 10, { tseen: seen });
            initRng(seed);
            const result = await openHoldingTrap(monster);
            assert.equal(result.changed, true);
            assert.equal(monster.mtrapped, 0);
            const match = / released from (?:the|an?) (.+)\.$/.exec(game._lastPlineMessage ?? '');
            assert.ok(match?.[1], `Expected trap release: ${game._lastPlineMessage}`);
            names.add(match[1]);
        }
        assertImaginaryNames(names, 'web');
    });
}
void test('opening the hero holding trap keeps the real name while hallucinating', async () => {
    const level = freshPlayableRoom({ hero: { utrap: 3, utraptype: TT_WEB, hallucinationTurns: 30 } });
    addTrap(level, WEB, 10, 10, { tseen: true });
    await openHoldingTrap(game.u);
    assert.equal(game._lastPlineMessage, 'You are released from the web.');
    assert.equal(game.u.utrap, 0);
});
void test('unreachable floor traps are described through hallucination', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshPlayableRoom({ hero: { levitating: true, hallucinationTurns: 30 } });
        addTrap(level, WEB, 11, 10, { tseen: true });
        const messages = [];
        initRng(seed);
        await untrap({ chooseDirection: () => ({ dx: 1, dy: 0, dz: 0, key: 'l' }),
            publish: message => { messages.push(message); } });
        const match = /^There is (?:an?) (.+) there but you can't reach it\.$/.exec(messages[0] ?? '');
        assert.ok(match?.[1], `Expected unreachable trap: ${messages.join(' / ')}`);
        names.add(match[1]);
    }
    assertImaginaryNames(names, 'web');
});
void test('failed disarming names the difficult trap through hallucination', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshPlayableRoom({ hero: { hallucinationTurns: 30 } });
        addTrap(level, WEB, 11, 10, { tseen: true });
        const messages = [];
        initRng(seed);
        await untrap({ chooseDirection: () => ({ dx: 1, dy: 0, dz: 0, key: 'l' }),
            random: () => 1, luckRandom: () => 0,
            publish: message => { messages.push(message); } });
        const match = /^That (.+) is difficult to remove\.$/.exec(messages[0] ?? '');
        assert.ok(match?.[1], `Expected difficult trap: ${messages.join(' / ')}`);
        names.add(match[1]);
    }
    assertImaginaryNames(names, 'web');
});
void test('a container question reuses the same hallucinated floor trap name', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshPlayableRoom({ hero: { hallucinationTurns: 30 } });
        addTrap(level, WEB, 10, 10, { tseen: true });
        await floorObject(LARGE_BOX, 10, 10);
        initRng(seed);
        let question = '';
        await untrap({ chooseDirection: () => ({ dx: 0, dy: 0, dz: 0, key: '.' }),
            ask: async (prompt) => { question = prompt; return 'q'; } });
        const match = /^There is a container and (?:an?) (.+) here\.  Remove the (.+)\?$/.exec(question);
        assert.ok(match?.[1], `Expected a container and trap question: ${question}`);
        assert.equal(match[1], match[2], 'one question must describe the same imagined trap twice');
        names.add(match[1]);
    }
    assertImaginaryNames(names, 'web');
});
void test('a tight diagonal blocks disarming with a hallucinated trap name', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshPlayableRoom({ hero: { hallucinationTurns: 30 } });
        level.requireAt(10, 11).typ = HWALL;
        level.requireAt(11, 10).typ = HWALL;
        addTrap(level, WEB, 11, 11, { tseen: true });
        await addInventoryObject(ROCK, { quan: 200 });
        const messages = [];
        initRng(seed);
        await untrap({ chooseDirection: () => ({ dx: 1, dy: 1, dz: 0, key: 'n' }),
            publish: message => { messages.push(message); } });
        const match = /^You are unable to reach the (.+)!$/.exec(messages[0] ?? '');
        assert.ok(match?.[1], `Expected an unreachable trap: ${messages.join(' / ')}`);
        names.add(match[1]);
    }
    assertImaginaryNames(names, 'web');
});
void test('forcing a mount still describes its trap through hallucination', async () => {
    const names = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshPlayableRoom({ flags: { debug: true }, hero: { hallucinationTurns: 30 } });
        const pony = await createSaddledSteed();
        pony.mtrapped = 1;
        addTrap(level, BEAR_TRAP, pony.mx, pony.my, { tseen: true });
        initRng(seed);
        await runExtendedCommand('ride', 'ly        ');
        const match = / trapped in (?:an?) (.+)\.$/.exec(game._lastPlineMessage ?? '');
        assert.ok(match?.[1], `Expected trapped mount: ${game._lastPlineMessage}`);
        names.add(match[1]);
        assert.ok(!game.u.usteed);
    }
    assertImaginaryNames(names, 'bear trap');
});
void test('a shop repair names the real web even while the hero hallucinates', async () => {
    const level = freshPlayableRoom({ moves: 100 });
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 10 });
    game.u.hallucinationTurns = 30;
    const trap = addTrap(level, WEB, 10, 11, { tseen: true });
    const disposition = await repairShopDamage(shopkeeper, {
        when: 90, place: { x: 10, y: 11 }, cost: 0, typ: ROOM, flags: 0,
    });
    assert.equal(disposition, 3);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(game._lastPlineMessage, 'The web vanishes.');
});
//# sourceMappingURL=trap_name_callers.test.js.map