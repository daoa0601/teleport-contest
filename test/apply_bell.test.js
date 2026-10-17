import { installPagerInput } from './support/pager-input.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { addTrap } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { vision_reset, vision_recalc } from '../js/vision.js';
import { useBell } from '../js/apply_bell.js';
import { removeHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { nomul } from '../js/command_state.js';
import { finishOrdinaryDeath } from '../js/end.js';
import { openit } from '../js/magic_opening.js';
import { openHoldingTrap, closeHoldingTrap, openFallingTrap } from '../js/trap_magic.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { flashGlyphAt, flush_screen, plineWithContinuation, transientTrapGlyph, } from '../js/display.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { initializePet } from '../js/dog.js';
import { punishHero } from '../js/punishment.js';
import { MONSTER_NAME, monsterIsUndead } from '../js/monster_data.js';
import { BEAR_TRAP, CLOUD, DOOR, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, G_GONE, MFAST, NO_MINVENT, PIT, ROCKTRAP, SDOOR, TT_WEB, VIBRATING_SQUARE, WEB, } from '../js/const.js';
import { BELL, BELL_OF_OPENING, CHEST, SPEED_BOOTS } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';
import { applyInventoryObject } from './support/commands.js';
import { memoryStorage } from './support/memory-storage.js';
function screen() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map((row) => row.map((cell) => cell.ch).join('')).join('\n');
}
function freshBell(options = {}) {
    freshObjectRoom({ left: 2, right: 35, ...options });
    requirePlayingGame(game);
    delete game.air_level;
    delete game.water_level;
    const input = resetInputState();
    installPagerInput(input, {
        expected: /You are being punished|ghost suddenly appears|You get regurgitated|You ring |You summon |shattered|unsettling shrill sound|sound is muffled|makes no sound|Nothing happens|released from|unpunished|chain|door|evades a bear trap/,
        limit: 24,
    });
    return input;
}
function trapAtHero(type, properties = {}) {
    return addTrap(requireGameLevel(), type, game.u.ux, game.u.uy, { tseen: true, ...properties });
}
function invocationSquare() {
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 5, flags: { hellish: true } }),
    ];
    game.u.uz = { dnum: 1, dlevel: 4 };
    trapAtHero(VIBRATING_SQUARE);
}
void test('ordinary ringing wakes within the hero level radius and recalls pets without thawing them', async () => {
    freshBell({ hero: { ulevel: 1 } });
    requirePlayingGame(game);
    const near = await createMonsterAt('kitten', 12, 10, NO_MINVENT);
    initializePet(near, { state: game });
    near.msleeping = 1;
    near.mfrozen = 5;
    near.mtrack = [{ x: 9, y: 9 }];
    const far = await createMonsterAt('goblin', 15, 10, NO_MINVENT);
    far.msleeping = 1;
    const bell = await addInventoryObject(BELL);
    const result = await useBell(bell);
    assert.equal(result.spentTime, true);
    assert.equal(near.msleeping, 0);
    assert.equal(near.mfrozen, 5);
    assert.ok(near.edog);
    assert.equal(near.edog.whistletime, game.moves);
    assert.equal(near.mtrack.length, 0);
    assert.equal(far.msleeping, 1);
});
for (const gate of ['underwater', 'swallowed ordinary']) {
    void test(`${gate} muffles ringing without charges, discoveries, or wake effects`, async () => {
        freshBell();
        requirePlayingGame(game);
        const sleeper = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
        sleeper.msleeping = 1;
        const bell = await addInventoryObject(gate === 'underwater' ? BELL_OF_OPENING : BELL, {
            spe: 2,
            known: false,
            typeKnown: false,
        });
        if (gate === 'underwater')
            game.u.uinwater = 1;
        else
            game.u.uswallow = 1;
        await useBell(bell);
        assert.equal(bell.spe, 2);
        assert.equal(bell.known, false);
        assert.equal(sleeper.msleeping, 1);
        await flush_screen();
        assert.ok(screen().includes('But the sound is muffled.'));
    });
}
for (const charges of [0, 2]) {
    void test(`the invocation Bell with ${charges ? 'a charge' : 'no charges'} reveals its identity and ${charges ? 'records its ringing time' : 'stays silent'}`, async () => {
        freshBell();
        requirePlayingGame(game);
        invocationSquare();
        const bell = await addInventoryObject(BELL_OF_OPENING, {
            spe: charges,
            age: 7,
            known: false,
            typeKnown: false,
        });
        await useBell(bell);
        assert.equal(bell.known, true);
        assert.ok(game._knownObjectTypes);
        assert.ok(game._knownObjectTypes.has(BELL_OF_OPENING));
        assert.equal(bell.spe, Math.max(0, charges - 1));
        assert.equal(bell.age, charges ? game.moves : 7);
        await flush_screen();
        assert.ok(screen().includes(charges ? 'unsettling shrill sound' : 'makes no sound'));
    });
}
void test('stairs at the invocation position use ordinary searching rather than invocation timing', async () => {
    freshBell();
    requirePlayingGame(game);
    invocationSquare();
    game.stairs = {
        sx: game.u.ux,
        sy: game.u.uy,
        up: false,
        isladder: false,
        tolev: { dnum: 1, dlevel: 5 },
        u_traversed: false,
        next: null,
    };
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, age: 7 });
    requireGameLevel().requireAt(11, 10).typ = SDOOR;
    await useBell(bell);
    assert.equal(bell.age, 7);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, DOOR);
    assert.ok(requireGameLevel().requireAt(11, 10).doormask & D_CLOSED);
});
void test('uncursed charged ringing reveals secret doors and traps without opening a locked chest', async () => {
    freshBell();
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, {
        spe: 2,
        known: false,
        typeKnown: false,
    });
    const chest = await floorObject(CHEST, 10, 11, { olocked: true });
    requireGameLevel().requireAt(11, 10).typ = SDOOR;
    const trap = trapAtHero(PIT, { tseen: false });
    await useBell(bell);
    assert.equal(bell.spe, 1);
    assert.equal(bell.known, true);
    assert.equal(trap.tseen, true);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, DOOR);
    assert.equal(chest.olocked, true);
    assert.equal(game.u.utrap || 0, 0);
});
void test('blessed ringing opens floor locks and doors, releases the hero, and leaves traps intact', async () => {
    freshBell();
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, blessed: true, known: false });
    const chest = await floorObject(CHEST, 11, 10, { olocked: true, otrapped: true });
    const lockedDoor = requireGameLevel().requireAt(11, 11);
    lockedDoor.typ = DOOR;
    lockedDoor.doormask = D_LOCKED;
    const web = trapAtHero(WEB);
    game.u.utrap = 4;
    game.u.utraptype = TT_WEB;
    await useBell(bell);
    assert.equal(chest.olocked, false);
    assert.equal(chest.otrapped, true);
    assert.equal(requireGameLevel().requireAt(11, 11).doormask, D_ISOPEN);
    assert.equal(game.u.utrap, 0);
    assert.ok(requireGameLevel().traps.includes(web));
    assert.equal(bell.known, true);
});
void test('blessed ringing removes punishment even when there is no nearby lock', async () => {
    freshBell();
    requirePlayingGame(game);
    await punishHero();
    const ball = game.uball;
    assert.ok(ball);
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, blessed: true, known: false });
    await useBell(bell);
    assert.equal(game.uchain, null);
    assert.equal(game.u.punished, false);
    assert.equal(ball.where, 'floor');
    assert.equal(bell.known, true);
});
void test('adjacent trapped doors explode, damage and stun the hero, and become doorways', async () => {
    freshBell();
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, blessed: true });
    const nearDoor = requireGameLevel().requireAt(11, 10);
    nearDoor.typ = DOOR;
    nearDoor.doormask = D_CLOSED | D_TRAPPED;
    const hp = game.u.uhp;
    await useBell(bell);
    assert.equal(requireGameLevel().requireAt(11, 10).doormask, D_NODOOR);
    assert.ok(game.u.uhp < hp);
    assert.ok((game.u.stunnedTurns ?? 0) > 0);
});
void test('distant trapped doors wake nearby monsters without damaging the hero', async () => {
    freshBell();
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, blessed: true });
    const farDoor = requireGameLevel().requireAt(13, 10);
    farDoor.typ = DOOR;
    farDoor.doormask = D_CLOSED | D_TRAPPED;
    const sleeper = await createMonsterAt('goblin', 14, 11, NO_MINVENT);
    sleeper.msleeping = 1;
    const hp = game.u.uhp;
    await useBell(bell);
    assert.equal(game.u.uhp, hp);
    assert.equal(sleeper.msleeping, 0);
    assert.equal(requireGameLevel().requireAt(13, 10).doormask, D_NODOOR);
});
void test('cursed charged ringing summons real undead without inventory and marks a graveyard', async () => {
    freshBell({ gameplaySeed: 77n });
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, cursed: true, known: false });
    await useBell(bell);
    assert.ok(requireGameLevel().monsters.length > 0);
    assert.ok(requireGameLevel().monsters.every((monster) => monsterIsUndead(monster.mnum)));
    assert.ok(requireGameLevel().monsters.every((monster) => (monster.minvent?.length ?? 0) === 0));
    assert.equal(requireGameLevel().flags.graveyard, true);
    assert.equal(bell.spe, 1);
    assert.equal(bell.known, false);
});
void test('charged ringing expels a swallowed hero; a cursed Bell leaves the engulfment intact', async () => {
    for (const cursed of [false, true]) {
        freshBell();
        requirePlayingGame(game);
        const worm = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
        game.u.uswallow = 1;
        game.u.ustuck = worm;
        const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, cursed, known: false });
        await useBell(bell);
        assert.equal(!!game.u.uswallow, cursed);
        assert.equal(bell.spe, 1);
        assert.equal(bell.known, false);
    }
});
void test('an unpaid Bell pays its usage fee before consuming a charge', async () => {
    freshBell();
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2 });
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    bell.unpaid = true;
    const debit = shopkeeper.eshk.debit || 0;
    await useBell(bell);
    assert.ok(shopkeeper.eshk.debit > debit);
    assert.equal(bell.spe, 1);
});
void test('release text pauses before lifting a hero out of a web', async () => {
    const input = freshBell();
    requirePlayingGame(game);
    input.beforeRead = null;
    input.display = null;
    trapAtHero(WEB);
    game.u.utrap = 3;
    game.u.utraptype = TT_WEB;
    await plineWithContinuation('An earlier announcement fills most of the message line now.');
    const release = openHoldingTrap(game.u);
    await input.waitUntilBlocked();
    assert.equal(game.u.utrap, 3);
    installPagerInput(input, {
        expected: /You are being punished|ghost suddenly appears|You get regurgitated|released from.*web/,
        limit: 1,
    });
    input.feed(' ');
    assert.equal((await release).changed, true);
    assert.equal(game.u.utrap, 0);
});
void test('holding magic releases monsters while preserving the trap and can force a known bear trap closed', async () => {
    freshBell();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    goblin.mhp = goblin.mhpmax = 100;
    addTrap(requireGameLevel(), BEAR_TRAP, 11, 10, { tseen: true });
    goblin.mtrapped = 1;
    assert.equal((await openHoldingTrap(goblin)).changed, true);
    assert.equal(goblin.mtrapped, 0);
    goblin.mtrapseen = 1 << (BEAR_TRAP - 1);
    assert.equal((await closeHoldingTrap(goblin)).changed, true);
    assert.equal(goblin.mtrapped, 1);
    assert.ok(goblin.mhp > 0 && goblin.mhp < 100, 'the closed trap damages its surviving occupant');
    assert.equal(requireGameLevel().traps.length, 1);
});
void test('mounted forced web closure traps the hero without a duplicate hero web announcement', async () => {
    freshBell();
    requirePlayingGame(game);
    const steed = await createSaddledSteed();
    game.u.usteed = steed;
    trapAtHero(WEB);
    assert.equal((await closeHoldingTrap(steed)).changed, true);
    assert.equal(game.u.utraptype, TT_WEB);
    assert.ok((game.u.utrap ?? 0) > 0);
    assert.equal(steed.mtrapped || 0, 0);
    assert.ok(!screen().includes('You are caught'));
});
void test('falling magic activates ceiling rock traps but does not report an untrapped hero as held', async () => {
    freshBell();
    requirePlayingGame(game);
    trapAtHero(ROCKTRAP);
    const hp = game.u.uhp;
    const result = await openFallingTrap(game.u, { trapdoorOnly: true });
    assert.equal(result.noticed, true);
    assert.equal(result.changed, false);
    assert.ok(game.u.uhp < hp);
});
void test('ordinary cursed Bells can summon nymphs, shatter, speed them up, or briefly immobilize their ringer', async () => {
    const seen = new Set();
    for (let seed = 1; seed <= 180 && seen.size < 4; seed++) {
        freshBell();
        requirePlayingGame(game);
        const bell = await addInventoryObject(BELL, { cursed: true });
        initRng(BigInt(seed));
        const result = await useBell(bell);
        const nymph = requireGameLevel().monsters.find((m) => MONSTER_NAME[m.mnum]?.includes('nymph'));
        if (!nymph)
            continue;
        assert.equal(nymph.minvent?.length ?? 0, 0);
        if (!result.object) {
            seen.add('shattered');
            assert.ok(!game.inventory.includes(bell));
        }
        else if (nymph.permspeed === MFAST)
            seen.add('speed');
        else if (game._helplessTurns) {
            seen.add('delay');
            assert.ok(game._helplessTurns <= 2);
            assert.equal(game._helplessDoneMessage, '');
            assert.equal(game.u.usleep || 0, 0);
        }
        else
            seen.add('unchanged');
    }
    assert.equal(seen.size, 4, `Missing native ordinary Bell outcomes: ${[...seen].join(', ')}`);
});
for (const existingDelay of [0, 5]) {
    void test(`cursed Bell paralysis clears cancelled dressing's death reason with ${existingDelay} turns already pending`, async () => {
        const input = freshBell({
            flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
        });
        requirePlayingGame(game);
        installPagerInput(input, {
            expected: /You ring |You summon |nymph wakes up|Goodbye|points|You were/i,
            limit: 12,
        });
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.iflags.toptenwin = false;
        const boots = await addInventoryObject(SPEED_BOOTS, { known: false });
        input.feed(boots.invlet);
        await rhack('W'.charCodeAt(0));
        await removeHeroArmor(boots);
        if (existingDelay > 0)
            nomul(-existingDelay);
        const bell = await addInventoryObject(BELL, { cursed: true });
        initRng(10n);
        await useBell(bell);
        assert.equal(game._helplessDoneMessage, '', 'The bell must immobilize its ringer');
        if (existingDelay > 0)
            assert.equal(game._helplessTurns, existingDelay);
        else
            assert.ok((game._helplessTurns ?? 0) > 0 && (game._helplessTurns ?? 0) <= 2);
        await finishOrdinaryDeath({ killer: 'fox' });
        assert.equal(loadScoreRecords()[0]?.death, 'killed by a fox, while helpless');
    });
}
void test('one extinct nymph species suppresses all ordinary cursed Bell summoning', async () => {
    freshBell();
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    game.mvitals[MONSTER_NAME.indexOf('wood nymph')] = { born: 0, died: 0, mvflags: G_GONE };
    const bell = await addInventoryObject(BELL, { cursed: true });
    for (let ring = 0; ring < 30; ring++)
        await useBell(bell);
    assert.equal(requireGameLevel().monsters.length, 0);
    assert.ok(game.inventory.includes(bell));
});
void test('applied Bell command consumes a charge and a turn while opening a real floor lock', async () => {
    freshBell();
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, blessed: true });
    const chest = await floorObject(CHEST, 11, 10, { olocked: true });
    await applyInventoryObject(bell);
    assert.equal(chest.olocked, false);
    assert.equal(bell.spe, 1);
    assert.equal(game.context.move, 1);
});
for (const species of [
    'fire elemental',
    'gelatinous cube',
    'ghost',
    'hill giant',
    'red dragon',
    'cave spider',
]) {
    void test(`locking a web respects the ${species}'s body rather than holding every monster`, async () => {
        freshBell();
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
        const trap = addTrap(requireGameLevel(), WEB, 11, 10, { tseen: true });
        const result = await closeHoldingTrap(monster);
        assert.equal(result.changed, false);
        assert.equal(monster.mtrapped || 0, 0);
        const destroysWeb = !['ghost', 'cave spider'].includes(species);
        assert.equal(requireGameLevel().traps.includes(trap), !destroysWeb);
    });
}
void test('a fire-elemental hero burns an applied locking web instead of becoming trapped', async () => {
    freshBell({ hero: { umonnum: MONSTER_NAME.indexOf('fire elemental'), mh: 30, mhmax: 30 } });
    requirePlayingGame(game);
    const trap = trapAtHero(WEB);
    const result = await closeHoldingTrap(game.u);
    assert.equal(result.changed, false);
    assert.equal(game.u.utrap || 0, 0);
    assert.ok(!requireGameLevel().traps.includes(trap));
});
void test('a flying monster evades forced bear trap closure while the visible trap is learned', async () => {
    freshBell();
    requirePlayingGame(game);
    const bat = await createMonsterAt('giant bat', 11, 10, NO_MINVENT);
    const trap = addTrap(requireGameLevel(), BEAR_TRAP, 11, 10, { tseen: false });
    const result = await closeHoldingTrap(bat);
    assert.equal(result.changed, false);
    assert.equal(result.noticed, true);
    assert.equal(trap.tseen, true);
    await flush_screen();
    assert.ok(screen().includes('evades a bear trap'));
});
void test('magical finding removes known disguises and reveals genuine hiding species', async () => {
    freshBell();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    const spider = await createMonsterAt('cave spider', 12, 11, NO_MINVENT);
    mimic.m_ap_type = 2 | 8; // object disguise already known to the hero
    mimic.mappearance = CHEST;
    spider.mundetected = 1;
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2 });
    await useBell(bell);
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(spider.mundetected, 0);
});
void test('appearance knowledge alone does not turn a visible monster into a discovery', async () => {
    freshBell();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.m_ap_type = 8;
    const bell = await addInventoryObject(BELL_OF_OPENING, {
        spe: 2,
        known: false,
        typeKnown: false,
    });
    await useBell(bell);
    assert.equal(goblin.m_ap_type, 8);
    assert.equal(bell.known, false);
});
for (const elementalPlane of [false, true]) {
    void test(`magical opening ${elementalPlane ? 'ignores cloud blockers on the Air plane' : 'respects intervening dungeon walls'}`, async () => {
        freshBell();
        requirePlayingGame(game);
        if (elementalPlane)
            game.air_level = createSpecialLevel(game.u.uz);
        const chest = await floorObject(CHEST, 14, 10, { olocked: true });
        // An entire wall across the room blocks alternative diagonal sight.
        for (let y = 6; y <= 14; y++)
            requireGameLevel().requireAt(12, y).typ = elementalPlane ? CLOUD : 0;
        vision_reset();
        vision_recalc(0);
        await openit();
        assert.equal(chest.olocked, !elementalPlane);
    });
}
void test('hallucinated detection discovers the real trap while presenting an imagined object', async () => {
    freshBell();
    requirePlayingGame(game);
    game.u.hallucinationTurns = 20;
    const trap = addTrap(requireGameLevel(), PIT, 11, 10, { tseen: false });
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, known: false });
    await useBell(bell);
    assert.equal(trap.tseen, true);
    assert.equal(trap.ttyp, PIT);
    assert.equal(bell.known, true);
    assert.equal((requireGameLevel().objects?.[11]?.[10] || []).length, 0);
});
void test('a revelation flash restores an unexplored square without discovering a trap or reading input', async () => {
    const input = freshBell();
    requirePlayingGame(game);
    input.beforeRead = () => {
        throw new Error('A revelation flash must not request input');
    };
    const location = requireGameLevel().requireAt(13, 10);
    requireGameLevel().flags.hero_memory = true;
    location.remembered_glyph = null;
    const trap = { tx: 13, ty: 10, ttyp: PIT, tseen: false };
    await flashGlyphAt(13, 10, transientTrapGlyph(trap), 1);
    assert.equal(location.disp_ch, ' ');
    assert.equal(location.remembered_glyph, null);
    assert.equal(trap.tseen, false);
});
//# sourceMappingURL=apply_bell.test.js.map