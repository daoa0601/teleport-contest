import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, DUST, IRONBARS, MAGIC_PORTAL, ROOM, SCORR, SDOOR, STAIRS, TELEP_TRAP, TRAPDOOR, VAULT, } from '../js/const.js';
import { CORPSE, DART, GOLD_PIECE, SCR_TELEPORTATION } from '../js/object_data.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
// C refs: mklev.c make_niches()/makeniche()/makevtele(), mk_knox_portal(),
// place_branch(), mktrap()/mktrap_victim().  Every case drives the public
// level generator (mklev) at a chosen depth and observes the produced level.
async function ordinaryRooms(t, depth, roomLua = '') {
    const lua = await roomBindings(t);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.depth_start = 1;
    dungeon.num_dunlevs = 40;
    game.u.uz = { dnum: 0, dlevel: depth };
    game.specialLevels?.clear();
    game.medusa_level = undefined;
    game.knox_level = undefined;
    game.branches = [];
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ filled = 0, lit = 1 })
            ${roomLua}
        end }}
        function pre_themerooms_generate() end
        function post_level_generate() end
    `);
}
function branchFor(seedLevel, type, destDnum) {
    game.branches = [{
            end1: { ...seedLevel },
            end2: { dnum: destDnum, dlevel: 1 },
            end1_up: false,
            type,
            portal: type === 'portal',
        }];
}
void test('trapdoor niches warn "Vlad was here" behind a secret door', async (t) => {
    await ordinaryRooms(t, 10);
    let niches = 0;
    for (let seed = 1; seed <= 24; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        const warning = (level.engravings ?? []).find(engraving => engraving.pristine === 'Vlad was here');
        if (!warning)
            continue;
        niches++;
        // mklev.c make_niches(): vamp niches only appear at absolute depth
        // 6..24.  The niche starts as a secret corridor, but trap.c
        // maketrap() converts SCORR to plain corridor when it opens a hole.
        assert.equal(warning.engr_type, DUST, 'the warning is dust writing');
        const trap = level.traps.find(candidate => candidate.ttyp === TRAPDOOR && candidate.once
            && Math.abs(candidate.tx - warning.x)
                + Math.abs(candidate.ty - warning.y) === 2);
        assert.ok(trap, 'the trap sits two squares from its warning');
        assert.equal(level.requireAt(trap.tx, trap.ty).typ, CORR, 'punching the trapdoor opens the secret corridor');
        const midX = trap.tx - Math.sign(trap.tx - warning.x);
        const midY = trap.ty - Math.sign(trap.ty - warning.y);
        assert.equal(level.requireAt(midX, midY).typ, SDOOR, 'the room wall between warning and trap is a secret door');
        // wipe_engr_at() aged the writing after creation.
        assert.notEqual(warning.text, warning.pristine, 'five wiped characters must degrade the text');
    }
    assert.ok(niches > 0, 'depth 10 levels must contain trapdoor niches');
});
void test('vault niches hide a teleport trap behind an aged "ad aerarium" warning', async (t) => {
    await ordinaryRooms(t, 12);
    let vaults = 0;
    let niches = 0;
    for (let seed = 1; seed <= 24; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        let vault = null;
        for (const room of level.rooms) {
            if (isRoom(room) && room.rtype === VAULT) {
                vault = room;
                break;
            }
        }
        if (vault) {
            vaults++;
            assert.ok(level.flags.has_vault, 'a created vault marks the level');
            // C fills the vault twice: once from makelevel()'s explicit
            // fill_special_room() call and again in its final special-room
            // pass; mkgold() merges both rolls into one stack.
            for (let x = vault.lx; x <= vault.hx; x++)
                for (let y = vault.ly; y <= vault.hy; y++) {
                    const gold = (level.objects[x]?.[y] ?? [])
                        .find(object => object.otyp === GOLD_PIECE);
                    assert.ok(gold, `vault tile <${x},${y}> must hold gold`);
                    assert.ok(gold.quan >= 2 * 51 && gold.quan <= 2 * (50 + 12 * 100), `vault gold quan ${gold.quan} out of range`);
                }
        }
        for (const trap of level.traps.filter(candidate => candidate.ttyp === TELEP_TRAP && candidate.once)) {
            niches++;
            assert.equal(level.requireAt(trap.tx, trap.ty).typ, SCORR, 'the vault teleport niche is a secret corridor');
            const warning = (level.engravings ?? []).find(engraving => engraving.pristine === 'ad aerarium'
                && Math.abs(engraving.x - trap.tx) + Math.abs(engraving.y - trap.ty) === 2);
            assert.ok(warning, 'the teleport niche leaves a treasure warning');
            assert.equal(warning.engr_type, DUST);
            assert.notEqual(warning.text, warning.pristine, 'the warning text is aged by wiping');
        }
    }
    assert.ok(vaults > 0, 'the seed window must exercise vault placement');
    assert.ok(niches > 0, 'eligible vaults must sometimes receive a teleport niche');
});
void test('sealed niches keep their scroll behind iron bars', async (t) => {
    await ordinaryRooms(t, 3);
    let bars = 0;
    for (let seed = 1; seed <= 60; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        for (let x = 1; x < 79; x++)
            for (let y = 1; y < 21; y++) {
                if (level.at(x, y)?.typ !== IRONBARS)
                    continue;
                bars++;
                // The niche interior is the corridor tile the bars face:
                // through the bars, its mirror tile is the room floor.
                // C always stores a teleport scroll in that interior on
                // levels that allow teleporting (and this level does).
                const facing = [[0, 1], [0, -1], [1, 0], [-1, 0]]
                    .filter(([dx, dy]) => level.at(x + dx, y + dy)?.typ === CORR
                    && level.at(x - dx, y - dy)?.typ === ROOM);
                assert.equal(facing.length, 1, 'iron bars separate the room from exactly one niche');
                const facingDir = facing[0];
                assert.ok(facingDir);
                const [dx, dy] = facingDir;
                const scroll = (level.objects[x + dx]?.[y + dy] ?? [])
                    .find(object => object.otyp === SCR_TELEPORTATION);
                assert.ok(scroll, `niche interior <${x + dx},${y + dy}> keeps its scroll`);
            }
    }
    assert.ok(bars > 0, 'the seed window must produce sealed niches');
});
void test('shallow dart traps bury a cursed predecessor with tainted meat', async (t) => {
    await ordinaryRooms(t, 1, 'des.trap({ type = "dart" })');
    let piles = 0;
    for (let seed = 1; seed <= 8; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        for (const trap of level.traps.filter(candidate => candidate.ttyp === 2)) {
            piles++;
            const pile = level.objects[trap.tx]?.[trap.ty] ?? [];
            // The trap's own ammunition stays on the square (C zeroes the
            // poison flag only for arrows; darts are never poisoned here).
            assert.ok(pile.some(object => object.otyp === DART), 'a dart trap leaves its ammunition');
            // A dead predecessor: cursed possessions plus a long-dead corpse.
            assert.ok(pile.some(object => object.cursed), 'trap victims leave cursed possessions');
            const corpse = pile.find(object => object.otyp === CORPSE);
            assert.ok(corpse, 'a trap victim leaves a corpse');
            // mktrap_victim() backdates by TAINT_AGE + 1; a fresh corpse at
            // level-generation time is age 1, so the result is far below the
            // taint threshold.
            assert.ok(corpse.age <= -50, `corpse age ${corpse.age} must be tainted`);
        }
    }
    assert.ok(piles > 0, 'the seed window must create shallow trap victims');
});
void test('an exploded land mine trap predecessor becomes a visible pit', async (t) => {
    await ordinaryRooms(t, 1, 'des.trap({ type = "land mine" })');
    let pits = 0;
    for (let seed = 1; seed <= 8; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        assert.ok(!level.traps.some(trap => trap.ttyp === 6 /* LANDMINE */), `a depth-1 land mine cannot stay concealed (seed ${seed})`);
        for (const trap of level.traps.filter(candidate => candidate.ttyp === 11)) {
            pits++;
            assert.equal(trap.tseen, true, 'an exploded predecessor land mine is an open, visible pit');
        }
    }
    assert.ok(pits > 0, 'the seed window must convert land mines to pits');
});
void test('branch levels receive cross-dungeon stairs and portals', async (t) => {
    await ordinaryRooms(t, 6);
    for (let seed = 1; seed <= 12; seed++) {
        // Staircase branch: mklev.c place_branch() turns the branch into a
        // down ladder whose stairway leaves this dungeon.
        branchFor(game.u.uz ?? { dnum: 0, dlevel: 6 }, 'stair', 2);
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        let found = false;
        for (let stair = game.stairs; stair; stair = stair.next) {
            if (stair.tolev.dnum !== 2)
                continue;
            found = true;
            const spot = level.requireAt(stair.sx, stair.sy);
            assert.equal(spot.typ, STAIRS, 'branch stairs replace floor terrain');
            assert.equal(spot.ladder, 2, 'an end1-down branch stair is a down ladder');
            assert.equal(stair.isladder, false, 'branch stairs are stairwells');
            assert.equal(stair.tolev.dlevel, 1);
            assert.equal(stair.u_traversed, false, 'fresh branch stairs are untraversed');
        }
        assert.ok(found, `a stair branch must place its stairway (seed ${seed})`);
        assert.equal(game.made_branch, true);
        // Portal branch: place_branch() creates a magic portal trap aimed at
        // the destination instead of touching terrain.
        branchFor(game.u.uz ?? { dnum: 0, dlevel: 6 }, 'portal', 3);
        initRng(seed);
        await mklev();
        const portalLevel = requireGameLevel();
        const portal = portalLevel.traps.find(candidate => candidate.ttyp === MAGIC_PORTAL);
        assert.ok(portal, `a portal branch must create its portal (seed ${seed})`);
        assert.deepEqual(portal.dst, { dnum: 3, dlevel: 1 });
        assert.equal(game.made_branch, true);
    }
});
void test('deep vaults may open the Fort Ludios portal on their corner', async (t) => {
    await ordinaryRooms(t, 15);
    const knoxDnum = game.dungeons.findIndex(dungeon => dungeon?.dname === 'Fort Ludios');
    assert.ok(knoxDnum >= 0, 'the dungeon list contains Fort Ludios');
    game.medusa_level = { dnum: 0, dlevel: 24, flags: { town: false }, alignment: null };
    game.knox_level = { dnum: knoxDnum, dlevel: 1, flags: { town: false }, alignment: null };
    const floatingDnum = game.dungeons.length;
    let vaults = 0;
    let portals = 0;
    let deferred = 0;
    for (let seed = 1; seed <= 40; seed++) {
        game.branches = [{
                end1: { dnum: floatingDnum, dlevel: 1 },
                end2: { dnum: knoxDnum, dlevel: 1 },
                end1_up: false,
                type: 'portal',
                portal: true,
            }];
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        let vault = null;
        for (const room of level.rooms) {
            if (isRoom(room) && room.rtype === VAULT) {
                vault = room;
                break;
            }
        }
        if (!vault)
            continue;
        vaults++;
        const portal = level.traps.find(candidate => candidate.ttyp === MAGIC_PORTAL);
        const branch = game.branches[0];
        assert.ok(branch);
        if (portal) {
            portals++;
            // C fills the vault, then calls mk_knox_portal(vault_x + w,
            // vault_y + h): the portal lands on the vault's far corner tile.
            assert.equal(portal.tx, vault.hx, 'the portal sits on the vault corner x');
            assert.equal(portal.ty, vault.hy, 'the portal sits on the vault corner y');
            assert.deepEqual(portal.dst, { dnum: knoxDnum, dlevel: 1 });
            assert.deepEqual(branch.end1, game.u.uz, 'opening the portal anchors the branch on this level');
        }
        else {
            deferred++;
            assert.deepEqual(branch.end1, { dnum: floatingDnum, dlevel: 1 }, 'a deferred vault keeps the branch floating');
        }
    }
    assert.ok(vaults > 0, 'the seed window must exercise vault placement');
    assert.ok(portals > 0, 'some deep vaults must open the portal');
    assert.ok(deferred > 0, 'the two-in-three deferral must also be exercised');
});
//# sourceMappingURL=audit2_mklev_rare_features.test.js.map