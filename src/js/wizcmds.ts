// Wizard-mode commands.
// C refs: wizcmds.c wiz_wish()/wiz_polyself()/wiz_genesis()/wiz_detect()/
// wiz_kill()/wiz_telekinesis()/wiz_where()/wiz_level_tele()/wiz_level_change()/
// wiz_map()/wiz_identify()/wiz_show_nhuuid().

import {
    ACH_MINE_PRIZE, ACH_SOKO_PRIZE, A_WIS, COLNO, COULD_SEE, CORR, DIED, G_EXTINCT, In_endgame, In_mines,
    In_quest, In_sokoban, In_V_tower, IN_SIGHT, Invocation_lev, Is_airlevel, Is_botlevel, Is_earthlevel,
    Is_firelevel, Is_knox_level, Is_rogue_level, Is_stronghold, Is_waterlevel, KILLED_BY, MAGIC_PORTAL,
    MENU_ITEMFLAGS_SKIPINVERT, MENU_ITEMFLAGS_SKIPMENUCOLORS, MGIVENNAME, MIGR_EXACT_XY, MM_NOMSG,
    MON_ENDGAME_MIGR, MON_LIMBO, MON_MIGRATING, MON_OFFMAP, NHW_MENU, PICK_ANY, PICK_NONE, POLY_CONTROLLED,
    ROWNO, SICK_NONVOMITABLE, SICK_VOMITABLE, SDOOR, STONE, TEMP_LIT, WM_MASK,
    IS_WALL, IS_ROOM, IS_DOOR,
} from './const.js';
import { AD_PHYS } from './monster_attack_types.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';
import type { DungeonBranch, DungeonLocation, SpecialLevelDescriptor } from './dungeon_types.js';
import type { TextMenuEntry } from './windows.js';
import {
    ATR_INVERSE, addMenuHeading, showDisclosureOverlay, showPagedPickOneMenu, showTextMenuOverlay,
} from './windows.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu,
} from './tty_menu.js';
import {
    canSpotMonster, consumeHallucinatedMenuObjectGlyph, docrt, map_engraving, map_trap, unmap_invisible,
} from './display.js';
import { bot } from './botl.js';
import { pline, plineWithContinuation } from './pline.js';
import { getLine, paranoidQuery, promptYesNoQuit } from './query.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { visibleCommandKey } from './command_keys.js';
import {
    inventoryCommandLetter, fullyIdentifyObject, identifyPack, inventoryItemDescription, inventoryPrimaryHandDetail,
    objectNeedsFullIdentification,
} from './invent.js';
import { askTeleportDestination } from './teleport.js';
import { selectMapPosition, showGetposTip } from './getpos.js';
import { setMulti } from './command_state.js';
import { makeWish } from './wish.js';
import { polymorphHero } from './polyself.js';
import { createParticularMonster } from './read_creation.js';
import { findit } from './detect.js';
import { monsterName } from './do_name.js';
import { monsterAtPosition, monsterHasMapPosition } from './steed.js';
import { monsterIsNonliving } from './monster_data.js';
import { finishMonsterKilled, finishMonsterLiquidDeath } from './mon.js';
import { finishHeroDeath } from './end.js';
import {
    finishHeroMonsterKill, finishHeroMonsterKillOutcome, finishHurtleMonsterDeath,
} from './hero_monster_death.js';
import { hurtleHero } from './hero_hurtle.js';
import { hurtleMonster } from './dothrow.js';
import { finishTeleportArrival } from './location_effects.js';
import { gotoLevel } from './level_change.js';
import { levelTeleport } from './level_teleport.js';
import { loseHeroExperience, gainExperienceLevel } from './exper.js';
import { exerciseAttribute } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { withMonsterNoticesBlocked } from './hack.js';
import { mapMagicLevel } from './magic_mapping.js';
import { dungeonDepth } from './hacklib.js';
import { specialDisplayName } from './dungeon.js';
import { addInventoryItem } from './u_init.js';
import { mksobj } from './mkobj.js';
import { AMULET_OF_YENDOR } from './object_data.js';
import { recordObjectEncounter, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { reassignInventoryLetters } from './inventory_prompt.js';
import { observeObjectForNaming } from './objnam.js';
import { inventorySortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { objectTypeKnown } from './shk.js';
import { FUZZER_IMPOSSIBLE_CONTINUE, FUZZER_IMPOSSIBLE_PANIC, panic } from './diagnostics.js';
import { flipSpecialLevel, flipSpecialLevelRandom } from './sp_lev.js';
import { yn_function, promptChoice, promptYesNo } from './query.js';
import { requireInitializedGame } from './gstate.js';
import { applyHeroLiquidEffects } from './hack.js';
import { makeDeaf } from './hero_hearing.js';
import { startHeroSickness, startHeroVomiting } from './hero_illness.js';
import { makeHallucinated, makeStunned } from './hero_mental_status.js';
import {
    propertyIsActive, propertyTimeout, refreshMovementProperties, setPropertyTimeout,
} from './properties.js';
import { rn2 } from './rng.js';
import { makeBlinded } from './sight_change.js';
import { setHeroSlimingTimeout } from './slime.js';
import { setHeroPetrificationTimeout } from './stoning.js';
import { setSlipperyHands } from './towel.js';
import { showMultiSelectWindow, showTextWindow } from './windows.js';
import type { PlayingGameState } from './game_state.js';
import {
    heroIsPunished, placeBallAndChain, releaseCarriedBall, unplaceBallAndChain,
} from './ball.js';
import {
    initOverviewRecord, insideWizardTower, levelAtDepth, levelIsWizardTower, sameDungeonLevel,
    specialPrototypeAt,
} from './dungeon.js';
import { rewindEngravingsForSave } from './engrave.js';
import {
    killGenocidedMonsters, purgeDeadMonsters, removeMonsterFromGame, restoreNaturalMonsterShapes,
    smellUnseenMonster,
} from './mon.js';
import { maybeResetPick } from './lock_context.js';
import { mklev } from './mklev.js';
import { MONSTER_GENO, MONSTER_NAME, monsterTypeName } from './monster_data.js';
import { deallocateObject } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { checkSpecialRoom, setPaidShopkeeper } from './shk.js';
import { hasShopkeeperData } from './shop_types.js';
import { vision_reset_new_level } from './vision.js';
import { collectLevelFollowers, deliverMigratingMonsters, migrateMonsterOffLevel } from './dog.js';
import { makemonAt, rndmonstAdj } from './makemon.js';
import { heroArmName } from './body_parts.js';
import { heroSpecies } from './hero_species.js';
import { heroHasOlfaction } from './polyself.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { CmapSymbol } from './glyph_numbers.js';
import { mayDig } from './hero_digging.js';
import { displayMessageWindow } from './tty_topline.js';
import { NO_COLOR } from './terminal.js';
import { symsetMenuValue } from './options.js';
import { cmapSymbolByte, objectClassSymbol, rogueColorsActive } from './display.js';
import { customizedGlyphs } from './glyph_customizations.js';
import { rumorCheck } from './rumor.js';
import { depth } from './hacklib.js';
import { clearHeroTrap } from './hero_traps.js';
import {
    deliverSpecialLevelMessages, placeHeroAtRandomArrival, resolveHeroArrivalCollision,
} from './level_change.js';
import { cls, flush_screen, glyphAt, map_invisible } from './display.js';
import type { PropertyName } from './property_types.js';

type SpecialLayoutEvent = SpecialLevelDescriptor & {
    kind: 'special'; name: string;
};
type DungeonLayoutEvent = SpecialLayoutEvent | {
    kind: 'branch'; dnum: number; dlevel: number; branch: DungeonBranch;
};
interface WizardLevelDestination extends DungeonLocation {
    prototype?: string;
}

// C wizcmds.c:wiz_wish().
export async function wizWish() {
    const verbose = game.flags.verbose;
    game.flags.verbose = false;
    try {
        await makeWish();
    } finally {
        if (verbose === undefined) delete game.flags.verbose;
        else game.flags.verbose = verbose;
    }
    await reportHeroEncumbrance();
}

// C wiz_polyself(): allow a chosen form without consuming a game turn.
export async function wizPolyself() {
    await polymorphHero(POLY_CONTROLLED);
    game.context.move = 0;
}

// wizcmds.c:wiz_genesis() allows deliberate creation while ordinary births
// are disabled, then restores that setting even when the prompt is cancelled.
export async function wizGenesis() {
    const mongenSaved = game.iflags.debug_mongen;
    game.iflags.debug_mongen = false;
    try {
        await createParticularMonster();
    } finally {
        if (mongenSaved === undefined) delete game.iflags.debug_mongen;
        else game.iflags.debug_mongen = mongenSaved;
    }
    game.context.move = 0;
}

// C wizcmds.c:wiz_detect().
export async function wizDetect() {
    await findit();
    game.context.move = 0;
}

// C wizcmds.c:wiz_kill().
export async function wizKill() {
    requirePlayingGame(game);
    const level = requireGameLevel();
    const here = { ...game.u.uz };
    let cursor: Position = { x: game.u.ux, y: game.u.uy };
    let prompt = 'Pick first monster to slay';
    for (;;) {
        await plineWithContinuation(`${prompt}:`);
        prompt = 'Next monster';
        const verbose = game.flags.verbose;
        const autodescribe = game.iflags.autodescribe;
        game.flags.verbose = false;
        game.iflags.autodescribe = true;
        let target;
        try {
            const tipShown = await showGetposTip();
            target = await selectMapPosition({
                start: cursor, prompt: tipShown ? 'Move cursor to a monster:' : game._pending_message,
                goal: 'a monster',
            });
        } finally {
            if (verbose === undefined) delete game.flags.verbose;
            else game.flags.verbose = verbose;
            if (autodescribe === undefined) delete game.iflags.autodescribe;
            else game.iflags.autodescribe = autodescribe;
        }
        if (!target) break;
        cursor = target;
        const monster = await wizardKillTarget(cursor);
        if (monster === 'quit') break;
        await unmap_invisible(cursor.x, cursor.y);
        if (!monster) {
            await pline('There is no monster there.');
            break;
        }
        const tame = !!monster.mtame;
        const seen = canSpotMonster(monster) || !!game.u.uswallow && monster === game.u.ustuck;
        const name = monsterName(monster, {
            article: tame ? 'your' : seen ? 'the' : 'a',
            ...(tame ? { adjective: seen ? 'poor' : 'poor, unseen' }
                : seen ? {} : { adjective: 'unseen' }),
            suppressIt: true, suppressHallucination: true,
            suppressSaddle: tame && !!MGIVENNAME(monster),
        });
        const destroyed = monsterIsNonliving(monster.mnum);
        if (game.iflags.menu_requested) {
            game.context.mon_moving = true;
            try {
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} is ${destroyed ? 'destroyed' : 'killed'}.`);
                await finishMonsterKilled(monster, game, { damageType: AD_PHYS, cause: null });
            } finally {
                game.context.mon_moving = false;
            }
        } else {
            await plineWithContinuation(`You ${destroyed ? 'destroy' : 'kill'} ${name}!`);
            await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
        }
        if (game.program_state.gameover || game.u.utotype
            || game.u.uz.dnum !== here.dnum || game.u.uz.dlevel !== here.dlevel) break;
    }
    level.monsters = level.monsters.filter(monster => !monster.dead);
    game.context.move = 0;
}

async function wizardKillTarget(cursor: Position): Promise<Monster | 'quit' | null> {
    if (cursor.x === game.u.ux && cursor.y === game.u.uy) {
        const steed = game.u.usteed;
        if (steed) {
            const answer = await promptYesNoQuit(`Kill ${monsterName(steed)}?`);
            if (answer === 'q') return 'quit';
            if (answer === 'y') return steed;
        }
        const question = game.urole?.key === 'samurai' ? 'Perform seppuku?' : 'Commit suicide?';
        if (await paranoidQuery(true, question))
            await finishHeroDeath({
                killer: `${game.flags.female ? 'her' : 'his'} own player`,
                killerFormat: KILLED_BY, deathType: DIED, deathLineShown: true,
            });
        return 'quit';
    }
    if (game.u.uswallow)
        return Math.abs(cursor.x - game.u.ux) <= 1 && Math.abs(cursor.y - game.u.uy) <= 1
            ? game.u.ustuck ?? null : null;
    return requireGameLevel().monsters.find(monster => monsterHasMapPosition(monster, game)
        && (monster.mx === cursor.x && monster.my === cursor.y
            || monster.wormSegments?.some(segment => segment.x === cursor.x && segment.y === cursor.y))
        && !monster.dead && monster.mhp > 0) ?? null;
}

// C wizcmds.c:wiz_telekinesis(). The command keeps the cursor on a hurtled
// actor and takes no time. rhack's reset_cmd_vars() clears hurtle's delay.
export async function wizTelekinesis(): Promise<void> {
    requirePlayingGame(game);
    let cursor: Position = { x: game.u.ux, y: game.u.uy };
    await plineWithContinuation('Pick a monster to hurtle.');
    do {
        const tipShown = await showGetposTip();
        if (game.flags.verbose) {
            const helpKey = game.commandBindings.specialKey('getpos.help') ?? 63;
            await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
        }
        if (tipShown) await plineWithContinuation('Move cursor to a monster:');
        const target = await selectMapPosition({
            start: cursor, goal: 'a monster',
            prompt: game._pending_message,
        });
        if (!target) break;
        cursor = target;
        const monster = monsterAtPosition(game.level, cursor.x, cursor.y);
        const atHero = cursor.x === game.u.ux && cursor.y === game.u.uy;
        if (!(monster && canSpotMonster(monster)) && !atHero) continue;
        const direction = await promptDirection((_message, retry) => readDirectionKey('which direction? ', retry));
        if (!direction) break;
        if (monster) {
            await hurtleMonster(monster, direction.dx, direction.dy, 6, {
                finishMonsterDeath: finishHurtleMonsterDeath,
                // minliquid() credits drowning and lava burning to the hero;
                // rust and fatal damage to a fire-resistant monster use mondied().
                finishLiquidDeath: (target, death) =>
                    death.cause === 'drowning' || death.cause === 'lava-burning'
                        ? finishHeroMonsterKillOutcome(target, target.mx, target.my, { showKillMessage: false })
                        : finishMonsterLiquidDeath(target, death),
            });
            if (!monster.dead && monster.mhp > 0 && canSpotMonster(monster))
                cursor = { x: monster.mx, y: monster.my };
        } else {
            await hurtleHero(direction.dx, direction.dy, 6, {
                finishTeleport: finishTeleportArrival,
                gotoLevel, chooseTeleportDestination: askTeleportDestination,
                finishMonsterDeath: finishHurtleMonsterDeath,
            });
            cursor = { x: game.u.ux, y: game.u.uy };
        }
        if (game.program_state.gameover) break;
    } while (!game.u.utotype);
    if (game._helplessReason === 'moving through the air') setMulti(0);
    game.context.move = 0;
}

function menuLetter(index: number) {
    return index < 26
        ? String.fromCharCode('a'.charCodeAt(0) + index)
        : String.fromCharCode('A'.charCodeAt(0) + index - 26);
}

// C dungeon.c:print_dungeon() dungeon/branch heading.
function dungeonHeading(dnum: number) {
    const dungeon = game.dungeons[dnum];
    if (!dungeon) throw new RangeError(`Unknown dungeon ${dnum}`);
    const first = dungeonDepth(dnum, 1);
    const last = dungeonDepth(dnum, dungeon.num_dunlevs);
    const incoming = game.branches?.find(branch => branch.end2.dnum === dnum);
    const unplaced = !!incoming
        && (incoming.end1.dnum < 0
            || incoming.end1.dnum >= (game.dungeons?.length || 0));
    const descriptor = unplaced ? 'depth' : 'level';
    if (dungeon.num_dunlevs === 1)
        return `${dungeon.dname}: ${descriptor} ${first}`;
    let text = `${dungeon.dname}: ${descriptor}s ${first} to ${last}`;
    if (dungeon.entry_lev !== 1) {
        text += dungeon.entry_lev === dungeon.num_dunlevs
            ? ', entrance from below'
            : `, entrance on ${dungeonDepth(dnum, dungeon.entry_lev)}`;
    }
    return text;
}

function branchKind(branch: DungeonBranch) {
    if (branch.type) return branch.type;
    if (branch.portal) return 'portal';
    const child = game.dungeons?.[branch.end2.dnum];
    if (child?.dname === 'Gehennom') return 'no_end1';
    if (child?.dname === 'The Elemental Planes') return 'no_end2';
    return 'stair';
}

function branchMenuLabel(branch: DungeonBranch) {
    const child = game.dungeons?.[branch.end2.dnum];
    if (!child) return null;
    return `${branchTypeDescription(branch)} to ${child.dname}: ${dungeonDepth(
        branch.end1.dnum, branch.end1.dlevel,
    )}`;
}

function branchTypeDescription(branch: DungeonBranch) {
    return {
        portal: 'Portal',
        no_end1: 'Connection',
        no_end2: 'One way stair',
        stair: 'Stair',
    }[branchKind(branch)];
}

function dungeonLayoutEvents(dnum: number): DungeonLayoutEvent[] {
    const events: DungeonLayoutEvent[] = [];
    for (const [name, level] of game.specialLevels || []) {
        if (level.dnum !== dnum) continue;
        events.push({ kind: 'special', name, ...level });
    }
    for (const branch of game.branches || []) {
        if (branch.end1.dnum !== dnum) continue;
        events.push({
            kind: 'branch', dlevel: branch.end1.dlevel,
            dnum, branch,
        });
    }
    events.sort((a, b) => a.dlevel - b.dlevel
        || Number(a.kind === 'special') - Number(b.kind === 'special'));
    return events;
}

// C ref: dungeon.c unplaced_floater().  Fort Ludios is unavailable only
// while its incoming branch still uses the synthetic n_dgns source end.
// Once mk_knox_portal() resolves that end to a real main-dungeon level, the
// named `knox` special level is selectable like every other wizard target.
function specialLevelReachable(event: SpecialLayoutEvent) {
    if (event.name === 'dummy') return false;
    if (event.name !== 'knox') return true;
    const incoming = (game.branches || []).find(branch =>
        branch.end2?.dnum === event.dnum
        && branch.end2?.dlevel === event.dlevel);
    const sourceDnum = incoming?.end1?.dnum;
    return sourceDnum !== undefined && Number.isInteger(sourceDnum)
        && sourceDnum >= 0
        && sourceDnum < (game.dungeons?.length || 0);
}

// C ref: teleport.c level_tele().  Wizard-menu entry into the Elemental
// Planes grants the real Amulet before deferred_goto() starts.  Object
// construction, inventory identity, and prinv() precede getbones()/mklev().
// Destination placement finishes before tty asks for acknowledgement.
async function endgamePrerequisite(destination: DungeonLocation) {
    if (!In_endgame(destination) || In_endgame(game.u?.uz)
        || game.u?.uhave?.amulet) return;
    const amulet = await addInventoryItem(
        await mksobj(AMULET_OF_YENDOR, true, false),
    );
    // teleport.c prints the grant with prinv(); its doname()->xname() path
    // observes the visible object and appends it to the Amulet disco[] class
    // before the destination transaction begins.
    recordObjectEncounter(amulet.otyp);
    if (!game.u.uhave) game.u.uhave = {};
    game.u.uhave.amulet = 1;
    const message = `Endgame prerequisite: ${
        amulet.invlet
    } - the Amulet of Yendor.`;
    await pline(message);
}

// C ref: dungeon.c print_dungeon(TRUE). Build one source-ordered menu stream;
// the tty layer alone owns pagination and nested input capture.
function wizardLevelMenu() {
    const rows: TextMenuEntry[] = [];
    const choices = new Map<string, WizardLevelDestination>();
    let choiceIndex = 0;

    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
        if (In_endgame(game.u.uz) && dnum !== game.astral_level?.dnum) continue;
        // C print_dungeon(TRUE) emits the dungeon name via add_menu_heading(),
        // which skips menu coloring.
        rows.push({ text: dungeonHeading(dnum), attr: ATR_INVERSE,
            itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS });

        for (const event of dungeonLayoutEvents(dnum)) {
            const key = menuLetter(choiceIndex++);
            const current = game.u?.uz?.dnum === event.dnum
                && game.u?.uz?.dlevel === event.dlevel;
            let label;
            let destination: WizardLevelDestination;
            let reachable = true;
            if (event.kind === 'branch') {
                label = branchMenuLabel(event.branch);
                destination = { dnum: event.dnum, dlevel: event.dlevel };
            } else {
                label = `${specialDisplayName(event.name)}: ${dungeonDepth(
                    event.dnum, event.dlevel,
                )}`;
                if (event.name === 'castle')
                    label += ` (tune ${game.castleTune || ''})`;
                destination = {
                    dnum: event.dnum, dlevel: event.dlevel,
                    // dungeon.c:fixup_level_locations() retains the canonical
                    // x-* placement identity but resolves the Lua prototype
                    // through the selected role's file code.
                    prototype: specialDisplayName(event.name),
                };
                reachable = specialLevelReachable(event);
            }
            if (reachable) {
                rows.push(`${key} - ${current ? '*' : ' '} ${label}`);
                choices.set(key, destination);
            } else {
                rows.push(`      ${label}`);
            }
        }
    }
    return { rows, choices };
}

// C dungeon.c:print_dungeon(FALSE), via wizcmds.c:wiz_where().
function wizardWhereLines(): string[] {
    const lines: string[] = [];
    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
        lines.push(dungeonHeading(dnum));
        for (const event of dungeonLayoutEvents(dnum)) {
            let label;
            if (event.kind === 'branch') {
                label = branchMenuLabel(event.branch);
            } else {
                label = `${specialDisplayName(event.name)}: ${dungeonDepth(
                    event.dnum, event.dlevel,
                )}`;
                if (event.name === 'castle')
                    label += ` (tune ${game.castleTune || ''})`;
            }
            const current = event.kind === 'special'
                && game.u.uz?.dnum === event.dnum && game.u.uz.dlevel === event.dlevel;
            if (label) lines.push(`${current ? '*' : ' '} ${label}`);
        }
    }
    const floating = game.branches.filter(branch => branch.end1.dnum === game.dungeons.length);
    if (floating.length) {
        lines.push('', 'Floating branches');
        for (const branch of floating) {
            const child = game.dungeons[branch.end2.dnum];
            if (!child) throw new Error(`Floating branch has no dungeon ${branch.end2.dnum}`);
            lines.push(`   ${branchTypeDescription(branch)} to ${child.dname}`);
        }
    }
    const hero = game.u;
    if (Invocation_lev(hero.uz)) {
        const position = game.level?.invocationPosition ?? { x: 0, y: 0 };
        lines.push('', `Invocation position @ (${position.x},${position.y}), hero @ (${hero.ux},${hero.uy})`);
    } else {
        const portal = game.level?.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (portal) lines.push('', `Portal @ (${portal.tx},${portal.ty}), hero @ (${hero.ux},${hero.uy})`);
        else if (wizardLevelExpectsPortal()) lines.push('', 'No portal found.');
    }
    return lines;
}

function wizardLevelExpectsPortal(): boolean {
    const here = game.u.uz;
    return Is_earthlevel(here) || Is_airlevel(here) || Is_firelevel(here)
        || Is_waterlevel(here) || Is_knox_level(here)
        || !!here && (here.dnum === game.quest_dnum && here.dlevel === 1
            || game.branches.some(branch => branch.end2.dnum === game.quest_dnum
                && branch.end1.dnum === here.dnum && branch.end1.dlevel === here.dlevel));
}

// C refs: wizcmds.c:wiz_where() and dungeon.c:print_dungeon(FALSE).
// This is the complete live graph, unlike #overview's visited-level history
// and unlike #levelteleport's selectable menu projection.
export async function wizWhere() {
    game._pending_message = '';
    game._retained_message = '';
    await showDisclosureOverlay(wizardWhereLines(), { restoreUnderlay: true });
    await docrt();
    game.context.move = 0;
}

// C wizcmds.c:wiz_show_nhuuid(). The recorder build defines no NHUUID, so
// svn.nhuuid stays empty and the native game prints an empty identifier.
export async function wizShowNhuuid() {
    await pline('The NHUUID for this game is {  }.');
}

// C dungeon.c:print_dungeon(TRUE), with the endgame entry prerequisite.
export async function chooseWizardLevelDestination() {
    const { rows, choices } = wizardLevelMenu();
    const destination = await showPagedPickOneMenu({
        rows, choices, prompt: 'Level teleport to where:',
    });
    if (!destination) return null;
    await endgamePrerequisite(destination);
    return { destination };
}

// C wizcmds.c:wiz_level_tele().
export async function wizLevelTeleport({ menuRequested = !!game.iflags.menu_requested } = {}) {
    game.context.move = 0;
    await levelTeleport({ menuRequested });
}

// C wizcmds.c:wiz_level_change().
export async function wizLevelChange() {
    const hero = game.u;
    requireInitializedHero(hero);
    const value = await getLine('To what experience level do you want to be set?');
    const input = value?.trim();
    if (!input || !/^[+-]?\d+$/.test(input)) {
        await pline('Never mind.');
        game.context.move = 0;
        return;
    }
    let target = Number(input);
    game._pending_message = '';
    game._retained_message = '';
    if (target === hero.ulevel) {
        await plineWithContinuation('You are already that experienced.');
    } else if (target < hero.ulevel) {
        if (hero.ulevel === 1) {
            await plineWithContinuation('You are already as inexperienced as you can get.');
            game.context.move = 0;
            return;
        }
        target = Math.max(1, target);
        while (hero.ulevel > target) {
            if (await loseHeroExperience('#levelchange')) return;
        }
    } else {
        if (hero.ulevel >= 30) {
            await plineWithContinuation('You are already as experienced as you can get.');
            game.context.move = 0;
            return;
        }
        target = Math.min(30, target);
        while (hero.ulevel < target) {
            await gainExperienceLevel();
        }
    }
    hero.ulevelmax = hero.ulevel;
    game.context.move = 0;
}

// C wizcmds.c:wiz_makemap(), makemap_remove_mons(), makemap_unmakemon();
// cmd.c:makemap_prepost(). Pets leave before the old level is discarded.

const G_UNIQ = 0x1000;
export async function wizMakeMap(): Promise<void> {
    requirePlayingGame(game);
    game.context.move = 0;
    if (!game.flags.debug) {
        await plineWithContinuation("Unavailable command 'wizmakemap'.");
        return;
    }
    const wasInsideTower = insideWizardTower(game.u.ux, game.u.uy);
    const pets = await removeOldLevelMonsters();
    if (game.program_state.gameover) return;
    await discardOldLevel();
    game._specialLevelPrototype = specialPrototypeAt(game.u.uz.dnum, game.u.uz.dlevel);
    // C's wiz_makemap discards the overview (rm_mapseen) and then mklev()
    // re-creates an empty record via init_mapseen().
    initOverviewRecord(game.u.uz, game);
    await mklev();
    // C goto_level() keeps bones familiarity local to that arrival;
    // replacing the current map does not announce familiarity.
    game._restoredBones = false;
    await returnToReplacementLevel(pets, wasInsideTower);
}

// C wizcmds.c:makemap_remove_mons().
async function removeOldLevelMonsters(): Promise<Monster[]> {
    const pets = await collectLevelFollowers(game, true);
    // C fmon is newest first, whereas level.monsters appends births.
    for (const monster of requireGameLevel().monsters.slice().reverse()) {
        if (monster.mhp <= 0) continue;
        await unmakeMonster(monster);
        if (game.program_state.gameover) return pets;
    }
    // An away shopkeeper, priest, or guard still owns data about this level.
    // Remove it even if its destination is elsewhere in the dungeon.
    for (const monster of [...(game._migratingMonsters ?? [])].reverse()) {
        if (!belongsToCurrentLevel(monster)) continue;
        game._migratingMonsters = (game._migratingMonsters ?? [])
            .filter(candidate => candidate !== monster);
        monster.mstate = ((monster.mstate ?? 0) | MON_OFFMAP)
            & ~(MON_MIGRATING | MON_LIMBO | MON_ENDGAME_MIGR);
        requireGameLevel().monsters.push(monster);
        await unmakeMonster(monster);
        if (game.program_state.gameover) return pets;
    }
    purgeDeadMonsters(requireGameLevel());
    return pets;
}

async function unmakeMonster(monster: Monster): Promise<void> {
    requirePlayingGame(game);
    const vital = game.mvitals?.[monster.mnum];
    if (vital) {
        if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) vital.mvflags &= ~G_EXTINCT;
        if (vital.born) vital.born--;
    }
    // A parked guard may already be dead; its vault is going away too.
    if (monster.isgd) monster.isgd = 0;
    else if (monster.mhp <= 0) return;
    else if (hasShopkeeperData(monster) && sameLevel(monster.eshk.shoplevel, game.u.uz))
        setPaidShopkeeper(monster);
    await removeMonsterFromGame(monster);
}

function belongsToCurrentLevel(monster: Monster): boolean {
    requirePlayingGame(game);
    return !!(monster.isshk && sameLevel(monster.eshk?.shoplevel, game.u.uz)
        || monster.ispriest && sameLevel((monster.epri ?? monster.mextra?.epri)?.shrlevel, game.u.uz)
        || monster.isgd && sameLevel(monster._egd?.gdlevel, game.u.uz));
}

function sameLevel(first: DungeonLocation | undefined, second: DungeonLocation): boolean {
    return first?.dnum === second.dnum && first.dlevel === second.dlevel;
}

async function discardOldLevel(): Promise<void> {
    requirePlayingGame(game);
    const key = `${game.u.uz.dnum}:${game.u.uz.dlevel}`;
    game._overviewRecords?.delete(key);
    game._levelAnnotations?.delete(key);
    await revokeLevelPrize();
    if (heroIsPunished()) {
        await releaseCarriedBall(game);
        await unplaceBallAndChain();
    }
    maybeResetPick(null);
    if (sameLevel(game.context.digging?.level, game.u.uz)) delete game.context.digging;
    game._travelTarget = null;
    if (game.context.polearm) game.context.polearm.hitmonId = null;
    clearHeroTrap();
    await checkSpecialRoom({ newLevel: true });
    game.u.ustuck = null;
    game.u.uswallow = game.uswallow = 0;
    game.u.uswldtim = 0;
    game.u.uinwater = 0;
    game.u.uundetected = false;
    // savelev(FREEING) releases level-owned objects without destruction rolls
    // or uncreating their artifacts. Carried objects have already left.
    const level = game.level;
    for (const column of level.objects)
        for (const pile of column ?? [])
            for (const object of [...(pile ?? [])]) freeLevelObject(object);
    for (const object of [...(level.buriedObjects ?? [])]) freeLevelObject(object);
    game._levelCache?.delete(key);
}

function freeLevelObject(object: GameObject): void {
    for (const content of [...(object.contents ?? [])]) freeLevelObject(content);
    const { victual, tin, spbook } = game.context;
    if (victual?.piece === object) {
        victual.o_id = object.o_id;
        victual.piece = null;
    }
    if (tin?.tin === object) {
        tin.o_id = object.o_id;
        tin.tin = null;
    }
    if (spbook?.book === object) {
        spbook.o_id = object.o_id;
        spbook.book = null;
    }
    unlinkObject(object);
    deallocateObject(object);
}

async function revokeLevelPrize(): Promise<void> {
    requirePlayingGame(game);
    const prototype = specialPrototypeAt(game.u.uz.dnum, game.u.uz.dlevel);
    const achievement = prototype === 'minend' ? ACH_MINE_PRIZE
        : prototype === 'soko1' ? ACH_SOKO_PRIZE : null;
    if (achievement === null) return;
    const earned = game.u.uachieved ?? [];
    if (earned.some(entry => Math.abs(entry) === achievement)) {
        game.u.uachieved = earned.filter(entry => Math.abs(entry) !== achievement);
        await plineWithContinuation(`${achievement === ACH_MINE_PRIZE ? "Mine's-end" : 'Soko-prize'} achievement revoked.`);
    }
    const prizes = game.context.achieveo;
    if (prizes) {
        if (achievement === ACH_MINE_PRIZE) prizes.mines_prize_oid = 0;
        else prizes.soko_prize_oid = 0;
    }
}

async function returnToReplacementLevel(pets: readonly Monster[], wasInsideTower: boolean): Promise<void> {
    requirePlayingGame(game);
    vision_reset_new_level();
    await cls();
    const level = requireGameLevel();
    const up = !!game.u.uhave.amulet;
    const stayInsideTower = wasInsideTower && levelIsWizardTower();
    const region = stayInsideTower
        ? game._activeSpecialLevel?.downTeleportExclude
        : up ? level.upTeleportRegion : level.downTeleportRegion;
    await placeHeroAtRandomArrival(region, !stayInsideTower && up);
    await deliverMigratingMonsters(game, pets);
    if (game.program_state.gameover) return;
    if ((await killGenocidedMonsters()).heroDied) return;
    await resolveHeroArrivalCollision();
    game._heroTrack = [];
    if (heroIsPunished()) {
        await unplaceBallAndChain();
        await placeBallAndChain();
    }
    await docrt();
    await flush_screen(1);
    await deliverSpecialLevelMessages();
    await checkSpecialRoom();
    // C cmd.c:makemap_prepost(FALSE) checkpoints the replacement level.
    if (game.flags.checkpoint ?? true) rewindEngravingsForSave(game.level);
}

// C refs: wizcmds.c:wiz_map() and detect.c:do_mapping().  This is a
// zero-time debug reveal: it maps traps and engravings first, then maps every
// background square from all directions while preserving secret doors and
// revealing secret corridors.
export async function wizMap() {
    if (!game.flags?.debug) {
        await pline('Unavailable command.');
        game.context.move = 0;
        return;
    }

    const savedConfusion = game.u?.confusionTurns ?? 0;
    const savedHallucination = game.u?.hallucinationTurns ?? 0;
    try {
        // C wiz_map() blocks notices before clearing the senses and
        // mapping traps, and re-enables them after do_mapping() returns.
        await withMonsterNoticesBlocked(game, async () => {
            game.u.confusionTurns = 0;
            game.u.hallucinationTurns = 0;
            for (const trap of requireGameLevel().traps) {
                trap.tseen = true;
                await map_trap(trap, true);
            }
            for (const engraving of requireGameLevel().engravings ?? [])
                await map_engraving(engraving, true);
            await mapMagicLevel({ confused: false });
        });
    } finally {
        game.u.confusionTurns = savedConfusion;
        game.u.hallucinationTurns = savedHallucination;
    }
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay?.clearRow(0);
    game.nhDisplay?.setCursor(game.u.ux - 1, game.u.uy + 1);
    game.context.move = 0;
    await bot();
}


async function wizardIdentifyDescription(item: GameObject, primaryHandDetail: string | null): Promise<string> {
    const override = game.iflags.override_ID;
    game.iflags.override_ID = true;
    try {
        return await inventoryItemDescription(item, { primaryHandDetail });
    } finally {
        if (override === undefined) delete game.iflags.override_ID;
        else game.iflags.override_ID = override;
    }
}

// C wizcmds.c:wiz_identify() delegates to display_inventory() with
// iflags.override_ID set.  Fully identified inventories still open a short
// PICK_NONE menu; the command does not collapse into a topline message.
export async function wizIdentify(): Promise<void> {
    if (!game.inventory.length) {
        await pline('Not carrying anything.');
        game.context.move = 0;
        return;
    }
    if (game.flags.fixinv === false) reassignInventoryLetters();
    // display_pickinv() sorts the whole inventory before omitting fully
    // identified objects. Wizard naming also applies during the sort, so
    // alphabetization uses the names the menu reveals without discovering them.
    const override = game.iflags.override_ID;
    game.iflags.override_ID = true;
    let ordered: GameObject[];
    try {
        ordered = sortObjects(game.inventory, { mode: inventorySortMode() });
    } finally {
        if (override === undefined) delete game.iflags.override_ID;
        else game.iflags.override_ID = override;
    }
    const unidentified = ordered.filter(objectNeedsFullIdentification);
    if (!unidentified.length) {
        await showTextMenuOverlay([
            'Debug Identify',
            '(all items are permanently identified already)',
        ]);
        game.context.move = 0;
        return;
    }

    const allKey = game.commandBindings.keyForCommand('wizidentify') || 9;
    const window = tty_create_nhwindow<GameObject | 'all'>(NHW_MENU);
    let selected: (GameObject | 'all')[];
    try {
        await tty_start_menu(window);
        tty_add_menu(window, {
            identifier: null,
            text: `Debug Identify -- unidentified or partially identified item${
                unidentified.length === 1 ? '' : 's'}`,
        });
        tty_add_menu(window, {
            identifier: 'all', selector: '_', group: String.fromCharCode(allKey),
            itemflags: MENU_ITEMFLAGS_SKIPINVERT,
            text: `select ${unidentified.length === 1
                ? 'it' : 'any or all of them'} to permanently identify${
                unidentified.length === 1 ? '' : ` (${visibleCommandKey(allKey)} for all)`}`,
        });
        let previousClass: number | null = null;
        for (const item of unidentified) {
            if (game.flags.sortpack !== false && item.oclass !== previousClass)
                addMenuHeading(window, objectClassHeading(item.oclass));
            previousClass = item.oclass;
            observeObjectForNaming(item);
            // C invent.c:display_pickinv() derives each row's obj_to_glyph()
            // menu metadata from the display RNG before doname(), which
            // shifts the hallucination stream one draw per listed row.
            consumeHallucinatedMenuObjectGlyph(item);
            tty_add_menu(window, {
                identifier: item, selector: inventoryCommandLetter(item),
                group: OBJECT_CLASS_SYMBOLS[item.oclass] ?? '',
                text: await wizardIdentifyDescription(item, inventoryPrimaryHandDetail(item)),
            });
        }
        tty_end_menu(window);
        const result = await tty_select_menu(window, PICK_ANY);
        selected = result.selections.map(selection => selection.identifier);
    } finally {
        await tty_destroy_nhwindow(window);
    }
    if (selected.includes('all')) {
        await identifyPack(0);
        game.context.move = 0;
        return;
    }
    for (const item of selected) {
        if (item === 'all') continue;
        const learnedType = !objectTypeKnown(item);
        fullyIdentifyObject(item);
        if (learnedType) await exerciseAttribute(A_WIS, true);
        observeObjectForNaming(item);
        await plineWithContinuation(
            `${item.invlet} - ${await inventoryItemDescription(item, {
                primaryHandDetail: inventoryPrimaryHandDetail(item),
            })}.`,
        );
    }
    game.context.move = 0;
}

// C wizcmds.c:wiz_flip_level(): transpose a live map without taking a turn.
export async function wizFlipLevel(): Promise<void> {
    if (game.flags.debug) {
        const { answer } = await yn_function(
            'Flip 0=randomly, 1=vertically, 2=horizontally, 3=both:', '0123');
        if (answer && '0123'.includes(answer)) {
            if (answer === '0') await flipSpecialLevelRandom(3, true);
            else await flipSpecialLevel(Number(answer), true);
            await docrt();
        } else await plineWithContinuation('Never mind.');
    }
    game.context.move = 0;
}

// C wizcmds.c:wiz_panic()/wiz_fuzzer(). Both confirmations take no time.
export async function wizPanic(): Promise<void> {
    requirePlayingGame(game);
    if (game.iflags.debug_fuzzer) {
        game.u.uhp = game.u.uhpmax = 1000;
        game.u.uen = game.u.uenmax = 1000;
    } else if (await paranoidQuery(true, 'Do you want to call panic() and end your game?')) {
        await panic('Crash test (#panic).');
    }
    game.context.move = 0;
}

export async function wizFuzzer(): Promise<void> {
    if (!fuzzerWarningSuppressed()) {
        await plineWithContinuation('The fuzz tester will make NetHack execute random keypresses.');
        await plineWithContinuation('There is no conventional way out of this mode.');
    }
    if (await paranoidQuery(true, 'Do you want to start fuzz testing?')) {
        const answer = await promptYesNo('Do you want to call panic() after impossible()?');
        game.flags.debug_fuzzer = answer === 'n' ? FUZZER_IMPOSSIBLE_CONTINUE : FUZZER_IMPOSSIBLE_PANIC;
        game.iflags.debug_fuzzer = true;
    }
    game.context.move = 0;
}

function fuzzerWarningSuppressed(): boolean {
    const version = game.flags.suppress_alert?.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!version) return false;
    const major = Number(version[1]), minor = Number(version[2]);
    return major > 3 || major === 3 && minor >= 7;
}

// C wizcmds.c:wiz_show_seenv().
export async function showSeenVectors(): Promise<void> {
    const level = requireGameLevel();
    const hero = game.u;
    let start = Math.max(1, hero.ux - Math.floor(COLNO / 4));
    const stop = Math.min(start + Math.floor(COLNO / 2), COLNO);
    if (stop - start === Math.floor(COLNO / 2)) start++;
    const lines: string[] = [];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = start; x < stop; x++) {
            const seen = level.requireAt(x, y).seenv & 0xff;
            row += x === hero.ux && y === hero.uy ? '@@'
                : seen ? seen.toString(16).padStart(2, '0') : '  ';
        }
        lines.push(row.trimEnd());
    }
    await showInspection(lines);
}

// C wizcmds.c:wiz_show_vision().
export async function showVisionFlags(): Promise<void> {
    const hero = game.u;
    const lines = [`Flags: 0x${COULD_SEE.toString(16)} could see, 0x${IN_SIGHT.toString(16)} in sight, 0x${TEMP_LIT.toString(16)} temp lit`, ''];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = 1; x < COLNO; x++) {
            const flags = game.viz_array?.[y]?.[x] ?? 0;
            row += x === hero.ux && y === hero.uy ? '@' : flags ? String(flags) : ' ';
        }
        lines.push(row.trimEnd());
    }
    await showInspection(lines);
}

// C wizcmds.c:wiz_show_wmodes().
export async function showWallModes(): Promise<void> {
    const level = requireGameLevel();
    const hero = game.u;
    // tty's initial blank line aligns these rows with the normal map.
    const lines = [''];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = 1; x < COLNO; x++) {
            const location = level.requireAt(x, y);
            row += x === hero.ux && y === hero.uy ? '@'
                : IS_WALL(location.typ) || location.typ === SDOOR ? String(location.wall_info & WM_MASK)
                    : location.typ === CORR ? '#'
                        : IS_ROOM(location.typ) || IS_DOOR(location.typ) ? '.' : 'x';
        }
        lines.push(row);
    }
    await showInspection(lines);
}

async function showInspection(lines: readonly string[]): Promise<void> {
    await displayMessageWindow();
    await showTextWindow(lines);
    game.context.move = 0;
}

// C wizcmds.c:wiz_map_levltyp()/wiz_levltyp_legend(), cmd.c:levltyp[].
const TERRAIN_NAMES = [
    'stone', 'vertical wall', 'horizontal wall', 'top-left corner wall',
    'top-right corner wall', 'bottom-left corner wall', 'bottom-right corner wall',
    'cross wall', 'tee-up wall', 'tee-down wall', 'tee-left wall', 'tee-right wall',
    'drawbridge wall', 'tree', 'secret door', 'secret corridor', 'pool', 'moat',
    'water', 'drawbridge up', 'lava pool', 'lava wall', 'iron bars', 'door',
    'corridor', 'room', 'stairs', 'ladder', 'fountain', 'throne', 'sink', 'grave',
    'altar', 'ice', 'drawbridge down', 'air', 'cloud', 'unreachable/undiggable',
] as const;

// C wizcmds.c:wiz_map_levltyp().
export async function showTerrainCodes(): Promise<void> {
    const level = requireGameLevel();
    // tty leaves row zero blank so map rows line up with the normal display.
    const lines = [''];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = 1; x < COLNO; x++) {
            const terrain = level.requireAt(x, y).typ;
            row += terrain === STONE && !mayDig(x, y) ? '*' : terrainCode(terrain);
        }
        if (level.requireAt(0, y).typ !== STONE || mayDig(0, y)) row += '!';
        lines.push(row);
    }
    lines.push(terrainLevelDescription().slice(0, COLNO - 1));
    await showTerrainText(lines);
}

// C wizcmds.c:wiz_levltyp_legend().
export async function showTerrainCodeLegend(): Promise<void> {
    const lines = ['#terrain encodings:', ''];
    const half = TERRAIN_NAMES.length / 2;
    const entry = (index: number): string => {
        const name = TERRAIN_NAMES[index];
        if (name === undefined) throw new RangeError(`Terrain legend has no entry ${index}`);
        const code = name.startsWith('unreachable') ? '*' : terrainCode(index);
        return ` ${code} - ${name.padEnd(28)}`;
    };
    for (let index = 0; index < half; index++)
        lines.push(entry(index) + entry(index + half));
    await showTerrainText(lines);
}

async function showTerrainText(lines: readonly string[]): Promise<void> {
    await displayMessageWindow();
    await showTextWindow(lines);
}

function terrainCode(terrain: number): string {
    return String.fromCharCode(terrain < 10 ? 48 + terrain
        : terrain < 36 ? 97 + terrain - 10 : 65 + terrain - 36);
}

function terrainLevelDescription(): string {
    const flags = requireGameLevel().flags;
    const here = game.u.uz;
    if (!here) throw new Error('Terrain inspection requires the current dungeon level');
    const parts = [`D:${here.dnum},L:${here.dlevel}`];
    const special = [...(game.specialLevels?.entries() ?? [])]
        .find(([, location]) => sameDungeonLevel(here, location));
    if (special) {
        parts.push(`"${specialDisplayName(special[0])}"`);
        // The pinned dungeon.lua sets only town and roguelike on special levels.
        if (special[1].flags.town) parts.push('town');
        if (Is_rogue_level(here)) parts.push('roguelike');
    }
    if (flags.nfountains) parts.push(`${MAP_SYMBOLS[CmapSymbol.fountain]?.ch}:${flags.nfountains}`);
    if (flags.nsinks) parts.push(`${MAP_SYMBOLS[CmapSymbol.sink]?.ch}:${flags.nsinks}`);
    const features: ReadonlyArray<readonly [boolean | undefined, string]> = [
        [flags.has_vault, 'vault'], [flags.has_shop, 'shop'],
        [flags.has_temple, 'temple'], [flags.has_court, 'throne'],
        [flags.has_zoo, 'zoo'], [flags.has_morgue, 'morgue'],
        [flags.has_barracks, 'barracks'], [flags.has_beehive, 'hive'],
        [flags.has_swamp, 'swamp'], [flags.noteleport, 'noTport'],
        [flags.hardfloor, 'noDig'], [flags.nommap, 'noMMap'],
        [!flags.hero_memory, 'noMem'], [flags.shortsighted, 'shortsight'],
        [flags.graveyard, 'graveyard'], [flags.is_maze_lev, 'maze'],
        [flags.is_cavernous_lev, 'cave'], [flags.arboreal, 'tree'],
        [flags.sokoban_rules, 'sokoban-rules'], [Invocation_lev(here), 'invoke'],
        [levelIsWizardTower(), 'tower'],
    ];
    for (const [enabled, label] of features) if (enabled) parts.push(label);
    parts.push(terrainBranchName());
    return parts.join(' ');
}

function terrainBranchName(): string {
    const here = game.u.uz;
    if (!here) throw new Error('Terrain inspection requires the current dungeon level');
    if (here.dnum === 0) return 'dungeon';
    if (In_mines(here)) return 'mines';
    if (In_sokoban(here)) return 'sokoban';
    if (In_quest(here)) return 'quest';
    if (Is_knox_level(here)) return 'ludios';
    if (here.dnum === 1) return 'gehennom';
    if (In_V_tower(here)) return 'vlad';
    if (In_endgame(here)) return 'endgame';
    return (game.dungeons[here.dnum]?.dname || 'unknown').replace(/^the /i, '');
}

// C wizcmds.c:wiz_smell(). The command can sniff visible or unseen actors
// repeatedly, and updates remembered invisible markers without taking time.
export async function wizSmell(): Promise<void> {
    requirePlayingGame(game);
    game.context.move = 0;
    if (!heroHasOlfaction(game)) {
        await plineWithContinuation('You are incapable of detecting odors in your present form.');
        return;
    }
    await plineWithContinuation('You can move the cursor to a monster that you want to smell.');
    let cursor: Position = { x: game.u.ux, y: game.u.uy };
    for (;;) {
        await plineWithContinuation('Pick a monster to smell.');
        const tipShown = await showGetposTip();
        if (game.flags.verbose) {
            const helpKey = game.commandBindings.specialKey('getpos.help');
            if (helpKey === undefined) throw new Error('Smell targeting requires a getpos.help binding');
            await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
        }
        if (tipShown) await plineWithContinuation('Move cursor to a monster:');
        const target = await selectMapPosition({
            start: cursor, goal: 'a monster',
            prompt: game._pending_message,
        });
        if (!target) return;
        cursor = target;
        const atHero = cursor.x === game.u.ux && cursor.y === game.u.uy;
        const monster = atHero ? game.u.usteed : monsterAtPosition(game.level, cursor.x, cursor.y);
        const self = atHero && !monster;
        const species = self ? heroSpecies(game) : monster?.mnum;
        const glyph = glyphAt(cursor.x, cursor.y);
        if (species === undefined) {
            await plineWithContinuation("You don't smell any monster there.");
            if (glyph?.kind === 'invisible') await unmap_invisible(cursor.x, cursor.y);
            continue;
        }
        if (self)
            await plineWithContinuation(`You surreptitiously sniff under your ${heroArmName(game)}.`);
        if (!await smellUnseenMonster(species, game))
            await plineWithContinuation(`${self ? 'You seem' : 'That monster seems'} to not give off any smell.`);
        if (glyph?.kind !== 'monster') await map_invisible(cursor.x, cursor.y);
    }
}

// C wizcmds.c:wiz_intrinsic(), with menu order from timeout.c:propertynames.
interface WizardIntrinsic {
    readonly name: string;
    readonly property: PropertyName;
}

// Hallucination resistance is deliberately omitted: native wiz_intrinsic
// excludes the exceptional property used by Grayswandir.
const INTRINSICS: readonly WizardIntrinsic[] = [
    { name: 'invulnerable', property: 'invulnerable' },
    { name: 'petrifying', property: 'stoned' },
    { name: 'becoming slime', property: 'slimed' },
    { name: 'strangling', property: 'strangled' },
    { name: 'fatally sick', property: 'sick' },
    { name: 'stunned', property: 'stunned' },
    { name: 'confused', property: 'confusion' },
    { name: 'hallucinating', property: 'hallucination' },
    { name: 'blinded', property: 'blinded' },
    { name: 'deafness', property: 'deaf' },
    { name: 'vomiting', property: 'vomiting' },
    { name: 'slippery fingers', property: 'glib' },
    { name: 'wounded legs', property: 'woundedLegs' },
    { name: 'sleepy', property: 'sleepy' },
    { name: 'teleporting', property: 'teleportation' },
    { name: 'polymorphing', property: 'polymorph' },
    { name: 'levitating', property: 'levitation' },
    { name: 'very fast', property: 'fast' },
    { name: 'clairvoyant', property: 'clairvoyant' },
    { name: 'monster detection', property: 'detectMonsters' },
    { name: 'see invisible', property: 'seeInvisible' },
    { name: 'invisible', property: 'invisible' },
    { name: 'acid resistance', property: 'acidResistance' },
    { name: 'stoning resistance', property: 'stoneResistance' },
    { name: 'displaced', property: 'displaced' },
    { name: 'pass thru walls', property: 'passesWalls' },
    { name: 'magical breathing', property: 'magicalBreathing' },
    { name: 'water walking', property: 'waterWalking' },
    { name: 'fire resistance', property: 'fireResistance' },
    { name: 'cold resistance', property: 'coldResistance' },
    { name: 'sleep resistance', property: 'sleepResistance' },
    { name: 'disintegration resistance', property: 'disintegrationResistance' },
    { name: 'shock resistance', property: 'shockResistance' },
    { name: 'poison resistance', property: 'poisonResistance' },
    { name: 'drain resistance', property: 'drainResistance' },
    { name: 'sickness resistance', property: 'sicknessResistance' },
    { name: 'magic resistance', property: 'antimagic' },
    { name: 'light-induced blindness resistance', property: 'blindResistance' },
    { name: 'fumbling', property: 'fumbling' },
    { name: 'voracious hunger', property: 'hunger' },
    { name: 'telepathic', property: 'telepathy' },
    { name: 'warning', property: 'warning' },
    { name: 'warn: monster type or class', property: 'warnOfMonster' },
    { name: 'warn: undead', property: 'warnUndead' },
    { name: 'searching', property: 'searching' },
    { name: 'infravision', property: 'infravision' },
    { name: 'adorned (+/- Cha)', property: 'adorned' },
    { name: 'stealthy', property: 'stealth' },
    { name: 'monster aggravation', property: 'aggravateMonster' },
    { name: 'conflict', property: 'conflict' },
    { name: 'jumping', property: 'jumping' },
    { name: 'teleport control', property: 'teleportControl' },
    { name: 'flying', property: 'flying' },
    { name: 'swimming', property: 'swimming' },
    { name: 'slow digestion', property: 'slowDigestion' },
    { name: 'half spell damage', property: 'halfSpellDamage' },
    { name: 'half physical damage', property: 'halfPhysicalDamage' },
    { name: 'HP regeneration', property: 'regeneration' },
    { name: 'energy regeneration', property: 'energyRegeneration' },
    { name: 'extra protection', property: 'protection' },
    { name: 'protection from shape changers', property: 'protectionFromShapeChangers' },
    { name: 'polymorph control', property: 'polymorphControl' },
    { name: 'unchanging', property: 'unchanging' },
    { name: 'reflecting', property: 'reflection' },
    { name: 'free action', property: 'freeAction' },
    { name: 'fixed abilities', property: 'sustainAbility' },
    { name: 'life will be saved', property: 'lifeSaving' },
];

export async function wizIntrinsic(): Promise<void> {
    const state = requireInitializedGame();
    const items = INTRINSICS.map(intrinsic => {
        const timeout = propertyTimeout(intrinsic.property, state);
        return {
            text: timeout ? `${intrinsic.name.padEnd(27)} [${timeout}]` : intrinsic.name,
            value: intrinsic,
            separatorBefore: intrinsic.property === 'fireResistance',
        };
    });
    const selections = await showMultiSelectWindow({
        title: 'Which intrinsics?',
        introLines:
            state.flags.cmdassist !== false
                ? ['[Precede any selection with a count to increment by other than 30.]']
                : [],
        sections: [{ heading: '', items }],
        omitHeadings: true,
        pageLocalKeys: true,
        returnCounts: true,
    });

    // Dismissing a full-screen menu redraws vision and can announce a
    // monster. Keep that notice ahead of the intrinsic feedback.
    state.context.move = 0;
    for (const { value, count } of selections) {
        // tty stores a long count; wiz_intrinsic explicitly narrows it to int.
        const amount = count === -1 ? 30 : count | 0;
        if (amount <= 0) continue;
        await increaseIntrinsic(value, amount, state);
        if (state.program_state.gameover) return;
    }
    await docrt();
}

async function increaseIntrinsic(
    { name, property }: WizardIntrinsic,
    amount: number,
    state: PlayingGameState,
): Promise<void> {
    const oldTimeout = propertyTimeout(property, state);
    const keepsDeadline = property === 'sick' || property === 'slimed' || property === 'stoned';
    const newTimeout = keepsDeadline && oldTimeout > 0 ? oldTimeout : oldTimeout + amount;

    if (property === 'blinded') {
        await makeBlinded(newTimeout, { state });
    } else if (property === 'deaf') {
        await makeDeaf(newTimeout, { state });
    } else if (property === 'hallucination') {
        await makeHallucinated(newTimeout, { state });
    } else if (property === 'sick') {
        await startHeroSickness({
            state,
            turns: newTimeout,
            cause: '#wizintrinsic',
            type: rn2(2) === 0 ? SICK_VOMITABLE : SICK_NONVOMITABLE,
        });
    } else if (property === 'slimed') {
        await setHeroSlimingTimeout(newTimeout, {
            state,
            message: `You are${oldTimeout ? ' still' : ''} turning into slime.`,
        });
    } else if (property === 'stoned') {
        await setHeroPetrificationTimeout(newTimeout, {
            state,
            message: `You are${oldTimeout ? ' still' : ''} turning into stone.`,
            killer: '#wizintrinsic',
            killerFormat: KILLED_BY,
        });
    } else if (property === 'stunned') {
        await makeStunned(newTimeout, { state });
    } else if (property === 'vomiting') {
        startHeroVomiting({ state, turns: newTimeout });
        await plineWithContinuation(`You are${oldTimeout ? ' still' : ''} vomiting.`);
    } else {
        if (property === 'warnOfMonster' && !propertyIsActive(property, state)) {
            const speciesidx = MONSTER_NAME.indexOf('grid bug');
            if (speciesidx < 0) throw new Error('The native grid bug species is missing');
            const warning = (state.context.warntype ||= { obj: 0, polyd: 0, speciesidx: -1 });
            warning.speciesidx = speciesidx;
        }
        if (property === 'glib') setSlipperyHands(newTimeout, state);
        else setPropertyTimeout(property, newTimeout, state);
        state.context.botl = true;
        await plineWithContinuation(
            `Timeout for ${name} ${oldTimeout ? 'increased by' : 'set to'} ${amount}.`,
        );
    }

    if (property === 'levitation' || property === 'flying') refreshMovementProperties(state);
    else if (property === 'protectionFromShapeChangers') await restoreNaturalMonsterShapes(state);
    if (
        (property === 'waterWalking' || property === 'levitation' || property === 'flying') &&
        state.u.uinwater
    )
        // C wizcmds.c:1087 pooleffects(FALSE): any relocation out of the
        // liquid lands through teleds()' spoteffects(TRUE) (teleport.c:568),
        // which applyHeroLiquidEffects() supplies.
        await applyHeroLiquidEffects();
}

// C wizcmds.c:wiz_rumor_check(), which calls rumors.c:rumor_check().
export async function wizRumorCheck(): Promise<void> {
    game.context.move = 0;
    await rumorCheck();
    game._pending_message = '';
    game._retained_message = '';
}

// C wizcmds.c:wiz_migrate_mons()/list_migrating_mons(). A negative count
// moves existing actors; a positive count creates random actors to migrate.
export async function wizMigrateMonsters(): Promise<void> {
    requirePlayingGame(game);
    const destination = nextMigrationLevel();
    await listMigratingMonsters(destination);
    game.context.move = 0;
    if (!(destination.dnum || destination.dlevel)) {
        await plineWithContinuation("Can't get there from here.");
        return;
    }
    const input = await getLine('How many random monsters to migrate to next level? [0]', ch => ch >= ' ');
    if (!input) return;
    const count = Number.parseInt(input, 10) || 0;
    const limit = Math.min(Math.abs(count), (COLNO - 1) * ROWNO);
    for (let index = 0; index < limit; index++) {
        // makemon appends here; native fmon prepends each new monster.
        const monster = count < 0 ? game.level.monsters.at(-1)
            : await makemonAt(rndmonstAdj(), 0, 0, MM_NOMSG);
        if (monster) await migrateMonsterOffLevel(monster, game, { dst: destination }, { kind: 'level-migration' });
    }
}

function nextMigrationLevel(): DungeonLocation {
    requirePlayingGame(game);
    if (Is_stronghold(game.u.uz)) {
        if (!game.valley_level) throw new Error('The Castle has no Valley destination');
        return game.valley_level;
    }
    return Is_botlevel(game.u.uz) ? { dnum: 0, dlevel: 0 }
        : levelAtDepth(depth(game.u.uz) + 1);
}

type MigrationGroup = 'c' | 'n' | 'o';

function migrationGroup(monster: Monster, next: DungeonLocation): MigrationGroup {
    const destination = monster.migrationDestination;
    if (destination?.dnum === game.u.uz?.dnum && destination?.dlevel === game.u.uz?.dlevel) return 'c';
    if (destination?.dnum === next.dnum && destination?.dlevel === next.dlevel) return 'n';
    return 'o';
}

// C wizcmds.c:list_migrating_mons().
// C wizcmds.c:migrsort_cmp().
async function listMigratingMonsters(next: DungeonLocation): Promise<void> {
    const monsters = game._migratingMonsters ?? [];
    if (!monsters.length) {
        await plineWithContinuation('No monsters currently migrating.');
        return;
    }
    const counts = { c: 0, n: 0, o: 0 };
    for (const monster of monsters) counts[migrationGroup(monster, next)]++;
    await plineWithContinuation(`${counts.c} mon${counts.c === 1 ? '' : 's'} pending for current level, ${counts.n} for next level, ${counts.o} for others.`);
    const visible = `${counts.c ? 'c' : ''}${counts.n ? 'n' : ''}${counts.o ? 'o' : ''}a q`;
    const choice = await promptChoice('List which?', ['c', 'n', 'o', 'a', 'q'], 'q', { visibleChoices: visible });
    if (choice === 'q') return;
    const selected = monsters.filter(monster => choice === 'a' || migrationGroup(monster, next) === choice);
    if (!selected.length) {
        await plineWithContinuation('None.');
        return;
    }
    selected.sort((a, b) => (a.migrationDestination?.dnum ?? 0) - (b.migrationDestination?.dnum ?? 0)
        || (a.migrationDestination?.dlevel ?? 0) - (b.migrationDestination?.dlevel ?? 0)
        || a.m_id - b.m_id);
    const title = choice === 'a' ? 'All migrating monsters:'
        : `Monster${selected.length === 1 ? '' : 's'} migrating to ${choice === 'c' ? 'current level'
            : choice === 'n' ? 'next level' : "'other' levels"}:`;
    await showTextWindow([title, '', ...selected.map(monster => migratingMonsterLine(monster, choice === 'a' || choice === 'o'))]);
}

function migratingMonsterLine(monster: Monster, showDestination: boolean): string {
    let text = `  ${monster.mtame ? 'tame ' : monster.mpeaceful ? 'peaceful ' : ''}${monsterTypeName(monster.mnum, !!monster.female)}`;
    if (monster.cham !== undefined && monster.cham >= 0)
        text += `{${monsterTypeName(monster.cham, !!monster.female)}}`;
    const name = MGIVENNAME(monster);
    if (name) text += ` named ${name}`;
    if (showDestination) {
        const destination = monster.migrationDestination;
        if (!destination) throw new Error(`Migrating monster ${monster.m_id} has no destination`);
        text += ` to ${destination.dnum}:${destination.dlevel}`;
    }
    if (monster.migrationMode === MIGR_EXACT_XY && monster.migrationSource)
        text += ` at <${monster.migrationSource.x},${monster.migrationSource.y}>`;
    return text;
}

// C wizcmds.c:wiz_custom()/wizcustom_callback(), glyphs.c:wizcustom_glyphids().
export async function wizCustom(): Promise<void> {
    const window = tty_create_nhwindow<number>(NHW_MENU);
    addMenuHeading(window, '    glyph  glyph identifier                             sym   clr customcolor unicode utf8');
    const rogue = Is_rogue_level(game.u.uz);
    // reset_glyphmap() also clears Rogue colors unless its active set enables IBM color.
    const colorEnabled = game.flags.color !== false
        && (!rogue || rogueColorsActive());
    for (const glyph of customizedGlyphs()) {
        const byte = glyph.symbol.kind === 'cmap' ? cmapSymbolByte(glyph.symbol.index)
            : objectClassSymbol(glyph.symbol.oclass).charCodeAt(0);
        const baseColor = rogue ? glyph.rogueColor : glyph.baseColor;
        const color = colorEnabled ? baseColor : NO_COLOR;
        const customColor = glyph.customColor.toString(16).padStart(11, '0');
        const unicode = glyph.unicode === null ? ''
            : `U+${glyph.unicode.toString(16).padStart(4, '0')}`
                + [...new TextEncoder().encode(String.fromCodePoint(glyph.unicode))]
                    .map(byte => ` <${byte}>`).join('');
        const text = `[${String(glyph.glyph).padStart(4, '0')}] ${glyph.id.padEnd(44)} `
            + `'\\${String(byte).padStart(3, '0')}' ${String(color).padStart(2, '0')} ${customColor} ${unicode}`;
        tty_add_menu(window, { identifier: glyph.glyph + 1, text });
    }
    // The xterm-256color terminal profile advertises 256 available colors.
    tty_end_menu(window, `#wizcustom: colorcount=256 ${symsetMenuValue()}`);
    await tty_select_menu(window, PICK_NONE);
    await tty_destroy_nhwindow(window);
    await docrt();
    game.context.move = 0;
}
