import { DIRECTION_HANDLERS, INITIAL_COMMAND_BINDINGS, NATIVE_COMMAND_CONSTANTS, NATIVE_COMMAND_FLAGS, NATIVE_COMMAND_PROFILE, NATIVE_COMMANDS, NATIVE_SPECIAL_KEYS } from './command_data.js';
import { doapply, dorub, dojump, useUnicornHorn, continueTrapSetting, resetTrapSetting, bringLeashedFollowers } from './apply.js';
import { doname, monsterName } from './do_name.js';
import { doannotate, doDungeonOverview, recordMappedOverviewState } from './dungeon.js';
import { dochat } from './ambient_sounds.js';
import { doloot, pickupAtHero, tipCommand, autopickupAtHero } from './pickup.js';
import { doinvoke } from './artifacts.js';
import { doChronicle, doGenocided, doVanquished, doattributes, doconduct } from './insight.js';

import { doturn, dopray, dosacrifice } from './pray.js';
import { dipInto, dodip, quaff } from './potion.js';
import { doclose, doopen, continuePicking, continueForceLock, doforce, resetPick } from './lock.js';
import { moveIntoFailedUntrap, doUntrap, climbOutOfPit, triggerHeroTrapAt } from './trap.js';
import { askTeleportDestination, teleportAtWillCommand, wizardTeleportCommand } from './teleport.js';
import { adjustSplit, doadjust, doPermanentInventory, ddoinv, dolook } from './invent.js';
import type { InventoryAction } from './invent.js';
import { CLICK_1, CLICK_2, xdir, ydir, ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME, PARANOID_QUIT, STAIRS, THRONE, ESCAPED, VIBRATING_SQUARE, COLNO, ROWNO, SCORR, DOOR, FOUNTAIN, SINK, D_CLOSED, D_LOCKED, PIT, SPIKED_PIT, TT_PIT, HOLE, TRAPDOOR, Is_airlevel, Is_waterlevel, Is_valley, W_ARMOR, W_ACCESSORY, ALTAR, BOLT_LIM, DIRECTION_KEYS, DIR_W, D_ISOPEN, GFILTER_VIEW, GLOC_DOOR, GLOC_INTERESTING, IS_DOOR, IS_ROOM, LOOK_ONCE, LOOK_QUICK, MENU_ITEMFLAGS_SELECTED, NHW_MENU, N_DIRS, PICK_ANY, PICK_ONE, ROOMOFFSET, TER_FULL, TER_MAP, TER_OBJ, TER_TRP, Upolyd, zdir, CORR, IS_STWALL, IS_TREE, IS_WATERWALL, LAVAWALL, IRONBARS, SDOOR, DRAWBRIDGE_UP, QBUFSZ, PARANOID_CONFIRM } from './const.js';
import { queueCommandResponses, clearCommandKeys, nhgetch, queueCommandKeys, takeCommandResponse, MAP_CLICK_KEY, inputGate } from './input.js';

import { showSeenVectors, showTerrainCodeLegend, showTerrainCodes, showVisionFlags, showWallModes, wizCustom, wizDetect, wizFlipLevel, wizFuzzer, wizGenesis, wizIdentify, wizIntrinsic, wizKill, wizLevelChange, wizLevelTeleport, wizMigrateMonsters, wizMakeMap, wizMap, wizPanic, wizPolyself, wizRumorCheck, wizShowNhuuid, wizSmell, wizTelekinesis, wizWhere, wizWish } from './wizcmds.js';
import { wizBury, continueHeroDigging } from './dig.js';
import { wizTimeoutQueue } from './timeout.js';
import type { GameState } from './game_state.js';
import type { HeroOccupation } from './occupation_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';
import { continueSpellbookStudy } from './spell.js';
import { clearMessageWindow, flushPendingTopline, putMessageHistory, renderKeyPrompt } from './tty_topline.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { surfaceName } from './terrain_name.js';
import { doquickwhatis, dohelp, dowhatis, identifyTrap, lookatDescription, whatDoesCommand, displayHelpFile, describeMapLocation, farlookLocationDescription, screenDescription } from './pager.js';
import { attackHostileMonster } from './uhitm.js';
import { monsterAtPosition, doride, stuckSteed, monsterSaddle } from './steed.js';
import { withIndefiniteArticle, observeObjectForNaming } from './objnam.js';
import { descendFromLevitation } from './levitation_commands.js';
import { endVoluntaryMultiTurn, TRAVEL_DIRECTIONS, heroTestMove, applyHeroLiquidEffects, domove, threateningMonsterNearby, arriveTravel, captureRunmodeDelay, stopRun, nearCapacity, SLT_ENCUMBER, showGetposTip, shouldShowGetposTip } from './hack.js';
import { propertyIsActive } from './properties.js';
import { gotoLevel } from './level_change.js';
import { inventoryReport } from './invent.js';
import {isContainer} from './mkobj.js';

import { doOptions, toggleBooleanOptionPrefix } from './options.js';
import type { CommandDefinition } from './command_data.js';
import type { CommandBindings } from './command_bindings.js';
import { stopHeroOccupation } from './occupation.js';
import { resetBulkTakeoff, dowear, doputon, removeWornItem, continueBulkTakeoff, takeOffAll } from './do_wear.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';

import { autoDescribePosition, selectTravelMenuPosition, showGetposInstructions, selectMapPosition, gatherLocsInteresting, glyphToCmapSymbol, knownVibratingSquareAt } from './getpos.js';
import { completeExtendedCommand, getLine, promptChoice, tty_yn_function } from './query.js';
import { paintKeyPrompt, promptKey } from './tty_prompts.js';
import { showTextWindow, addMenuHeading, showChoiceWindow, showMultiSelectWindow, showTextPages } from './windows.js';
import { NO_COLOR } from './terminal.js';
import type { TerminalCell } from './terminal.js';
import { promptYesNo } from './query.js';
import { flush_screen, docrt, canSpotMonster, glyphAt } from './display.js';
import { pline, plineWithContinuation, setTopline, pline_xy, set_msg_xy } from './pline.js';
import { messageWindowMode, CTRL_P, redotoplin, showMessageHistoryWindow, stepHistoryBack } from './prevmsg.js';
import { dozap } from './zap.js';
import { docast, dovspell, dowizcast } from './spell.js';
import { heroBreathAttack } from './zap.js';

import { useHeroBreath, heroSpitAttack, useHeroSpit, heroGazeAttack, useHeroGaze, useHeroWereSummon, chooseSpiderAbility, heroCanSpinWeb, useHeroWeb, heroCanMindBlast, useHeroMindBlast, heroCanRemovePunishment, useHeroNymphAbility, useHeroVampireShift, heroIsPolymorphed, heroCanChangeVampireShape } from './polyself.js';
import { monsterBreathAttack, performPetRangedAttack } from './dogmove.js';
import { heroCanSplitLikeGremlin, useHeroGremlinSplit } from './hero_gremlin.js';
import { heroCanShriek, useHeroShriek } from './hero_shriek.js';
import { heroCanSummonWerePack } from './were.js';
import { heroHasHidingAbility, useHeroHide } from './polyself.js';
import { heroCanUseUnicornHorn } from './unicorn_horn.js';
import { doread } from './read.js';
import { continueFoodMeal, doeat, continueTinOpening } from './eat.js';
import { doclassdisco, dodiscovered } from './o_init.js';
import { doextversion, NATIVE_VERSION } from './extversion.js';
import { dosearch } from './detect.js';
import { continueWipingFace, donull, dowipe, dodrop, monsterPreventsStairTravel, dropMultipleObjects } from './do.js';

import { setSecondaryWeapon, doready, doswapweapon, dotwoweapon, dowield } from './wield.js';
import { isPick } from './object_properties.js';
import { LOCK_PICK, CREDIT_CARD, SADDLE, POT_OIL, SKELETON_KEY, BOULDER } from './object_data.js';
import { MONSTER_MOVE, MONSTER_NAME, monsterSpeciesHidesOnCeiling, monsterCanBeSaddled } from './monster_data.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { dosave } from './save.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { dosit } from './sit.js';
import { continueEngraving, doengrave } from './engrave.js';
import { ledgerNo } from './hacklib.js';
import { finishTeleportArrival } from './location_effects.js';
import { doquit, finishHeroDeath } from './end.js';
import { doborn } from './insight.js';
import { applyPickAxeDirection } from './pick_axe.js';
import { dofire, dothrow } from './dothrow.js';
import { doenhance } from './skills.js';
import { objectTypeKnown, dopay } from './shk.js';
import { dokick } from './dokick.js';
import { rn1, rn2, rnd } from './rng.js';
import { FUZZER_IMPOSSIBLE_CONTINUE, impossible, paniclog } from './diagnostics.js';
import { heroCanReachFloor } from './engrave.js';
import { CmapSymbol, GlyphOffset } from './glyph_numbers.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu } from './tty_menu.js';
import { selection_floodfill, selection_getbounds, selection_getpoint, selection_new, selection_size_description } from './selvar.js';
import { floorObjectDescription } from './invent.js';
import { cansee, couldsee } from './vision.js';
import { blockingTerrain } from './mthrowu.js';
import { revealTerrain } from './terrain_view.js';
import { truncateRawMessage } from './pline_text.js';
import type { Selection } from './selvar.js';
import type { TtyPromptAnswer } from './query.js';
import type { CharacterInput, CommandDirection, InputState } from './input.js';
import type { Hero } from './hero_types.js';
import type { TextPage } from './windows.js';
// cmd.js — Command parsing and dispatch.
// C ref: cmd.c:rhack(); movement execution belongs to hack.ts.

export { getLine, promptYesNo, promptYesNoQuit } from './query.js';

// Direction deltas: y u k
//                   h . l
//                   b j n
type DirectionKey = 'h' | 'l' | 'j' | 'k' | 'y' | 'u' | 'b' | 'n';
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

function isMovementKey(ch: string): ch is DirectionKey {
    return ch.length === 1 && 'hjklyubn'.includes(ch);
}


// C cmd.c:isok() — x >= 1 && x <= COLNO-1 && y >= 0 && y <= ROWNO-1
export function isok(x: number, y: number): boolean {
    return x >= 1 && x <= COLNO - 1 && y >= 0 && y <= ROWNO - 1;
}
function configuredCommand(key: number): CommandBinding {
    key &= 255;
    if (key === 27) return { key, command: null, parameter: null };
    const binding = game.commandBindings.lookup(key);
    const executionKey = commandExecutionKey(binding?.command?.name);
    return {
        key: executionKey?.charCodeAt(0) ?? null,
        command: binding?.command ?? null,
        parameter: binding?.parameter ?? null,
    };
}

// C cmd.c:xytodir(): returns -1 (DIR_ERR) when the offsets
// match no direction, e.g. a zero offset; set_msg_dir then keeps the
// previous message location, matching dirtocoord().
export function xyToDirection(dx: number, dy: number): number {
    const direction = xdir.findIndex((x, index) => x === dx && ydir[index] === dy);
    return direction < 8 ? direction : -1;
}

// C cmd.c:dotravel_target() initializes travel before calling domove().
function startTravel(targetX: number, targetY: number, g: GameState = game): TravelRunState {
    g._runState = {
        mode: 8,
        targetX,
        targetY,
    };
    g.lastStrTurn = 0;
    g._travelTarget = { x: targetX, y: targetY };
    if (!g.multi) g.multi = Math.max(COLNO, ROWNO);
    g.context.run = 8;
    g.context.mv = true;
    g.context.travel = true;
    g.context.travel1 = true;
    g.context.nopick = true;
    return g._runState;
}

// C refs: cmd.c set_occupation()/timed_occupation() and
// allmain.c:moveloop_core().  A count-prefixed search executes once in
// rhack(), then repeats without reading another input key; each repetition is
// separated by the complete monster/global turn scheduler.
export async function continueCountedCommand(g: GameState = game): Promise<boolean> {
    if (!g._occupation) return false;
    g.context.move = 1;
    await continueOccupation(g);
    if (g.program_state.gameover) return false;
    g.context.move = 1;
    if (threateningMonsterNearby()) await stopHeroOccupation(g);
    return !g.program_state.gameover;
}

async function continueOccupation(g: GameState): Promise<boolean> {
    const occupation = g._occupation;
    if (!occupation) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'command') {
        g.context.move = 1;
        await runCommandHandler(occupation.binding);
        if (g.program_state.gameover) return false;
        g.context.move = 1;
        if (g.multi > 0) --g.multi;
        if (!(g.multi > 0)) g._occupation = null;
        return true;
    }
    if (occupation.key === 'dig') {
        const continuing = await continueHeroDigging(g);
        if (g.program_state.gameover) return false;
        if (!continuing) g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if (occupation.key === 'study-book') {
        const continuing = await continueSpellbookStudy({ state: g });
        if (g.program_state.gameover) return false;
        if (!continuing) g._occupation = null;
        return true;
    }
    if (occupation.key === 'force-lock') {
        return continueForceLock(occupation, g);
    }
    if (occupation.key === 'takeoff') {
        const continuing = await continueBulkTakeoff(g);
        if (!continuing) g._occupation = null;
        return continuing;
    }
    if (occupation.key === 'set-trap') {
        const continuing = await continueTrapSetting(g);
        if (!continuing) g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if ('remaining' in occupation && occupation.remaining <= 0) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'pick-lock') return continuePicking(occupation, g);
    if (occupation.key === 'eat-food') {
        return continueFoodMeal(occupation, g);
    }
    if (occupation.key === 'open-tin') {
        return continueTinOpening(occupation, g);
    }
    if (occupation.key === 'wipe-face') {
        return continueWipingFace(occupation, g);
    }
    if (occupation.key === 'engrave') {
        const continuing = await continueEngraving(g);
        if (g.program_state.gameover) return false;
        if (!continuing) g._occupation = null;
        g.context.move = 1;
        return true;
    }
    g._occupation = null;
    return false;
}

function prepareTimedCommand(binding: CommandBinding): void {
    const text = binding.command?.occupation;
    if (text && !game._occupation && game.multi) {
        game._occupation = { key: 'command', text, binding };
    }
}

// C cmd.c:set_occupation(). Installs the resumable occupation and its
// progress text; xtime is modelled by the occupation's own key.
export function setOccupation(occupation: HeroOccupation, g: GameState = game): void {
    g._occupation = occupation;
}

async function redrawCommand(): Promise<void> {
    await docrt();
    game.context.move = 0;
}

async function performWaitCommand(force = game.iflags.menu_requested) {
    if (!await donull(force, !!game.multi)) return;
    game.context.move = 1;
}

// C cmd.c:can_do_extcmd(). Admission precedes prefixes and handler setup.
async function commandAllowed(command: NativeCommand | null | undefined): Promise<boolean> {
    if (!command) return true;
    if (!await currentLuaLifecycle().runCallbacks(game, 'cmd_before', command.name))
        return false;
    if (!game.flags.debug && (command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD)) {
        await pline(`Unavailable command '${command.name}'.`);
        return false;
    }
    if (game.u.uburied && !(command.flags & NATIVE_COMMAND_FLAGS.IFBURIED)) {
        await pline("You can't do that while you are buried!");
        return false;
    }
    return !(game.iflags.debug_fuzzer
        && (command.flags & NATIVE_COMMAND_FLAGS.NOFUZZERCMD));
}

// C cmd.c:rhack(). Prefixes are commands; each consumes another parse in
// the same dispatch, so counts and configured keys work at every position.
export async function rhack(key: number): Promise<void> {
    requirePlayingGame(game);
    game.context.nopick = false;
    game.iflags.menu_requested = false;
    if (key !== 0) delete game._cursorOverride;
    game._heroMeleeThisCommand = false;
    game._silentPrefixRetainedTopline = false;
    const previousMessage = game._pending_message;
    const movement = game._movementAttempt ?? { walk: false, rush: false };
    game._movementAttempt = movement;
    let prefix: NativeCommand | null = null;
    let menuPrefix = false;

    for (;;) {
        const repeated = takeRepeatCommand();
        // C rhack() consumes unused answers as command keys before parse().
        // A non-key response at this boundary cancels the remaining queue.
        const response = game._inDoAgain ? undefined : takeCommandResponse();
        let cannedCommand = game._inDoAgain || response !== undefined
            ? null : game._cannedCommands?.shift() ?? null;
        if (response !== undefined) key = typeof response === 'number' ? response : 0;
        if (key === 0 && !cannedCommand && !repeated && response === undefined) {
            key = (await readCommandInput()).key;
            delete game._cursorOverride;
            // C parse() returns NUL after a click queues its mouse command.
            if (key === 0) cannedCommand = game._cannedCommands?.shift() ?? null;
        }
        delete game._statusGoldOverride;
        if (!cannedCommand && !repeated && [0, -1, 255, 27].includes(key)) {
            resetCommandVariables(true);
            return;
        }
        if (repeated && repeated.kind !== 'command') {
            resetCommandVariables(true);
            return;
        }
        // C rhack() drops any pending travel destination for every command
        // dispatched here (cmd.c:3674); the empty/ESC branches above clear
        // it through reset_cmd_vars() instead.
        game.context.travel = game.context.travel1 = false;
        const configured = repeated?.binding ?? configuredCommand(key);
        if (!cannedCommand && response === undefined) {
            game._pending_message = '';
            game._retained_message = '';
        }
        const command = cannedCommand ? cannedCommandDefinition(cannedCommand) : configured.command;
        if (!command) {
            // C parse()/rhack() report an unknown key with
            // custompline(SUPPRESS_HISTORY): the previous line is
            // remembered, the complaint itself is not.
            await setTopline(`Unknown command '${visibleCommandKey(key)}'.`);
            // Unlike a rejected known command, C's unknown-key tail keeps
            // pending movement flags until the next command resolves them.
            clearCannedCommands();
            clearRepeatCommand();
            game.context.move = 0;
            setMulti(0);
            return;
        }
        if (!await commandAllowed(command)) {
            resetCommandVariables(true);
            return;
        }
        if (prefix && !(command.flags & NATIVE_COMMAND_FLAGS.PREFIXCMD)
            && !(command.flags & (menuPrefix ? NATIVE_COMMAND_FLAGS.CMD_M_PREFIX
                : NATIVE_COMMAND_FLAGS.CMD_gGF_PREFIX))) {
            const prefixKey = game.commandBindings.keyForCommand(prefix.name ?? '');
            const which = prefixKey ? visibleCommandKey(prefixKey)
                : prefix.handler === 'do_reqmenu'
                    ? 'move-no-pickup or request-menu' : prefix.name;
            if (menuPrefix) {
                // C rhack() reports the M-prefix refusal with
                // custompline(SUPPRESS_HISTORY), unlike the g/G/F variant.
                await setTopline(`The ${command.name} command does not accept '${which}' prefix.`);
            } else {
                const vertical = command.handler === 'doup' || command.handler === 'dodown';
                await pline(`The '${which}' prefix should be followed by a movement command${vertical ? ' other than up or down' : ''}.`);
            }
            resetCommandVariables(true);
            return;
        }
        let binding: CommandBinding = { ...configured, command,
            key: cannedCommand
                ? commandExecutionKey(command.name)?.charCodeAt(0) ?? null : configured.key,
        };
        prepareTimedCommand(binding);
        if (command.handler === 'doextcmd') {
            clearRepeatCommand();
            const { selected, lastExecuted } = await readExtendedCommand();
            if (!selected || !await commandAllowed(selected)) {
                // doextcmd() leaves ext_tlist pointing at the last list it
                // executed when the following editor quits or is rejected.
                if (lastExecuted) rememberCommand({
                    key: commandExecutionKey(lastExecuted.name)?.charCodeAt(0) ?? null,
                    command: lastExecuted, parameter: null,
                }, false);
                // doextcmd() reports ECMD_OK for a quit, so rhack() resets
                // the queues only under an involuntary delay.
                resetCommandVariables(game.multi < 0);
                return;
            }
            if (game.iflags.menu_requested && !(selected.flags & NATIVE_COMMAND_FLAGS.CMD_M_PREFIX)) {
                const prefixKey = visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'));
                await plineWithContinuation(`'${prefixKey}' prefix has no effect for the ${selected.name} command.`);
                game.iflags.menu_requested = false;
            }
            binding = {
                key: commandExecutionKey(selected.name)?.charCodeAt(0) ?? null,
                command: selected, parameter: null,
            };
        }
        const selected = binding.command;
        if (!selected) throw new Error('Command dispatch lost its selected command');
        if (selected.handler === 'do_repeat') {
            await repeatLastCommand();
            // The outer rhack() dispatches do_repeat, not dokick.
            if (game.context.move) game._kickedLoc = null;
            return;
        }
        rememberCommand(binding, !!prefix && command.handler !== 'doextcmd');
        if (selected.flags & NATIVE_COMMAND_FLAGS.PREFIXCMD) {
            if (!await applyMovementPrefix(selected, movement)) {
                resetCommandVariables(true);
                return;
            }
            prefix = selected;
            if (selected.handler === 'do_reqmenu') {
                // rhack() tests the outer function, which remains doextcmd
                // when #reqmenu supplies the selected prefix.
                if (command.handler === 'do_reqmenu') menuPrefix = true;
                game._silentPrefixRetainedTopline = !!previousMessage;
            }
            key = 0;
            continue;
        }
        if (selected.flags & NATIVE_COMMAND_FLAGS.MOVEMENTCMD) {
            await dispatchMovement(binding, movement);
            return;
        }
        await executeCommandAction(binding, { cannedCommand });
        return;
    }
}

function cannedCommandDefinition(queued: CannedCommand): NativeCommand | null {
    let name: string;
    switch (queued.kind) {
    case 'inventory-action': return inventoryActionCommand(queued.action);
    case 'context-menu': name = contextMenuCommand(queued.selection); break;
    case 'command': name = queued.name; break;
    case 'swap-weapon': name = 'swap'; break;
    case 'rub': case 'apply': case 'wield': case 'kick': case 'reqmenu': case 'fire': name = queued.kind; break;
    }
    return NATIVE_COMMANDS.find(command => command.name === name) ?? null;
}

// C cmd.c:do_repeat(). Preserve the saved queue even when its execution
// cancels, so another repeat makes the same attempt in the new context.
async function repeatLastCommand(): Promise<void> {
    if (game._inDoAgain) return;
    const saved = [...(game._repeatCommands ?? [])];
    if (!saved.length) {
        await plineWithContinuation('There is no command available to repeat.', { noRepeat: true });
        resetCommandVariables(true);
        return;
    }
    game._inDoAgain = true;
    try {
        await rhack(0);
    } finally {
        game._inDoAgain = false;
        game._repeatCommands = saved;
        game.iflags.menu_requested = false;
    }
}

async function applyMovementPrefix(command: NativeCommand, movement: MovementAttempt): Promise<boolean> {
    if (command.handler === 'do_reqmenu') {
        if (game.iflags.menu_requested) {
            const key = visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'));
            await pline(`Double ${key} prefix, canceled.`);
            return false;
        }
        game.iflags.menu_requested = true;
        return true;
    }
    if (command.handler === 'do_fight') {
        if (game.context.forcefight) {
            await pline('Double fight prefix, canceled.');
            return false;
        }
        game.context.forcefight = true;
        movement.walk = true;
        return true;
    }
    if (command.handler === 'do_rush' || command.handler === 'do_run') {
        if (movement.rush) {
            await pline(`Double ${command.handler === 'do_rush' ? 'rush' : 'run'} prefix, canceled.`);
            return false;
        }
        game.context.run = command.handler === 'do_rush' ? 2 : 3;
        movement.rush = true;
        return true;
    }
    throw new Error(`Unimplemented movement prefix: ${command.name}`);
}

async function dispatchMovement(binding: CommandBinding, prefixes: MovementAttempt): Promise<void> {
    const key = binding.key ?? 0;
    const ch = String.fromCharCode(key);
    const direction = controlRushDirection(key) || ch.toLowerCase();
    if (!isMovementKey(direction)) throw new Error('Movement command has no direction');
    const hero = game.u;
    hero.dx = DIR_DX[direction];
    hero.dy = DIR_DY[direction];
    hero.dz = 0;
    if (MONSTER_NAME[hero.umonnum ?? -1] === 'grid bug' && hero.dx && hero.dy) {
        hero.dx = hero.dy = 0;
        await pline("You can't get there from here...");
        resetCommandVariables(true);
        return;
    }
    // C rhack() dispatches on gd.domove_attempting, which a run prefix
    // followed by an unbound key leaves set with DOMOVE_RUSH.  That
    // branch starts a run (multi = max(COLNO, ROWNO), context.mv) with
    // whatever context.run now holds -- even 0 after nomul() -- so the
    // step repeats until a move fails.  A pending DOMOVE_WALK bit takes
    // precedence over RUSH in the dispatch order.
    const rushDispatch = prefixes.rush && !prefixes.walk;
    const mode: DirectionalRunMode = prefixes.walk || prefixes.rush
        ? game.context.run === 2 ? 2 : game.context.run === 3 ? 3 : 0
        : controlRushDirection(key) ? 3 : ch !== ch.toLowerCase() ? 1 : 0;
    // C cmd.c:set_move_cmd() replaces context.run only when no movement
    // prefix is pending (domove_attempting); an 'F' or rush-prefixed
    // direction keeps the run value an earlier rush or travel left set.
    if (!(prefixes.walk || prefixes.rush)) game.context.run = mode;
    if (game.iflags.menu_requested) game.context.nopick = true;
    if (rushDispatch || (mode && !prefixes.walk))
        startRun(hero.dx, hero.dy, game, mode);
    else if (game.multi > 0)
        // A counted walk-style direction marks the repeat active without
        // replacing context.run or granting a rush's movement ration.
        startWalkRepeat(hero.dx, hero.dy, game);
    const outcome = await domove(hero.dx, hero.dy);
    const moved = outcome === 'time';
    if (game.program_state.gameover) return;
    // C domove_core() also delays counted walks after arrival effects.
    if (moved && game._domoveReachedTail)
        await captureRunmodeDelay(game, !!game.context.run || game.multi > 0);
    game.context.move = moved ? 1 : 0;
    if (!moved && outcome !== 'opened-door') stopRun();
    if (!mode || prefixes.walk) game.context.forcefight = false;
    game.iflags.menu_requested = false;
}

// C cmd.c:rhack() clears kickedloc after an elapsed non-kick action.
// doextcmd's selected action, not the outer # editor, owns that result.
async function executeCommandAction(binding: CommandBinding, options: CommandActionOptions = {}): Promise<void> {
    beginCommandResult();
    await runCommandHandler(binding, options);
    if (game.program_state.gameover) return;
    // C cmd.c:rhack() result seam (3810-3826): ECMD_CANCEL and ECMD_FAIL
    // reset both command queues, a time-taking result keeps them, and an
    // ECMD_OK result resets them only under an involuntary delay. C's
    // moveloop presets context.move before rhack(); JS handlers set it, so
    // the TIME precedence over a cancellation reads the recorded result
    // bits, not the possibly stale context.move.
    const result = game._commandResult ?? ECMD_OK;
    if (result & (ECMD_CANCEL | ECMD_FAIL)) {
        resetCommandVariables(true);
        if (result & ECMD_TIME) game.context.move = 1;
    } else if (!game.context.move) {
        resetCommandVariables(game.multi < 0);
    }
    if (game.context.move
        && binding.command?.handler !== 'dokick'
        && binding.command?.handler !== 'doextcmd') {
        game._kickedLoc = null;
    }
}

interface CommandActionOptions {
    cannedCommand?: CannedCommand | null;
}

// C cmd.c:dotoggleoption(): without a binding parameter the command only
// points the player at the options menu; with one it is
// toggle_bool_option(param).
async function doToggleOption(parameter: string | null): Promise<void> {
    game.context.move = 0;
    if (parameter === null) {
        await pline('Use #optionsfull to set any option instead.');
        return;
    }
    if (!await toggleBooleanOptionPrefix(parameter)) commandResultFailed();
}
// Admission belongs to the caller. Keep the selected binding, including its
// parameter, rather than looking up a possibly rebound key inside the action.
async function runCommandHandler(binding: CommandBinding, {
    cannedCommand = null,
}: CommandActionOptions = {}): Promise<void> {
    const { key, command } = binding;
    const ch = key === null ? '' : String.fromCharCode(key);
    if (!cannedCommand && key === null && command) {
        // cmd.c:dotoggleoption() reads gc.cmd_bind->param; a parameter only
        // arrives through a key binding like BIND=x:toggle(silent).
        if (command.name === 'toggle') {
            await doToggleOption(binding.parameter);
            return;
        }
        const handler = command.name === null ? undefined : EXTENDED_COMMAND_HANDLERS.get(command.name);
        if (handler) {
            await handler();
            return;
        }
        await pline(`#${command.name}: unknown extended command.`);
        game.context.move = 0;
        return;
    }

    if (cannedCommand?.kind === 'context-menu') {
        const selection = cannedCommand.selection;
        contextMenuResponses(selection);
        await runCommandHandler(binding);
        return;
    }
    if (cannedCommand?.kind === 'command') {
        await runCommandHandler(binding);
        return;
    }

    // C cmd.c:rhack() pops CQ_CANNED before parse() asks tty for another
    // byte.  Tool commands use this to resume the original operation after
    // wield_tool() has spent one action installing the selected object.
    if (cannedCommand?.kind === 'rub') {
        await dorub(cannedCommand.invlet);
        return;
    }
    if (cannedCommand?.kind === 'apply') {
        await doapply(cannedCommand.invlet);
        return;
    }
    if (cannedCommand?.kind === 'swap-weapon') {
        await doswapweapon();
        return;
    }
    if (cannedCommand?.kind === 'wield') {
        queueCommandKeys(cannedCommand.invlet);
        try {
            await dowield();
        } finally {
            clearCommandKeys();
        }
        return;
    }
    if (cannedCommand?.kind === 'kick') {
        queueCommandResponses([{ dx: cannedCommand.dx, dy: cannedCommand.dy, dz: 0 }]);
        try {
            await dokick();
        } finally {
            clearCommandKeys();
        }
        return;
    }
    if (cannedCommand?.kind === 'fire') {
        await dofire(cannedCommand.shotLimit ?? 0);
        return;
    }
    if (cannedCommand?.kind === 'inventory-action') {
        await executeInventoryAction(cannedCommand.action);
        return;
    }

    if (key === 22 && game.flags?.debug) { // Ctrl-V: wiz_level_tele()
        await wizLevelTeleport({ menuRequested: game.iflags.menu_requested });
        return;
    }
    if (key === 23 && game.flags?.debug) { // Ctrl-W: wiz_wish()
        await wizWish();
        return;
    }
    if (key === 7 && game.flags?.debug) { // Ctrl-G: wiz_genesis()
        await wizGenesis();
        return;
    }
    if (key === 20) { // Ctrl-T: dotelecmd()
        if (game.flags.debug) await wizardTeleportCommand(teleportAtWillCommand);
        else await teleportAtWillCommand(false);
        return;
    }
    if (key === 6 && game.flags?.debug) { // Ctrl-F: wiz_map()
        await wizMap();
        return;
    }
    if (binding.command?.handler === 'doprev_message') {
        // Ctrl-P: doprev_message(), a GENERALCMD redisplay that follows the
        // binding rather than one raw key.
        await doprevMessage();
        game.context.move = 0;
        return;
    }
    if (ch === 'i') {
        enqueueInventoryAction(await ddoinv());
    } else if (ch === 'I') {
        enqueueInventoryAction(await inventoryReport('type'));
    } else if (ch === '(') {
        enqueueInventoryAction(await inventoryReport('tools'));
    } else if (ch === '*') {
        enqueueInventoryAction(await inventoryReport('inuse'));
    } else if (ch === 'O') {
        await doOptions(game.iflags.menu_requested);
    } else if (ch === 'Z') {
        await docast();
    } else if (ch === '+') {
        await dovspell();
    } else if (ch === '\\') {
        await dodiscovered();
    } else if (ch === '`') {
        await doclassdisco();
    } else if (key === 24) { // Ctrl-X
        await doattributes();
    } else if (ch === 's') {
        await dosearch(game.iflags.menu_requested);
    } else if (key === 4) { // Ctrl-D
        await dokick();
    } else if (ch === 'f') {
        await dofire();

    } else if (ch === '.') {
        await performWaitCommand();
    } else if (ch === 'e') {
        await doeat();
    } else if (ch === 'q') {
        await doquaff();
    } else if (ch === 'p') {
        await dopay();
    } else if (ch === 'd') {
        await dodrop();
    } else if (ch === 'D') {
        const result = await dropMultipleObjects();
        // doddrop() returns the drop transaction's result bits (or the
        // traditional-mode dropped count) to rhack() unchanged.
        game._commandResult = result;
        game.context.move = Number((result & ECMD_TIME) !== 0);
        if (result) {
            resetOccupations();
            if (game._occupation?.key === 'pick-lock') game._occupation = null;
        }
    } else if (ch === 'c') {
        await doclose();
    } else if (ch === 'o') {
        await doopen();
    } else if (ch === '@') {
        // C options.c:dotogglepickup().  This is an immediate option command,
        // not a turn, and its class list is the live pickup_types setting.
        game.flags.pickup = !game.flags.pickup;
        const classes = game.flags.pickup_types || '';
        await pline(game.flags.pickup
            ? `Autopickup: ON, for ${classes || 'all'} objects.`
            : 'Autopickup: OFF.');
        game.context.move = 0;
    } else if (ch === ',') {
        await pickupAtHero();
    } else if (ch === '>') {
        await travelStairs(false);
    } else if (ch === '<') {
        await travelStairs(true);
    } else if (ch === 'z') {
        await dozap();
    } else if (ch === 'r') {
        await readCommand();
    } else if (ch === 'T' || ch === 'R') {
        await removeWornItem(ch === 'R' ? 'remove' : 'take off');
    } else if (ch === 'A') {
        await takeOffAll();
    } else if (ch === 'P') {
        await doputon();
    } else if (ch === 'W') {
        await dowear();
    } else if (ch === 'w') {
        await dowield();
    } else if (ch === 'x') {
        await doswapweapon();
    } else if (ch === 'a') {
        await doapply();
    } else if (ch === ':') {
        await dolook();
    } else if (ch === 'V') {
        await doversion();
    } else if (ch === '&') {
        await whatDoesCommand();
    } else if (ch === '?') {
        await dohelp();
    } else if (ch === '#') {
        await rhack(game.commandBindings.keyForCommand('#'));
    } else if (ch === 'Q') {
        await doready();
    } else if (ch === 't') {
        await dothrow();
    } else if (ch === '_') {
        await dotravel();
    } else if (ch === ';') {
        await doquickwhatis();
    } else if (ch === 'S') {
        await dosave();
    } else if (ch === '$') {
        enqueueInventoryAction(await inventoryReport('gold'));
    } else if (ch === ')') {
        enqueueInventoryAction(await inventoryReport('weapon'));
    } else if (ch === '[') {
        enqueueInventoryAction(await inventoryReport('armor'));
    } else if (ch === '=') {
        enqueueInventoryAction(await inventoryReport('rings'));
    } else if (ch === '"') {
        enqueueInventoryAction(await inventoryReport('amulet'));
    } else if (ch === '|') {
        await doPermanentInventory();
    } else if (key === 127) { // Delete: overview of known terrain.
        await doTerrainOverview();
    } else if (key === 27) { // Escape cancels without producing a message.
        game.context.move = 0;
    } else {
        // Unknown command
        await setTopline(`Unknown command '${ch}'.`);
        game.context.move = 0;
    }
}

function enqueueInventoryAction(action: InventoryAction | null): void {
    if (!action || ['\x1b', ' ', '\n', '\r'].includes(action.key)) return;
    game._cannedCommands ??= [];
    // itemactions_pushkeys() queues the normal prefix so command admission
    // and repeat include it before the inventory command runs.
    if (action.key === 'e' || action.key === 'q'
        || action.key === 'T' && !((action.item.owornmask ?? 0) & W_ARMOR))
        game._cannedCommands.push({ kind: 'reqmenu' });
    game._cannedCommands.push({ kind: 'inventory-action', action });
}

async function doquaff() {
    const result = await quaff();
    if (result.cancelled) commandResultCancelled(); // potion.c:dodrink() ECMD_CANCEL.
    game.context.move = result.spentTime && !result.heroDied ? 1 : 0;
}

async function readCommand(): Promise<void> {
    const result = await doread();
    if (result.cancelled) commandResultCancelled(); // read.c:doread() ECMD_CANCEL.
}

// Stair traversal shared by up and down: mark the stairway traversed, then
// hand the destination to goto_level().
// C do.c:dodown() and C do.c:doup(): the '<' and '>' commands whose shared
// body this is; each still starts with set_move_cmd(). C hack.c:u_rooted():
// the "You are rooted" refusal. C trap.c:uteetering_at_seen_pit() and
// C trap.c:uescaped_shaft(): the seen pit and shaft underfoot take the
// plunge before the stairway is required; C hack.c:is_pool_or_lava(): the
// hider's drop-to-liquid message.
// C dungeon.c:next_level() and prev_level(): the branch-stair wrappers,
// including prev_level()'s escape ending from dungeon 0 level 1.
export async function travelStairs(up: boolean) {
    const level = requireGameLevel();
    requireInitializedHero(game.u);
    // C do.c doup()/dodown() start with set_move_cmd(): the menu prefix's
    // no-pickup request and the cleared travel state outlive a refusal.
    game.u.dx = game.u.dy = 0;
    game.u.dz = up ? -1 : 1;
    if (game.iflags.menu_requested) game.context.nopick = true;
    game.context.travel = game.context.travel1 = false;
    if (MONSTER_MOVE[game.u.umonnum] === 0) {
        const where = propertyIsActive('levitation', game) || Is_airlevel(game.u.uz)
            || Is_waterlevel(game.u.uz) ? 'in place' : 'to the ground';
        await plineWithContinuation(`You are rooted ${where}.`);
        endVoluntaryMultiTurn(game);
        game.context.move = 1;
        return false;
    }
    if (up && game.u.utrap && game.u.utraptype === TT_PIT) {
        await climbOutOfPit();
        game.context.move = 1;
        return true;
    }
    if (!up && await stuckSteed(true, game)) {
        game.context.move = 0;
        return false;
    }
    if (!up) {
        const descent = await descendFromLevitation(game);
        if (descent.handled) {
            game.context.move = descent.spentTurn ? 1 : 0;
            return descent.spentTurn;
        }
        if (heroIsPolymorphed(game) && game.u.uundetected
            && monsterSpeciesHidesOnCeiling(game.u.umonnum)) {
            game.u.uundetected = 0;
            if (game.u.flying) await plineWithContinuation('You fly out of hiding.');
            else {
                await plineWithContinuation(`You drop to the ${surfaceName(game.u.ux, game.u.uy)}.`);
                if (isPoolAt(game.u.ux, game.u.uy) || isLavaAt(game.u.ux, game.u.uy)) {
                    await applyHeroLiquidEffects();
                } else {
                    await autopickupAtHero();
                    if (!game.program_state.gameover)
                        await triggerHeroTrapAt(game.u.ux, game.u.uy, {
                            finishTeleport: finishTeleportArrival, gotoLevel, tookPlunge: true,
                        });
                }
            }
            game.context.move = 1;
            return true;
        }
        if (await monsterPreventsStairTravel(false)) return false;
    }
    let stairs = game.stairs;
    while (stairs && (stairs.sx !== game.u.ux || stairs.sy !== game.u.uy))
        stairs = stairs.next;
    if (!stairs || stairs.up !== up) {
        const pit = !up && level.traps.find(trap =>
            trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) && trap.tseen
            && !(game.u.utrap && game.u.utraptype === TT_PIT));
        if (pit) {
            await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            game.context.move = 1;
            return true;
        }
        const hole = !up && level.traps.find(trap =>
            trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) && trap.tseen);
        if (hole) {
            const result = await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            if (result.died) return false;
            game.context.move = 1;
            return true;
        }
        const pick = game.uwep || game.u.uwep;
        if (!up && game.flags.autodig && !game.context.nopick && pick && isPick(pick)) {
            const result = await applyPickAxeDirection(pick, {
                state: game,
                attackMonster: (target: Monster, struckAt: Position) =>
                    attackHostileMonster(target, struckAt.x, struckAt.y),
                payShopkeeper: dopay,
            });
            game.context.move = result.spentTime ? 1 : 0;
            return result.spentTime;
        }
        const vibratingSquare = !up && level.traps.some(trap =>
            trap.tx === game.u.ux && trap.ty === game.u.uy && trap.ttyp === VIBRATING_SQUARE);
        await plineWithContinuation(`You can't go ${up ? 'up' : 'down'} here${vibratingSquare ? ' yet' : ''}.`);
        game.context.move = 0;
        return false;
    }
    if (!up && Is_valley(game.u.uz) && !game.u.uevent?.gehennom_entered) {
        await plineWithContinuation('You are standing at the gate to Gehennom.');
        await plineWithContinuation('Unspeakable cruelty and harm lurk down there.');
        if (await promptYesNo('Are you sure you want to enter?') !== 'y') {
            game.context.move = 0;
            return false;
        }
        await plineWithContinuation('So be it.');
        const events = game.u.uevent ?? (game.u.uevent = {});
        events.gehennom_entered = 1;
    }
    if (up && await stuckSteed(true, game)) {
        game.context.move = 0;
        return false;
    }
    if (up && await monsterPreventsStairTravel(true)) return false;
    if (up && nearCapacity(game) > SLT_ENCUMBER) {
        await plineWithContinuation(`Your load is too heavy to climb the ${
            level.requireAt(game.u.ux, game.u.uy).typ === STAIRS ? 'stairs' : 'ladder'}.`);
        game.context.move = 1;
        return false;
    }
    if (up && ledgerNo(game.u.uz) === 1
        && await promptYesNo('Beware, there will be no return!  Still climb?') !== 'y') {
        game.context.move = 0;
        return false;
    }
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You are held back by your pet!');
        game.context.move = 0;
        return false;
    }
    stairs.u_traversed = true;
    // C dungeon.c:prev_level(): an up branch stair from dungeon 0 level 1
    // ends the game as an escape unless the hero carries the Amulet, and
    // only then lets goto_level() enter the endgame.
    if (up && stairs.tolev.dnum !== game.u.uz.dnum
        && game.u.uz.dnum === 0 && game.u.uz.dlevel === 1
        && !game.u.uhave?.amulet) {
        await finishHeroDeath({ killer: '', deathType: ESCAPED });
        game.context.move = 1;
        return true;
    }
    const changed = await gotoLevel(stairs.tolev, {
        arrival: up ? 'downstairs' : 'stairs',
        ladder: !!stairs.isladder,
    });
    if (changed !== false) game.context.move = 1;
    return changed !== false;
}
// C cmd.c:doterrain().
export async function terrainCommand(): Promise<void> {
    recordMappedOverviewState();
    const window = tty_create_nhwindow<number>(NHW_MENU);
    await tty_start_menu(window);
    const choices = ['known map without monsters, objects, and traps',
        'known map without monsters and objects', 'known map without monsters'];
    if (game.flags.explore || game.flags.debug)
        choices.push('full map without monsters, objects, and traps');
    if (game.flags.debug) choices.push('internal levl[][].typ codes in base-36',
        'legend of base-36 levl[][].typ codes');
    for (const [index, text] of choices.entries()) tty_add_menu(window, {
        identifier: index + 1, text,
        itemflags: index === 0 ? MENU_ITEMFLAGS_SELECTED : 0,
    });
    tty_end_menu(window, 'View which?');
    const result = await tty_select_menu(window, PICK_ONE);
    await tty_destroy_nhwindow(window);
    if (!result.cancelled) {
        const which = result.selections.find(selection => selection.identifier !== 1)?.identifier ?? 1;
        if (which === 5) await showTerrainCodes();
        else if (which === 6) await showTerrainCodeLegend();
        else {
            const subset = which === 4 ? TER_MAP | TER_FULL
                : TER_MAP | (which >= 2 ? TER_TRP : 0) | (which >= 3 ? TER_OBJ : 0);
            await revealTerrain(subset);
        }
    }
    game.context.move = 0;
}


async function doTerrainOverview(): Promise<void> {
    await terrainCommand();
}

async function doherecmdmenu(): Promise<void> {
    enqueueContextMenu(await selectContextMenu(game.u.ux, game.u.uy, CLICK_1));
}

async function dotherecmdmenu(): Promise<void> {
    game.iflags.getdir_click = CLICK_1 | CLICK_2;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y)) {
        enqueueContextMenu(await selectContextMenu(target.x, target.y,
            target.x === game.u.ux && target.y === game.u.uy ? CLICK_1 : game.iflags.getdir_click));
        game._clicklookTarget = null;
        game.iflags.getdir_click = 0;
        return;
    }
    const direction = await promptDirection();
    const click = game.iflags.getdir_click;
    game.iflags.getdir_click = 0;
    if (!direction || !isok(game.u.ux + direction.dx, game.u.uy + direction.dy)) {
        commandResultCancelled(); // cmd.c:there_cmdmenu() returns ECMD_CANCEL.
        return;
    }
    enqueueContextMenu(await selectContextMenu(
        game.u.ux + direction.dx, game.u.uy + direction.dy,
        direction.dx || direction.dy ? click : CLICK_1,
    ));
}

function enqueueContextMenu(selection: ContextMenuSelection | null): void {
    game.context.move = 0;
    if (!selection) return;
    // act_on_act() sets this before dotherecmdmenu() clears a mouse target.
    if (selection.action === 'look-at') game._clicklookTarget = { x: selection.x, y: selection.y };
    game._cannedCommands ??= [];
    if (selection.action === 'remove-saddle') game._cannedCommands.push({ kind: 'reqmenu' });
    game._cannedCommands.push({ kind: 'context-menu', selection });
}

// C cmd.c:doclicklook() retains the clicked location for later commands.
async function doclicklook(): Promise<void> {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y)) await autoDescribePosition(target.x, target.y);
}

async function domouseaction(): Promise<void> {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y)) mouseAction(target);
}

// C cmd.c:domouseaction(), the optional mouse binding which chooses an action.
function mouseAction(click: Position): void {
    requirePlayingGame(game);
    let dx = click.x - game.u.ux, dy = click.y - game.u.uy;
    const queue = (name: string) => {
        game._cannedCommands ??= [];
        game._cannedCommands.push({ kind: 'command', name });
    };
    if (game.flags.travel !== false) {
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            game._travelTarget = { x: click.x, y: click.y };
            queue('retravel');
            return;
        }
        const location = game.level?.at(click.x, click.y);
        if (!dx && !dy) {
            if (location?.typ === FOUNTAIN || location?.typ === SINK) queue('quaff');
            else if (location?.typ === THRONE) queue('sit');
            else {
                let stair = game.stairs;
                while (stair && (stair.sx !== click.x || stair.sy !== click.y)) stair = stair.next;
                const object = game.level?.objects[click.x]?.[click.y]?.[0];
                if (stair) queue(stair.up ? 'up' : 'down');
                else queue(object ? isContainer(object) ? 'loot' : 'pickup' : 'wait');
            }
            return;
        }
        if (!monsterAtPosition(game.level, click.x, click.y) && !heroTestMove(click.x, click.y)) {
            if (location?.typ === DOOR && location.doormask & (D_CLOSED | D_LOCKED))
                queue(location.doormask & D_LOCKED ? 'kick' : 'open');
            else if (location && location.typ <= SCORR) queue('search');
            else queue(contextMenuCommand({ action: 'move', x: click.x, y: click.y }));
            return;
        }
    } else {
        if (Math.abs(dx) > 2 * Math.abs(dy)) dy = 0;
        else if (Math.abs(dy) > 2 * Math.abs(dx)) dx = 0;
        dx = Math.sign(dx);
        dy = Math.sign(dy);
        if (!dx && !dy) {
            queue('wait');
            return;
        }
    }
    queue(contextMenuCommand({ action: 'move', x: game.u.ux + Math.sign(dx), y: game.u.uy + Math.sign(dy) }));
}

function contextMenuCommand(selection: ContextMenuSelection): string {
    switch (selection.action) {
    case 'move': case 'attack': {
        const dx = Math.sign(selection.x - game.u.ux), dy = Math.sign(selection.y - game.u.uy);
        const direction = TRAVEL_DIRECTIONS.findIndex(([x, y]) => x === dx && y === dy);
        const name = ['west', 'north', 'east', 'south', 'northwest', 'northeast', 'southeast', 'southwest'][direction];
        if (!name) throw new Error('A contextual move needs an adjacent target');
        return `move${name}`;
    }
    case 'lock': case 'saddle': return 'apply';
    case 'untrap-door': case 'untrap-here': return 'untrap';
    case 'remove-saddle': return 'loot';
    case 'dismount': return 'ride';
    case 'look-at': return 'clicklook';
    case 'travel': return 'retravel';
    case 'open': case 'kick': case 'close': case 'search': case 'showtrap':
    case 'untrap': case 'ride': case 'chat': case 'name': case 'quaff': case 'dip':
    case 'sit': case 'up': case 'down': case 'pickup': case 'loot': case 'tip':
    case 'eat': case 'drop': case 'wait': case 'look': case 'offer':
    case 'inventory': case 'cast': case 'throw': return selection.action;
    }
}

function contextMenuResponses(selection: ContextMenuSelection): void {
    const dx = Math.sign(selection.x - game.u.ux), dy = Math.sign(selection.y - game.u.uy);
    const direction = { dx, dy, dz: 0 };
    const yes = 'y'.charCodeAt(0);
    switch (selection.action) {
    case 'open': case 'untrap-door': case 'kick': case 'close': case 'showtrap':
    case 'untrap': case 'ride': case 'chat': queueCommandResponses([direction]); return;
    case 'lock': {
        const tool = [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]
            .map(type => game.inventory.find(object => object.otyp === type)).find(object => object);
        if (tool?.invlet) queueCommandResponses([tool.invlet.charCodeAt(0), direction, yes]);
        return;
    }
    case 'remove-saddle': queueCommandResponses([direction, yes]); return;
    case 'saddle': {
        const saddle = game.inventory.find(object => object.otyp === SADDLE);
        if (saddle?.invlet) queueCommandResponses([saddle.invlet.charCodeAt(0), direction]);
        return;
    }
    case 'name': queueCommandResponses(['m'.charCodeAt(0), direction]); return;
    case 'quaff': case 'tip': case 'eat': queueCommandResponses([yes]); return;
    case 'dip': queueCommandResponses(['user-input', yes]); return;
    case 'throw':
        // act_on_act() retains the raw offset for throwing.
        queueCommandResponses(['user-input', {
            dx: selection.x - game.u.ux, dy: selection.y - game.u.uy, dz: 0,
        }]);
        return;
    case 'offer': queueCommandResponses(['user-input']); return;
    case 'untrap-here': queueCommandResponses([{ dx: 0, dy: 0, dz: 1 }]); return;
    case 'travel': game._travelTarget = { x: selection.x, y: selection.y }; return;
    case 'attack': case 'cast': case 'dismount': case 'down': case 'drop':
    case 'inventory': case 'look': case 'look-at': case 'loot': case 'move':
    case 'pickup': case 'search': case 'sit': case 'up': case 'wait': return;
    }
}

// ── Contextual command menu entries (C cmd.c:there_cmd_menu_*()) ────────

export type ContextMenuAction =
    | 'open' | 'lock' | 'untrap-door' | 'kick' | 'close' | 'search' | 'showtrap'
    | 'untrap' | 'move' | 'ride' | 'remove-saddle' | 'saddle' | 'chat' | 'name'
    | 'quaff' | 'dip' | 'sit' | 'up' | 'down' | 'dismount' | 'pickup' | 'loot'
    | 'tip' | 'eat' | 'drop' | 'wait' | 'look' | 'look-at' | 'attack'
    | 'untrap-here' | 'offer' | 'inventory' | 'cast' | 'throw' | 'travel';

interface ContextMenuEntry { action: ContextMenuAction; text: string }
export interface ContextMenuSelection extends Position { action: ContextMenuAction }
const FOOD_CLASS = 7;

// C cmd.c:there_cmd_menu_common().
// C cmd.c:there_cmd_menu_far().
export async function selectContextMenu(x: number, y: number, click: number): Promise<ContextMenuSelection | null> {
    const entries: ContextMenuEntry[] = [];
    const add = (action: ContextMenuAction, text: string) => entries.push({ action, text });
    const dx = x - game.u.ux, dy = y - game.u.uy;
    const self = dx === 0 && dy === 0;
    const adjacent = Math.max(Math.abs(dx), Math.abs(dy)) <= 1;
    if (self) await selfEntries(add, x, y);
    else if (adjacent) adjacentEntries(add, x, y, click);
    else if (click === CLICK_1) {
        if (canThrowToward(x, y)
            && dx * dx + dy * dy < 18 * 18) add('throw', 'Throw something');
        add('travel', 'Travel here');
    }
    if ((click === CLICK_1 || click === CLICK_2) && (!self || unusualHeroGlyph()))
        add('look-at', 'Look at map symbol');

    if (!entries.length) {
        // getdir's ordinary keyboard direction has no click modifier. With
        // no contextual action, native queues movement or travel directly.
        return adjacent && heroTestMove(x, y) ? { action: 'move', x, y }
            : game.flags.travel !== false ? { action: 'travel', x, y } : null;
    }
    if (entries.length === 1 && entries[0]?.action === 'attack')
        return { action: 'attack', x, y };

    clearMessageWindow();
    const window = tty_create_nhwindow<ContextMenuAction>(NHW_MENU);
    await tty_start_menu(window);
    for (const entry of entries)
        tty_add_menu(window, { identifier: entry.action, text: entry.text });
    tty_end_menu(window, 'What do you want to do?');
    const result = await tty_select_menu(window, PICK_ONE);
    await tty_destroy_nhwindow(window);
    const action = result.selections[0]?.identifier;
    return action ? { action, x, y } : null;
}

// C linedup(..., 1): boulders do not obstruct an explicitly chosen throw.
function canThrowToward(x: number, y: number): boolean {
    requirePlayingGame(game);
    const dx = game.u.ux - x, dy = game.u.uy - y;
    if (dx && dy && Math.abs(dx) !== Math.abs(dy)
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM) return false;
    if (couldsee(x, y)) return true;
    do {
        x += Math.sign(dx);
        y += Math.sign(dy);
        if (blockingTerrain(game, x, y)) return false;
    } while (x !== game.u.ux || y !== game.u.uy);
    return true;
}

type AddEntry = (action: ContextMenuAction, text: string) => void;

// C cmd.c:there_cmd_menu_self().
async function selfEntries(add: AddEntry, x: number, y: number): Promise<void> {
    const level = requireGameLevel();
    const terrain = level.requireAt(x, y).typ;
    if ((terrain === FOUNTAIN || terrain === SINK) && heroCanReachFloor())
        add('quaff', `Drink from the ${terrain === FOUNTAIN ? 'fountain' : 'sink'}`);
    if (terrain === FOUNTAIN && heroCanReachFloor()) add('dip', 'Dip something into the fountain');
    if (terrain === THRONE) add('sit', 'Sit on the throne');
    if (terrain === ALTAR) add('offer', 'Sacrifice something on the altar');
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.sx !== x || stair.sy !== y) continue;
        add(stair.up ? 'up' : 'down', `Go ${stair.up ? 'up' : 'down'} the ${stair.isladder ? 'ladder' : 'stairs'}`);
        break;
    }
    if (game.u.usteed)
        add('dismount', `Dismount ${monsterName(game.u.usteed, { article: 'the', suppressSaddle: true })}`);
    const pile = level.objects[x]?.[y] ?? [];
    const first = pile[0];
    if (first) {
        add('pickup', `Pick up ${pile.length > 1 ? 'items' : await menuObjectName(first)}`);
        if (isContainer(first)) {
            add('loot', `Loot ${await menuObjectName(first)}`);
            add('tip', `Tip ${await menuObjectName(first)}`);
        }
        if (first.oclass === FOOD_CLASS) add('eat', `Eat ${await menuObjectName(first)}`);
    }
    if (game.inventory.length) {
        add('inventory', 'Inventory');
        add('drop', 'Drop items');
    }
    add('wait', 'Rest one turn');
    add('search', 'Search around you');
    add('look', 'Look at what is here');
    if (game.spells.length) add('cast', 'Cast a spell');
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && trap.ttyp !== VIBRATING_SQUARE) add('untrap-here', 'Attempt to disarm trap');
}

async function menuObjectName(object: GameObject): Promise<string> {
    observeObjectForNaming(object);
    return floorObjectDescription(object);
}

// C cmd.c:there_cmd_menu_next2u().
function adjacentEntries(add: AddEntry, x: number, y: number, click: number): void {
    const level = requireGameLevel();
    const location = level.requireAt(x, y);
    if (location.typ === DOOR) {
        if (location.doormask & (D_CLOSED | D_LOCKED)) {
            add('open', 'Open the door');
            const key = game.inventory.some(object => object.otyp === SKELETON_KEY || object.otyp === LOCK_PICK);
            if (key || game.inventory.some(object => object.otyp === CREDIT_CARD))
                add('lock', key ? 'Lock or unlock the door' : 'Unlock the door');
            add('untrap-door', 'Search the door for a trap');
            add('kick', 'Kick the door');
        } else if (location.doormask & D_ISOPEN && click === CLICK_2) add('close', 'Close the door');
    }
    if (location.typ <= SCORR) add('search', 'Search for secret doors');
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen) {
        add('showtrap', 'Examine trap');
        if (trap.ttyp !== VIBRATING_SQUARE) add('untrap', 'Attempt to disarm trap');
        add('move', 'Move on the trap');
    }
    if (location.remembered_glyph?.glyph === GlyphOffset.object + BOULDER) add('move', 'Push the boulder');
    const occupant = monsterAtPosition(level, x, y);
    const monster = occupant && canSpotMonster(occupant) ? occupant : null;
    if (monster && monsterSaddle(monster)) {
        const name = monsterName(monster, { article: 'the', suppressSaddle: true });
        if (!game.u.usteed) add('ride', `Ride ${name}`);
        add('remove-saddle', `Remove saddle from ${name}`);
    }
    if (monster && monsterCanBeSaddled(monster) && !monsterSaddle(monster)
        && game.inventory.some(object => object.otyp === SADDLE))
        add('saddle', `Put saddle on ${monsterName(monster, { article: 'the' })}`);
    if (monster && (monster.mpeaceful || monster.mtame)) {
        add('chat', `Talk to ${monsterName(monster, { article: 'the' })}`);
        add('move', `Swap places with ${monsterName(monster, { article: 'the' })}`);
        add('name', `${monster.mgivenname || monster.mextra?.mgivenname ? 'Rename' : 'Name'} ${monsterName(monster, { article: 'the' })}`);
    }
    if (monster && !(monster.mpeaceful || monster.mtame) || glyphAt(x, y)?.glyph === GlyphOffset.invisible)
        add('attack', `Attack ${monster ? monsterName(monster, { article: 'the' }) : 'unseen creature'}`);
}

function unusualHeroGlyph(): boolean {
    const hero = game.u;
    if (Upolyd(hero)) return true;
    const species = game.flags.showrace ? game.urace?.mnum : hero.umonnum;
    if (species === undefined) throw new Error('A contextual hero menu requires an initialized species');
    const glyph = (game.flags.female ? GlyphOffset.monFemale : GlyphOffset.monMale) + species;
    return glyphAt(hero.ux, hero.uy)?.glyph !== glyph;
}

// ── #lookaround (C cmd.c:dolookaround() and its selection helpers) ─────

// C cmd.c:dolookaround_floodfill_findroom(): the room flood-fill boundary.
// A missing map cell behaves like solid rock and stops the fill.
function lookaroundFloodFillFindRoom(x: number, y: number): boolean {
    const typ = game.level?.at(x, y)?.typ ?? 0;
    return !(IS_STWALL(typ) || IS_DOOR(typ) || IS_TREE(typ)
        || IS_WATERWALL(typ) || typ === LAVAWALL || typ === IRONBARS
        || typ === SCORR || typ === SDOOR || typ === DRAWBRIDGE_UP);
}

// C cmd.c:u_have_seen_whole_selection(): no selected square still shows the
// unexplored glyph.
function haveSeenWholeSelection(selection: Selection): boolean {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored) return false;
            }
    return true;
}

// C cmd.c:u_have_seen_bounds_selection(): the rectangular outline of the
// selection has been seen, even when its interior has not.
function haveSeenBoundsSelection(selection: Selection): boolean {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++) {
        for (const y of [bounds.ly, bounds.hy])
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored) return false;
            }
    }
    for (let y = bounds.ly; y <= bounds.hy; y++) {
        for (const x of [bounds.lx, bounds.hx])
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored) return false;
            }
    }
    return true;
}

// C cmd.c:u_can_see_whole_selection().
function canSeeWholeSelection(selection: Selection): boolean {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection)
                && !cansee(x, y))
                return false;
    return true;
}

// C cmd.c:lookaround_known_room(): describe the room containing x,y.
async function lookaroundKnownRoom(x: number, y: number): Promise<void> {
    const selection = selection_new();
    selection_floodfill(selection, x, y, true, lookaroundFloodFillFindRoom);

    const heroHere = game.u.ux === x && game.u.uy === y;
    if (!heroHere) set_msg_xy(x, y);

    // C reads the hero's own room membership, even when describing an
    // adjacent room from a doorway.
    const roomNumber = (game.u.urooms?.[0] ?? 0) - ROOMOFFSET;
    const noun = roomNumber >= 0 ? 'room' : 'area';
    const size = withIndefiniteArticle(selection_size_description(selection));
    if (haveSeenWholeSelection(selection)) {
        const inside = !!selection_getpoint(x, y, selection);
        const verb = heroHere
            ? inside && canSeeWholeSelection(selection) ? 'are in' : 'remember this as'
            : 'remember that as';
        await pline(`You ${verb} ${size} ${noun}.`);
    } else if (haveSeenBoundsSelection(selection)) {
        await pline(`You guess ${heroHere ? 'this' : 'that'} to be ${size} ${noun}.`);
    } else {
        await pline(`You can't guess the size of ${heroHere ? 'this' : 'that'} area.`);
    }
}

// C cmd.c:dolookaround(): the #lookaround extended command.  Describes the
// hero's room (or the rooms beside a doorway, or nothing in a corridor),
// then every seen interesting square plus remembered corridors.  Messages
// carry the accessiblemsg "(north,3east): " location prefix.
export async function dolookaround(): Promise<void> {
    const savedFilter = game.iflags.getloc_filter;
    const savedAccessible = game.flags.accessiblemsg;
    game.flags.accessiblemsg = true;
    try {
        const heroType = game.level?.at(game.u.ux, game.u.uy)?.typ;
        let corridorNextToHero = false;
        if (heroType === CORR) {
            // In a corridor, mention corridors next to you.
            corridorNextToHero = true;
        } else if (heroType !== undefined && IS_DOOR(heroType)) {
            // In a doorway, describe the rooms next to you.
            for (let direction = DIR_W; direction < N_DIRS; direction += 2) {
                const dx = xdir[direction], dy = ydir[direction];
                if (dx === undefined || dy === undefined)
                    throw new RangeError(`Invalid direction ${direction}`);
                const x = game.u.ux + dx;
                const y = game.u.uy + dy;
                if (isok(x, y) && IS_ROOM(game.level?.at(x, y)?.typ ?? 0))
                    await lookaroundKnownRoom(x, y);
            }
            corridorNextToHero = true;
        } else {
            await lookaroundKnownRoom(game.u.ux, game.u.uy);
        }

        game.iflags.getloc_filter = GFILTER_VIEW;
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const glyph = glyphAt(x, y);
                const symbol = glyph ? glyphToCmapSymbol(glyph.glyph) : null;
                // In a corridor or doorway, remembered corridors count even
                // beyond the current view.  (GLOC_INTERESTING itself catches
                // S_engrcorr.)
                const isCorridor = corridorNextToHero && symbol !== null
                    && (symbol === CmapSymbol.corr || symbol === CmapSymbol.litcorr);

                if (x === game.u.ux && y === game.u.uy) continue;
                if (!(gatherLocsInteresting(x, y, GLOC_INTERESTING) || isCorridor))
                    continue;
                // do_screen_description() with looked=TRUE: the detailed
                // lookat() description replaces the symbol explanation
                // whenever the screen symbol is ambiguous.
                const firstMatch = await describeMapLocation(x, y);
                await pline_xy(x, y, `${firstMatch}.`);
            }
        }
    } finally {
        if (savedFilter === undefined) delete game.iflags.getloc_filter;
        else game.iflags.getloc_filter = savedFilter;
        if (savedAccessible === undefined) delete game.flags.accessiblemsg;
        else game.flags.accessiblemsg = savedAccessible;
    }
    game.context.move = 0;
}


// windows.c:getlin() frees only the popped command entry, so any key or
// direction C queued behind it stays queued for the next pop. Several
// canned kinds bundle that tail inside one JS entry (dothrow.c:575-576,
// dig.c:1104-1105, apply.c:1808-1809, 2966-2967, 3442-3443, 3745-3746 and
// the cmd.c act_on_act() chains): restore it onto the response queue. The
// drain only drops a canned entry after the response queue emptied, so
// appending preserves the C order — tail first, then the remaining
// canned commands.
export function restoreCannedCommandTail(canned: CannedCommand): void {
    if (canned.kind === 'rub' || canned.kind === 'apply' || canned.kind === 'wield') {
        queueCommandResponses([canned.invlet.charCodeAt(0)]);
    } else if (canned.kind === 'kick') {
        queueCommandResponses([{ dx: canned.dx, dy: canned.dy, dz: 0 }]);
    } else if (canned.kind === 'context-menu') {
        contextMenuResponses(canned.selection);
    }
}

// C iactions.c:itemactions_pushkeys(). The menu closes before the queued
// command runs; its object letter answers the later inventory prompt.
function inventoryActionCommand({ key, item }: InventoryAction): NativeCommand | null {
    const handlers: Record<InventoryAction['key'], string | null> = {
        '-': item === game.uwep ? 'dowield'
            : item === game.uswapwep ? 'remarm_swapwep'
                : item === game.uquiver ? 'dowieldquiver' : 'donull',
        'a': item.oclass === 8 && !(item.otyp === POT_OIL && objectTypeKnown(item)) ? 'dip_into' : 'doapply',
        'c': 'docallcmd', 'C': 'docallcmd', 'd': 'dodrop', 'e': 'doeat', 'E': 'doengrave', 'f': 'dofire',
        'i': 'doorganize', 'I': 'adjust_split', 'O': 'dosacrifice', 'p': 'dopay', 'P': 'dowear', 'q': 'dodrink',
        'Q': 'dowieldquiver', 'r': 'doread',
        'R': item.owornmask && item.owornmask & W_ACCESSORY ? 'ia_dotakeoff' : 'dorub',
        't': 'dothrow', 'T': item.oclass === 3 ? 'ia_dotakeoff' : 'dotip', 'V': 'doinvoke',
        'w': 'dowield', 'W': 'dowear', 'x': 'doswapweapon', 'X': 'dotwoweapon', 'z': 'dozap',
        '/': 'dowhatis', '\x1b': null, ' ': null, '\n': null, '\r': null,
    };
    return NATIVE_COMMANDS.find(command => command.handler === handlers[key]) ?? null;
}

// C do_wear.c:remarm_swapwep(). The one cmdq_pop() — CQ_REPEAT during a
// do-again replay, CQ_CANNED after — must yield the '-' item-action key
// (do_wear.c:3067-3080). Every other popped entry, or an empty queue,
// drops the entry and fails ECMD_FAIL; rhack() then clears both queues
// for that result. The success path resets a pending 'A', unwields
// uswapwep, and reports; it spends a turn only when the weapon left or
// its curse was revealed.
const HANDS_ITEM_KEY = '-'.charCodeAt(0);

async function remarmSwapwep(): Promise<void> {
    let key: number | undefined;
    if (game._inDoAgain) {
        const queued = takeRepeatCommand();
        if (queued?.kind === 'key') key = queued.key;
    } else {
        const response = takeCommandResponse();
        if (typeof response === 'number') key = response;
        else if (response === undefined) {
            // The queued command behind an empty response queue is the
            // popped entry: dropped, with its answer tail kept in order.
            const dropped = game._cannedCommands?.shift();
            if (dropped) restoreCannedCommandTail(dropped);
        }
    }
    if (key !== HANDS_ITEM_KEY || !game.uswapwep) {
        commandResultFailed();
        game.context.move = 0;
        return;
    }
    resetBulkTakeoff();
    const twoweap = game.u.twoweap;
    await setSecondaryWeapon(null, game);
    await plineWithContinuation(twoweap ? 'You are no longer wielding two weapons at once.'
        : 'You no longer have a second weapon readied.');
    game.context.move = 1;
}

// The context-sensitive inventory item actions.  The '-' secondary-weapon
// branch is C do_wear.c:remarm_swapwep(): reset a pending 'A', unwield
// uswapwep, and report; it spends a turn only when the weapon left or its
// curse was revealed.
async function executeInventoryAction({ key, item }: InventoryAction): Promise<void> {
    const letter = item.invlet;
    if (!letter || !game.inventory.includes(item)) {
        game.context.move = 0;
        return;
    }
    switch (key) {
    case '-':
        if (item === game.uwep) {
            queueCommandKeys('-');
            await dowield();
        } else if (item === game.uswapwep) {
            // iactions.c:148-153 queues [remarm_swapwep, '-']: the
            // unwield happens only when that queued '-' answers the pop
            // in remarmSwapwep() below.
            queueCommandKeys('-');
            await remarmSwapwep();
        } else if (item === game.uquiver) {
            queueCommandKeys('-');
            await doready();
        }
        return;
    case 'a':
        queueCommandKeys(letter);
        if (item.oclass === 8 && !(item.otyp === POT_OIL && objectTypeKnown(item))) await dipInto();
        else await doapply();
        return;
    case 'c': queueCommandKeys(`i${letter}`); await doname(); return;
    case 'C': queueCommandKeys(`o${letter}`); await doname(); return;
    case 'd': queueCommandKeys(letter); await dodrop(); return;
    case 'e':
        queueCommandKeys(letter);
        await doeat();
        return;
    case 'E': queueCommandKeys(letter); await doengrave(); return;
    case 'f': await dofire(); return;
    case 'i': queueCommandKeys(letter); await doadjust(); return;
    case 'I': queueCommandKeys(letter); await adjustSplit(); return;
    case 'O': queueCommandKeys(letter); await dosacrifice(); return;
    case 'p': queueCommandKeys(letter); await dopay(); return;
    case 'P': case 'W': queueCommandKeys(letter); await dowear(); return;
    case 'q':
        queueCommandKeys(letter);
        await doquaff();
        return;
    case 'Q': queueCommandKeys(letter); await doready(); return;
    case 'r': queueCommandKeys(letter); await readCommand(); return;
    case 'R':
        queueCommandKeys(letter);
        if ((item.owornmask ?? 0) & W_ACCESSORY) await removeWornItem('take off', true);
        else await dorub();
        return;
    case 'T':
        queueCommandKeys(letter);
        if ((item.owornmask ?? 0) & W_ARMOR) await removeWornItem('take off', true);
        else await tipCommand();
        return;
    case 't': queueCommandKeys(letter); await dothrow(); return;
    case 'w': queueCommandKeys(letter); await dowield(); return;
    case 'V': queueCommandKeys(letter); await doinvoke(); return;
    case 'x': await doswapweapon(); return;
    case 'X': await dotwoweapon(); return;
    case 'z': queueCommandKeys(letter); await dozap(); return;
    case '/': queueCommandKeys(`i${letter}`); await dowhatis(); return;
    case '\x1b': case ' ': case '\n': case '\r':
        game.context.move = 0;
        return;
    }
}

// C cmd.c:enter_explore_mode(). The pinned build's sysconf ships
// EXPLORERS=*, so authorize_explore_mode() always grants access; the
// "cannot access explore mode" and "Note: normally..." refusals stay
// unreachable for this environment.
async function enterExploreMode(): Promise<void> {
    if (game.flags.explore) {
        await pline('You are already in explore mode.');
    } else {
        const oldMode = game.flags.debug ? 'debug mode' : 'normal game';
        await pline(`Beware!  From explore mode there will be no return to ${oldMode},`);
        if (await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_QUIT),
            'Do you want to enter explore mode?')) {
            game.flags.explore = true;
            game.flags.debug = false;
            clearMessageWindow();
            await pline('You are now in non-scoring explore mode.');
        } else {
            clearMessageWindow();
            await pline(`Continuing with ${oldMode}.`);
        }
    }
    game.context.move = 0;
}

const EXTENDED_COMMAND_HANDLERS = new Map<string, () => Promise<unknown>>([
    ['?', showExtendedCommandList],
    ['whatdoes', whatDoesCommand],
    ['whatis', dowhatis],
    ['help', dohelp],
    ['glance', doquickwhatis],
    ['history', () => displayHelpFile('history')],
    ['showtrap', identifyTrap],
    ['versionshort', doversion],
    ['takeoffall', takeOffAll],
    ['conduct', doconduct],
    ['chronicle', doChronicle],
    ['perminv', doPermanentInventory],
    ['vanquished', doVanquished],
    ['genocided', doGenocided],
    ['terrain', doTerrainOverview],
    ['retravel', dotravelTarget],
    ['redraw', redrawCommand],
    ['optionsfull', () => doOptions(!game.iflags.menu_requested)],
    ['version', doextversion],
    ['quit', doquit],
    ['twoweapon', dotwoweapon],
    ['enhance', doenhance],
    ['chat', dochat],
    ['sit', () => dosit({
        finishTeleport: finishTeleportArrival,
        gotoLevel,
        chooseTeleportDestination: askTeleportDestination,
    })],
    ['pray', dopray],
    ['name', doname],
    ['invoke', doinvoke],
    ['ride', doride],
    ['rub', dorub],
    ['lookaround', dolookaround],
    ['loot', doloot],
    ['tip', tipCommand],
    ['force', doforce],
    ['exploremode', enterExploreMode],
    ['jump', dojump],
    ['overview', doDungeonOverview],
    ['offer', dosacrifice],
    ['dip', dodip],
    ['altdip', dipInto],
    ['turn', doturn],
    ['engrave', doengrave],
    // C extcmdlist[] maps both "call" and "name" to docallcmd().
    ['call', doname],
    ['untrap', () => doUntrap({ enterTrap: moveIntoFailedUntrap })],
    ['wipe', dowipe],
    ['monster', domonability],
    ['polyself', wizPolyself],
    ['panic', wizPanic],
    ['debugfuzzer', wizFuzzer],
    ['annotate', doannotate],
    ['herecmdmenu', doherecmdmenu],
    ['therecmdmenu', dotherecmdmenu],
    ['clicklook', doclicklook],
    ['mouseaction', domouseaction],
    ['adjust', doadjust],
    ['altadjust', adjustSplit],
    // cmd.c:2064 internal entry; #repeat reaches it after the item-actions
    // 'T' remembers ia_dotakeoff.
    ['alttakeoff', () => removeWornItem('take off', true)],
    ['altunwield', remarmSwapwep],
    ['levelchange', wizLevelChange],
    ['wizwhere', wizWhere],
    ['wizwish', wizWish],
    ['wizcast', dowizcast],
    ['wizgenesis', wizGenesis],
    ['wizdetect', wizDetect],
    ['wizsmell', () => wizSmell()],
    ['wizseenv', showSeenVectors],
    ['vision', showVisionFlags],
    ['wmode', showWallModes],
    ['wizrumorcheck', wizRumorCheck],
    ['wizcustom', wizCustom],
    ['wizbury', wizBury],
    ['wiztelekinesis', wizTelekinesis],
    ['migratemons', wizMigrateMonsters],
    ['wizkill', wizKill],
    ['wizidentify', wizIdentify],
    ['wizintrinsic', wizIntrinsic],
    ['wizmap', wizMap],
    ['wizmakemap', wizMakeMap],
    ['wizfliplevel', wizFlipLevel],
    ['wizborn', doborn],
    ['timeout', wizTimeoutQueue],
    ['wizshownhuuid', wizShowNhuuid],
]);

// C ref: cmd.c:domonability().
async function useSteedBreathAbility(steed: Monster) {
    requirePlayingGame(game);
    const result = await performPetRangedAttack(steed, game, { forced: true });
    if (result.heroDied || game.program_state.gameover) return;
    game.context.move = 1;
}

async function domonability() {
    const canHide = heroHasHidingAbility(game);
    const canSpinWeb = heroCanSpinWeb(game);
    const spiderChoice = canHide && canSpinWeb
        ? await chooseSpiderAbility() : null;
    if (canHide && canSpinWeb && !spiderChoice) {
        game.context.move = 0;
        return;
    }
    const breath = heroBreathAttack(game);
    if (breath) {
        const result = await useHeroBreath({
            state: game,
            attack: breath,
            finishMonsterKill: finishHeroMonsterKill,
        });
        if ('heroDied' in result && result.heroDied) return;
        // polyself.c:dobreathe() returns ECMD_CANCEL for a refused direction.
        if (!result.spentTime && result.reason === 'cancelled') commandResultCancelled();
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const spit = heroSpitAttack(game);
    if (spit) {
        const result = await useHeroSpit({ state: game, attack: spit });
        if ('heroDied' in result && result.heroDied) return;
        // polyself.c:dospit() returns ECMD_CANCEL for a refused direction.
        if (result.used === false && result.reason === 'cancelled') commandResultCancelled();
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanRemovePunishment(game)) {
        const result = await useHeroNymphAbility({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const gaze = heroGazeAttack(game);
    if (gaze) {
        const result = await useHeroGaze({ state: game, attack: gaze });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanSummonWerePack(game)) {
        const result = await useHeroWereSummon({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (spiderChoice === 'hide' || (!spiderChoice && canHide)) {
        const result = await useHeroHide({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (spiderChoice === 'spin' || (!spiderChoice && canSpinWeb)) {
        const result = await useHeroWeb({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanMindBlast(game)) {
        const result = await useHeroMindBlast({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanSplitLikeGremlin(game)) {
        const result = await useHeroGremlinSplit({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanUseUnicornHorn(game)) {
        const result = await useUnicornHorn({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanShriek(game)) {
        const result = await useHeroShriek({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanChangeVampireShape(game)) {
        const result = await useHeroVampireShift();
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const steed = game.u?.usteed;
    if (steed && monsterBreathAttack(steed)) {
        await useSteedBreathAbility(steed);
        return;
    }
    await pline(heroIsPolymorphed(game)
        ? 'Any special ability you may have is purely reflexive.'
        : "You don't have a special ability in your normal form!");
    game.context.move = 0;
}

interface ExtendedCommandInput {
    selected: NativeCommand | null;
    lastExecuted: NativeCommand | null;
}

// C cmd.c:doextcmd() runs the list inside its editor loop and retains the
// last executed command separately from the next editor selection.
async function readExtendedCommand(): Promise<ExtendedCommandInput> {
    let lastExecuted: NativeCommand | null = null;
    for (;;) {
        // tty_get_ext_cmd() calls its line editor directly, bypassing core
        // getlin()'s status suppression. Its prompt restores status after #?.
        const selected = game.flags.extmenu ? await extendedCommandMenu() : await editExtendedCommand();
        if (selected?.handler !== 'doextlist') return { selected, lastExecuted };
        if (!await commandAllowed(selected)) return { selected: null, lastExecuted };
        await showExtendedCommandList();
        lastExecuted = selected;
    }
}

// TTY's extended-command line editor redraws the prompt at every input
// boundary. Completion expands visually while typed input advances the cursor.
async function editExtendedCommand(): Promise<NativeCommand | null> {
    let command = '';
    let completion: string | null = null;
    const initiator = visibleCommandKey(game.commandBindings.keyForCommand('#'));
    // custompline(SUPPRESS_HISTORY) files the line before the prompt, then
    // the loop head makes the "# " line the current topline. show_topl()'s
    // addtopl() ends TOPLINE_SPECIAL_PROMPT as soon as it draws the prompt.
    await setTopline(`${initiator} `);
    game._toplines = `${initiator} `;
    game._pending_message = initiator;
    await flush_screen(1);
    game.nhDisplay?.setCursor(initiator.length + 1, 0);

    const redrawCommand = async () => {
        const displayedCommand = completion || command;
        game._toplines = command ? `${initiator} ${displayedCommand}` : `${initiator} `;
        game._pending_message = command
            ? `${initiator} ${displayedCommand}` : initiator;
        await flush_screen(1);
        const display = game.nhDisplay;
        const columns = display?.cols ?? COLNO;
        // A message-window getlin can physically wrap past the right edge.
        // tty's continuation begins at column 1; once wrapping starts it
        // clears that message row rather than exposing the map below it.
        if (display?.grid && game._pending_message.length >= columns) {
            display.clearRow(1);
            const continuation = game._pending_message.slice(columns);
            for (let index = 0; index < continuation.length; index++)
                display.setCell(1 + index, 1, continuation.charAt(index), NO_COLOR, 0);
        }
        // NEWAUTOCOMP leaves the insertion pointer immediately after the
        // physically typed prefix, not after its displayed suffix.
        const insertion = command.length + initiator.length + 1;
        if (insertion > columns - 1)
            display?.setCursor(insertion - (columns - 1), 1);
        else
            display?.setCursor(insertion, 0);
    };

    let doprev = false;
    for (;;) {
        const key = await nhgetch();
        if (key === 16) {
            // C win/tty/getline.c hooked_tty_getlin(): the "#" editor
            // browses history with ^P like any getlin, with inread clear
            // so full/combination modes page their windows. A wrapped
            // editor line pages on its first recall too.
            const mode = messageWindowMode();
            if (mode === 's' || (mode === 'c' && !doprev)) {
                if (!doprev) await doprevMessage(false);
                await doprevMessage(false);
                doprev = true;
            } else {
                await doprevMessage(false);
                doprev = false;
                game._messageHistoryCursor = null;
                // `*bufp = 0` drops the auto-completed suffix before repainting.
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        if (doprev) {
            // The first ordinary key after single-mode browsing only
            // repaints the prompt; the key itself is still processed.
            game._messageHistoryCursor = null;
            doprev = false;
            completion = null;
            await redrawCommand();
        }
        if (key === 27) {
            // tty_getlin(): Escape first clears non-empty input; only Escape
            // at an already empty prompt cancels the extended command.
            if (command) {
                command = '';
                completion = null;
                await redrawCommand();
                continue;
            }
            game._pending_message = '';
            game._retained_message = '';
            game._toplines = '';
            // getline.c:213 leaves TOPLINE_NON_EMPTY behind its prompt.
            game._promptOwnsTopline = false;
            game.nhDisplay?.clearRow(0);
            game.context.move = 0;
            return null;
        }
        if (key === 10 || key === 13) break;
        if (key === 8 || key === 127) {
            if (command) {
                command = command.slice(0, -1);
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        if (key === 21) {
            // The tty kill character clears both typed text and completion.
            if (command) {
                command = '';
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        const ch = String.fromCharCode(key);
        if (key < 32 || key === 127 || command.length >= COLNO) continue;
        command += ch;
        completion = completeExtendedCommand(command);
        await redrawCommand();
    }

    // tty_getlin() clears its message window on return. The completed
    // editor is not an unread message for a later cls() to acknowledge.
    game._pending_message = '';
    game._retained_message = '';
    game._toplines = '';
    game._promptOwnsTopline = false;
    game.nhDisplay?.clearRow(0);
    const normalizedCommand = (completion || command)
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    if (!normalizedCommand) {
        game._pending_message = '';
        game.nhDisplay?.clearRow(0);
        game.nhDisplay?.setCursor(game.u.ux - 1, game.u.uy + 1);
        game.context.move = 0;
        return null;
    }
    const selected = availableExtendedCommands().find(entry => entry.name === normalizedCommand);
    if (!selected) await pline(`${initiator}${normalizedCommand.slice(0, 60)}: unknown extended command.`);
    return selected ?? null;
}

// ── Extended-command list and autocomplete (C cmd.c:doextlist(),
//    extcmd_via_menu(), parseautocomplete(), handler_change_autocompletions()) ──

// C cmd.c:parseautocomplete() flips the AUTOCOMPLETE flag on individual
// extcmdlist entries at runtime. The generated command table is immutable,
// so configuration adjustments live in this overlay.
const autocompleteOverrides = new Map<string, boolean>();

export function setCommandAutocomplete(name: string, enabled: boolean): void {
    const command = NATIVE_COMMANDS.find(entry => entry.name === name);
    if (command && enabled === !!(command.flags & NATIVE_COMMAND_FLAGS.AUTOCOMPLETE)) autocompleteOverrides.delete(name);
    else autocompleteOverrides.set(name, enabled);
}

// One native process parses one rc file; the overrides must not outlive an
// engine start in this port.
export function resetCommandAutocomplete(): void {
    autocompleteOverrides.clear();
}

export function commandAutocompletes(command: NativeCommand): boolean {
    const override = command.name !== null ? autocompleteOverrides.get(command.name) : undefined;
    return override !== undefined ? override : !!(command.flags & NATIVE_COMMAND_FLAGS.AUTOCOMPLETE);
}

// C cmd.c:count_autocompletions() counts changes from the compiled defaults.
export function countCommandAutocompletions(): number {
    return autocompleteOverrides.size;
}

// This editor includes wizard commands even during ordinary play, as C does.
// C cmd.c:handler_change_autocompletions().
export async function changeCommandAutocompletions(): Promise<void> {
    const commands = NATIVE_COMMANDS.filter(command => command.name !== null
        && command.name.length >= 2
        && !(command.flags & (NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE | NATIVE_COMMAND_FLAGS.INTERNALCMD)));
    const window = tty_create_nhwindow<NativeCommand>(NHW_MENU);
    await tty_start_menu(window);
    for (const command of commands) {
        tty_add_menu(window, { identifier: command,
            text: `${autocompleteOverrides.has(command.name ?? '') ? '*' : ' '} ${command.name}: ${commandDescription(command)}`,
            itemflags: commandAutocompletes(command) ? MENU_ITEMFLAGS_SELECTED : 0 });
    }
    tty_end_menu(window, 'Which commands autocomplete?');
    const result = await tty_select_menu(window, PICK_ANY);
    await tty_destroy_nhwindow(window);
    if (result.cancelled) return;
    const selected = new Set(result.selections.map(item => item.identifier));
    for (const command of commands) {
        if (command.name !== null) setCommandAutocomplete(command.name, selected.has(command));
    }
}

export function availableExtendedCommands(): NativeCommand[] {
    return NATIVE_COMMANDS.filter(command => command.name !== null
        && !(command.flags & (NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE | NATIVE_COMMAND_FLAGS.INTERNALCMD))
        && (game.flags.debug || !(command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD)));
}


export function commandDescription(command: NativeCommand): string {
    // update_rest_on_space() binds its own wait entry with a distinct description.
    if (command.name === 'wait' && command.key === 32)
        return "rest one move via 'rest_on_space' option";
    return COMMAND_DESCRIPTIONS.get(command.name ?? '') ?? '';
}

// C cmd.c:extcmd_via_menu().
export async function extendedCommandMenu(): Promise<NativeCommand | null> {
    let prefix = '';
    let biggest = 0;
    for (;;) {
        const choices = availableExtendedCommands().filter(command =>
            commandAutocompletes(command) && command.name?.startsWith(prefix));
        if (choices.length <= 1) return choices[0] ?? null;
        biggest = Math.max(biggest, ...choices.map(command => commandDescription(command).length));
        const window = tty_create_nhwindow<string>(NHW_MENU);
        await tty_start_menu(window);
        const onePerLine = choices.length < ROWNO - 3;
        let previous = '', text = '', count = 0, wrapped = false;
        const flush = () => {
            tty_add_menu(window, { identifier: previous, selector: previous,
                text: text.padEnd(biggest + 15) });
        };
        for (const [index, command] of choices.entries()) {
            const name = command.name ?? '';
            const initial = name.charAt(prefix.length);
            if (initial !== previous || onePerLine) wrapped = false;
            if (initial !== previous || onePerLine
                || (count >= 2 && text.length + 4 + name.length >= COLNO - 6)) {
                if (count) {
                    flush();
                    count = 0;
                    if (initial === previous && !onePerLine) wrapped = true;
                }
            }
            previous = initial;
            if (!count || onePerLine)
                text = `${wrapped ? 'or ' : ''}${name} [${commandDescription(command)}]`;
            else if (count === 1)
                text = `${wrapped ? 'or ' : ''}${choices[index - 1]?.name ?? ''} or ${name}`;
            else text += ` or ${name}`;
            count++;
        }
        if (count) flush();
        tty_end_menu(window, `Extended Command: ${prefix}`);
        const result = await tty_select_menu(window, PICK_ONE);
        await tty_destroy_nhwindow(window);
        const selected = result.selections[0]?.identifier;
        if (selected) prefix += selected;
        else if (prefix) prefix = '';
        else return null;
    }
}

// A list entry is informational. Only the list controls are selectable.
// C cmd.c:doc_extcmd_flagstr().
// C cmd.c:accept_menu_prefix().
export async function showExtendedCommandList(): Promise<void> {
    let autocompleteOnly = false, oneList = false, search = '';
    for (;;) {
        const window = tty_create_nhwindow<string>(NHW_MENU);
        await tty_start_menu(window);
        const label = (text: string) => tty_add_menu(window, { identifier: null, text });
        const option = (key: string, text: string, group = '') => tty_add_menu(window,
            { identifier: key, selector: key, group, text });
        label('Extended Commands List');
        label('');
        option('a', `Switch to ${autocompleteOnly ? 'including' : 'excluding'} commands that don't autocomplete`);
        if (!search) option(':', 'Search extended commands', 's');
        else option('s', `Switch back from search ("${search}")`, ':');
        if (game.flags.debug) option('z', oneList
            ? 'Switch to showing debugging commands in separate section'
            : 'Switch to showing all alphabetically, including debugging commands');
        label('');
        let found = 0;
        for (const wizardSection of oneList || !game.flags.debug ? [false] : [false, true]) {
            const entries = availableExtendedCommands().map(command => ({
                command, description: listedCommandDescription(command),
            })).filter(({ command, description }) =>
                (oneList || !!(command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD) === wizardSection)
                && (!autocompleteOnly || commandAutocompletes(command))
                && (!search || matchesSearch(command.name ?? '', search)
                    || matchesSearch(description, search)));
            if (!entries.length) continue;
            addMenuHeading(window, wizardSection ? 'Debugging Extended Commands' : 'Extended commands');
            for (const { command, description } of entries) {
                const markers = `${command.flags & NATIVE_COMMAND_FLAGS.CMD_M_PREFIX ? 'm' : ''}${commandAutocompletes(command) ? 'A' : ''}`;
                label(` ${(command.name ?? '').padEnd(14)} ${(markers ? `[${markers}]` : '').padStart(4)} ${description}`);
                found++;
            }
            label('');
        }
        if (search && !found) label('no matches');
        else {
            label('[A] Command autocompletes');
            label(`[m] Command accepts '${visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'))}' prefix`);
        }
        tty_end_menu(window);
        const result = await tty_select_menu(window, PICK_ONE);
        await tty_destroy_nhwindow(window);
        const action = result.selections[0]?.identifier;
        if (action === 'a') autocompleteOnly = !autocompleteOnly;
        else if (action === 'z') { oneList = !oneList; search = ''; }
        else if (action === 's') search = '';
        else if (action === ':') {
            const phrase = await getLine('Extended command list search phrase?', (_ch, key) => key >= 32);
            search = phrase?.trim().replace(/\s+/g, ' ') ?? '';
            if (!search) {
                game.context.move = 0;
                return;
            }
        } else {
            game.context.move = 0;
            return;
        }
    }
}

// C doextlist() changes the description before both searching and display.
function listedCommandDescription(command: NativeCommand): string {
    const description = commandDescription(command);
    if (game.flags.debug || game.flags.explore || !(command.flags & NATIVE_COMMAND_FLAGS.GENERALCMD))
        return description;
    return description.replace(' been genocided or become extinct', ' been genocided');
}

function matchesSearch(text: string, pattern: string): boolean {
    if (text.toLowerCase().includes(pattern.toLowerCase())) return true;
    const expression = [...pattern].map(character => character === '*' ? '.*'
        : character === '?' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return new RegExp(`^${expression}$`, 'i').test(text);
}


// C refs: cmd.c dotravel(), getpos.c getpos(), hack.c handle_tip(), and
// dat/nhcore.lua show_getpos_tip().  The tty message window and the Lua text
// window own distinct input boundaries; after the tutorial, getpos retains
// its cursor and accepts terrain-symbol cycling before one of the pick keys.
async function dotravel(): Promise<void> {
    game.iflags.getloc_travelmode = true;
    // C cmd.c dotravel(): the travel pline precedes getpos() and joins the
    // instructions pline in the tty topline transaction; only the menu path
    // skips both.
    if (!game.iflags.menu_requested) await pline('Where do you want to travel to?');
    // getpos_menu() omits auto_describe()'s travel-path warning.
    const cursor = game.iflags.menu_requested
        ? await selectTravelMenuPosition(lookatDescription)
        : await selectMapPosition({
        start: game._travelTarget
            ? { ...game._travelTarget } : { x: game.u.ux, y: game.u.uy },
        prompt: async () => {
            // getpos() consumes a queued direction before handle_tip() and
            // the instructions line; only keyboard selection needs these.
            const firstUse = await showGetposTip();
            await showGetposInstructions();
            if (firstUse) await pline('Move cursor to the desired destination:');
            return game._pending_message;
        },
        goal: 'the desired destination',
    });
    if (!cursor) {
        game.iflags.getloc_travelmode = false;
        // dotravel() returns ECMD_OK for menu dismissal, ECMD_CANCEL for ESC
        // in getpos(). Only the latter discards both command queues.
        if (game.iflags.menu_requested) game.context.move = 0;
        else commandResultCancelled();
        return;
    }

    // getpos() leaves its painted location description on the physical tty
    // after the pick key, but removes it from the logical topline transaction.
    // Silent travel can retain that row; a new attack must replace rather than
    // append to "staircase down".
    game._pending_message = '';
    game._travelTarget = { x: cursor.x, y: cursor.y };
    await dotravelTarget();
}

// C cmd.c:dotravel_target(). Keyboard travel and retravel share the first
// movement transaction, including the time spent on an unreachable target.
async function dotravelTarget(): Promise<void> {
    const target = game._travelTarget;
    if (!target || !isok(target.x, target.y)) {
        await pline('No travel destination set.');
        game.context.move = 0;
        return;
    }
    if (target.x === game.u.ux && target.y === game.u.uy) {
        game._travelTarget = null;
        await pline('You are already here.');
        game.context.move = 0;
        return;
    }
    game.iflags.getloc_travelmode = false;
    const state = startTravel(target.x, target.y);
    const outcome = await domove(game.u.dx ?? 0, game.u.dy ?? 0);
    const moved = outcome === 'time';
    if (game.program_state.gameover) return;
    // C domove_core() skips runmode_delay_output() on early returns,
    // including attacks, blocked steps and the final travel pet bump.
    // A refused pet swap reaches the tail after restoring the hero.
    const reachedTail = !!game._domoveReachedTail;
    if (moved && reachedTail) await captureRunmodeDelay(game, !!game.context.run || game.multi > 0);
    // The target-selection command itself is time-consuming.  A blocked
    // first step stops travel but still reaches the monster/global turn.
    game.context.move = 1;
    const arrived = game.u.ux === state.targetX && game.u.uy === state.targetY;
    if (arrived) game._travelTarget = null;
    if (!moved && outcome !== 'opened-door') stopRun();
    // Only findtravelpath()'s own nomul(0)-then-run=8 paths (the adjacent
    // shortcut and the backward-search arrival) keep C's lingering run at
    // 8.  A step that entered the target without one of those ends at C's
    // found: label instead: nomul(0) leaves run 0 with the repaint pending.
    else if (arrived && !game._runState) arriveTravel(game);
    else if (arrived) stopRun();
    // Pathfinding can end travel without entering the target. Keep
    // C's restored run value and let screen flushes own time updates.
    else if (!game._runState && game.context.run === 8) arriveTravel(game);
}

async function doversion(): Promise<void> {
    if (game.iflags.menu_requested) await doextversion();
    else await pline(NATIVE_VERSION);
    game.context.move = 0;
}

// ── Command, repeat-queue, and result types ──────────────────────────────

export type NativeCommand = CommandDefinition;

// The selected action retains its command even when it has no one-byte key.
export interface CommandBinding {
    key: number | null;
    command: NativeCommand | null;
    parameter: string | null;
}

export type RepeatCommandEntry =
    | { kind: 'command'; binding: CommandBinding }
    | { kind: 'key'; key: number }
    | { kind: 'count'; count: number };

export type CannedCommand =
    | { kind: 'rub' | 'apply' | 'wield'; invlet: string }
    | { kind: 'swap-weapon' }
    | { kind: 'kick'; dx: number; dy: number }
    | { kind: 'reqmenu' }
    | { kind: 'inventory-action'; action: InventoryAction }
    | { kind: 'fire'; shotLimit: number }
    | { kind: 'context-menu'; selection: ContextMenuSelection }
    | { kind: 'command'; name: string };

export type DirectionalRunMode = 0 | 1 | 2 | 3;

export interface MovementAttempt {
    walk: boolean;
    rush: boolean;
}

export interface DirectionalRunState {
    mode: DirectionalRunMode;
    dx: number;
    dy: number;
}

export interface TravelRunState {
    mode: 8;
    targetX: number;
    targetY: number;
}

export type RunState = DirectionalRunState | TravelRunState;

export interface ArmorCompletion {
    object: GameObject;
    _runmodeRetainedTopline?: TerminalCell[] | undefined;
    kind: 'wear' | 'remove';
}

// C ga.afternmv: every setter replaces the one pending completion.
export type AfterMove = ArmorCompletion
    | { kind: 'end-mimic-meal' | 'hear-again' | 'unfaint' | 'finish-digestion' | 'finish-prayer' | 'steal' | 'unstolen-armor' };

export interface CommandInput {
    key: number;
    count: number;
}



// ── Key-binding menus (C cmd.c:handler_rebind_keys*(), count_bind_keys(),
//    get_changed_key_binds()) ────────────────────────────────────────────

// cmd.c count_bind_keys(): user rebinds plus default keys that no longer
// have their command bound.
export function countBindKeys(): number {
    const bound = new Set(game.commandBindings.bindings.map(binding => binding.key));
    let count = 0;
    for (const binding of game.commandBindings.bindings)
        if (binding.user && binding.command && binding.command.key !== binding.key) count++;
    for (const command of NATIVE_COMMANDS)
        if (command.key && !bound.has(command.key)) count++;
    return count;
}

// cmd.c get_changed_key_binds(): the "BIND=key:command" config rows.
export function changedKeyBindsLines(): string[] {
    const bound = new Set(game.commandBindings.bindings.map(binding => binding.key));
    const lines: string[] = [];
    for (const binding of game.commandBindings.bindings) {
        if (!binding.user || !binding.command || binding.command.key === binding.key) continue;
        const parameter = binding.command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM
            && binding.parameter !== null ? `(${binding.parameter})` : '';
        lines.push(`BIND=${keyText(binding.key)}:${binding.command.name}${parameter}`);
    }
    for (const command of NATIVE_COMMANDS)
        if (command.key && !bound.has(command.key))
            lines.push(`BIND=${keyText(command.key)}:nothing`);
    return lines;
}

// cmd.c handler_rebind_keys_add(): keyfirst asks for the key before showing
// the command list, otherwise the key is asked after a command is chosen.
async function handlerRebindKeysAdd(keyfirst: boolean): Promise<void> {
    let key = 0;
    if (keyfirst) {
        await pline('Bind which key? ');
        renderKeyPrompt('Bind which key? ');
        key = (await pgetchar()) & 255;
        if (!key || key === 27) return;
    }

    type Row = { value: number; text: string } | { selectable: false; text: string };
    const rows: Row[] = [];
    if (key) {
        const binding = game.commandBindings.lookup(key);
        rows.push(binding?.command
            ? { selectable: false as const, text: `Key '${keyText(key)}' is currently bound to "${binding.command.name}".` }
            : { selectable: false as const, text: `Key '${keyText(key)}' is not bound to anything.` });
        rows.push({ selectable: false, text: '' });
    }
    // The unbind row carries identifier -1; command rows keep their
    // extcmdlist index + 1, as C's add_menu identifiers do.
    rows.push({ value: -1, text: 'nothing: unbind the key' });
    rows.push({ selectable: false, text: '' });
    for (const [index, command] of NATIVE_COMMANDS.entries()) {
        if (command.flags & (NATIVE_COMMAND_FLAGS.MOVEMENTCMD
            | NATIVE_COMMAND_FLAGS.INTERNALCMD | NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE)) continue;
        rows.push({ value: index + 1,
            text: `${command.name}: ${COMMAND_DESCRIPTIONS.get(command.name ?? '') ?? ''}` });
    }
    const picks = await showMultiSelectWindow<number>({
        title: key ? `Bind '${keyText(key)}' to what command?` : 'Bind what command?',
        omitHeadings: true, pickOne: true, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows }],
    });
    if (!picks || !picks.length) return;
    const pick = picks[0];
    if (pick === undefined) return;

    let commandText: string;
    let command: NativeCommand | null = null;
    if (pick === -1) {
        commandText = 'nothing';
    } else {
        command = NATIVE_COMMANDS[pick - 1] ?? null;
        if (!command) return;
        if (command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM) {
            const answer = await getLine(`Command ${command.name} requires a parameter:`,
                (_character: string, keyCode: number) => keyCode >= 32 && keyCode < 127);
            // mungspaces() condenses the answer; an ESC stays in the buffer
            // and ends up inside the binding parameter, as in C.
            const parameter = (answer ?? '\x1b').replace(/\s+/g, ' ').trim();
            commandText = `${command.name}(${parameter})`;
        } else {
            commandText = command.name ?? '';
        }
    }

    if (!key) {
        await pline('Bind which key? ');
        renderKeyPrompt('Bind which key? ');
        key = (await pgetchar()) & 255;
        if (!key || key === 27) return;
    }

    const previous = game.commandBindings.lookup(key);
    const result = game.commandBindings.bindKey(key, commandText, true);
    if (result.error) {
        // cfgfiles.c:config_erradd() prints interactive errors immediately;
        // tty_wait_synch() then displays the map without waiting for a key.
        await pline(`${result.error}${/[.!?]$/.test(result.error) ? '' : '.'}`);
        await flush_screen(1);
    }
    if (result.accepted) {
        // cmdbind_add() updates an existing binding in place. Its caller
        // therefore sees the new command through prevcmd too.
        if (previous?.command && previous.command !== command)
            await pline(`Changed key '${keyText(key)}' from "${previous.command.name}" to "${commandText}".`);
        else if (!previous?.command)
            await pline(`Bound key '${keyText(key)}' to "${commandText}".`);
    } else {
        await pline('Key binding failed?!');
    }
}

// cmd.c handler_rebind_keys(): the "Do what?" pick list, redone after every
// action until it is cancelled.
export async function handlerRebindKeys(): Promise<void> {
    for (;;) {
        const rows: { value: number; text: string }[] = [
            { value: 1, text: 'bind key to a command' },
            { value: 2, text: 'bind command to a key' },
        ];
        if (countBindKeys()) rows.push({ value: 3, text: 'view changed key binds' });
        const picks = await showMultiSelectWindow<number>({
            title: 'Do what?', omitHeadings: true, pickOne: true, signalEscape: true,
            pageLocalKeys: true,
            sections: [{ items: rows }],
        });
        if (!picks || !picks.length) return;
        if (picks[0] === 1) await handlerRebindKeysAdd(true);
        else if (picks[0] === 2) await handlerRebindKeysAdd(false);
        else if (picks[0] === 3) await showTextWindow(changedKeyBindsLines());
    }
}

// C cmd.c:parseautocomplete(): splits on the first comma, else the first
// colon, processes the remainder first, then requires an exact (case
// sensitive) extended-command name.
export function parseAutocompleteStatement(value: string, addRawError: (message: string) => void): void {
    let separator = value.indexOf(',');
    if (separator < 0) separator = value.indexOf(':');
    if (separator >= 0) {
        parseAutocompleteStatement(value.slice(separator + 1), addRawError);
        value = value.slice(0, separator);
    }
    value = value.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (!value) return;
    let condition = true;
    if (value.startsWith('!')) {
        value = value.slice(1).replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
        condition = false;
    }
    if (!NATIVE_COMMANDS.some(command => command.name === value)) {
        addRawError(`Bad autocomplete: invalid extended command '${value}'.`);
        return;
    }
    setCommandAutocomplete(value, condition);
}


// ── Runtime command counts and results (C cmd.c:rhack(), reset_cmd_vars()) ──

// C command handlers return an ECMD_* status which rhack() inspects after
// the command finishes (cmd.c:3810): ECMD_CANCEL and ECMD_FAIL make it call
// reset_cmd_vars(TRUE), clearing CQ_CANNED and CQ_REPEAT. JS handlers run
// before that seam, so they record the same bits here instead.
export function beginCommandResult(state: GameState = game): void {
    state._commandResult = ECMD_OK;
}

// Multiple failure paths can combine bits exactly like a C return value
// (use_pole() returns res|ECMD_CANCEL after an already-timed wield).
export function commandResultCancelled(state: GameState = game): void {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_CANCEL;
}

export function commandResultFailed(state: GameState = game): void {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_FAIL;
}

// doapply() ORs arti_speak()'s ECMD_TIME into the tool result
// (apply.c:4422), so a cancelled tool use by a speaking artifact still
// spends its turn.
export function commandResultSpentTime(state: GameState = game): void {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_TIME;
}

// C refs: cmd.c set_move_cmd(run=1) and hack.c lookaround().
export function startRun(dx: number, dy: number, g: GameState = game, mode: DirectionalRunMode = 1): DirectionalRunState {
    g._runState = {
        dx, dy,
        mode,
    };
    g.lastStrTurn = 0;
    // C's DOMOVE_RUSH dispatch grants the movement ration whenever the
    // repeat begins, regardless of the surviving context.run value.
    if (!g.multi) g.multi = Math.max(COLNO, ROWNO);
    g.context.run = mode;
    g.context.mv = true;
    return g._runState;
}

// C rhack()'s DOMOVE_WALK dispatch (cmd.c:3785-3788): a counted direction
// only marks the repeat active.  context.run keeps whatever value an
// earlier rush or travel left behind, as does the last corridor turn.
// No movement ration is granted.
export function startWalkRepeat(dx: number, dy: number, g: GameState = game): DirectionalRunState {
    g._runState = { dx, dy, mode: 0 };
    g.context.mv = true;
    return g._runState;
}
// C cmd.c:reset_cmd_vars(). Full command_count belongs to the next parse.
// Unlike end_running(), reset_cmd_vars() zeroes context.run directly: no
// time repaint is queued and the terrain classifier is not recomputed.
export function resetCommandVariables(clearQueues: boolean): void {
    game.context.run = 0;
    game._travelMap = undefined;
    game._runState = null;
    game.context.mv = false;
    game.context.travel = false;
    game.context.travel1 = false;
    game.context.nopick = false;
    game.context.forcefight = false;
    game.context.move = 0;
    setMulti(0);
    game.iflags.menu_requested = false;
    game._movementAttempt = null;
    if (clearQueues) {
        clearCannedCommands();
        clearRepeatCommand();
    }
}


// C cmd.c:reset_occupations(): forget resumable occupation state whose
// target may have changed since the occupation was interrupted.
export function resetOccupations(state: GameState = game): void {
    resetBulkTakeoff(state);
    resetPick(state);
    resetTrapSetting(state);
}

// C cmdq_clear(CQ_CANNED): commands and their answers share one queue.
export function clearCannedCommands(state: GameState = game): void {
    state._cannedCommands = [];
    clearCommandKeys();
}

export type QueuedKey = { key: number } | 'none' | 'user-input' | 'cancel';

// C cmd.c:cmdq_pop() (cmd.c:408-419) for prompt owners which only accept
// CMDQ_KEY answers: the shared CQ_CANNED head is the oldest response entry
// first, then the oldest canned command with its bundled answer tail. A
// queued direction or extended command hits every such owner's "anything
// else" branch — the popped entry is dropped and cmdq_clear(CQ_CANNED)
// discards the rest (invent.c:1817-1818, cmd.c:5508-5509, pager.c:1700-
// 1703, do_name.c:516-518) — so this helper performs that clear. A
// CMDQ_USER_INPUT entry keeps the remaining queue and reaches the
// caller's live-input path (invent.c:1798); do-again replays pop CQ_REPEAT
// through takeRepeatCommand() instead and never call this.
export function takeQueuedKey(): QueuedKey {
    const response = takeCommandResponse();
    if (typeof response === 'number') return { key: response };
    if (response === 'user-input') return 'user-input';
    if (typeof response === 'object') {
        clearCannedCommands();
        return 'cancel';
    }
    if (game._cannedCommands?.length) {
        clearCannedCommands();
        return 'cancel';
    }
    return 'none';
}

// C getpos.c:812-826: getpos()'s one cmdq_pop() answers a horizontal
// CMDQ_DIR with the spot next to the hero; every other queued entry — a
// key, a vertical direction, the user-input placeholder, or a queued
// extended command — drops that entry, clears CQ_CANNED, and returns -1.
// The whole queued fast path is skipped while a do-again replay owns the
// input (getpos.c:814), so undefined hands the caller its cursor loop.
export function takeQueuedAdjacentPosition(): Position | null | undefined {
    if (game._inDoAgain) return undefined;
    const response = takeCommandResponse();
    if (response === undefined) {
        if (game._cannedCommands?.length) {
            clearCannedCommands();
            return null;
        }
        return undefined;
    }
    if (typeof response === 'object' && response.dz === 0)
        return { x: game.u.ux + response.dx, y: game.u.uy + response.dy };
    clearCannedCommands();
    return null;
}

// C has one multi counter; involuntary delays have a positive mirror here.
export function currentMulti(state: GameState = game): number {
    const helplessTurns = state._helplessTurns ?? 0;
    if (helplessTurns > 0) return -helplessTurns;
    return state.multi;
}

// Direct native assignments (combat wake, life saving, unmul, countdown)
// must change the same counter that nomul() compares during this turn.
export function setMulti(value: number, state: GameState = game): void {
    state.multi = value;
    state._helplessTurns = Math.max(0, -value);
}

// Native multi < 0 includes sleep, paralysis, prayer, and delayed actions.
export function heroHasInvoluntaryDelay(state: GameState = game): boolean {
    return currentMulti(state) < 0;
}

// ── Command counts (C cmd.c:get_count(), parse()) ─────────────────────────

export async function readCommandInput(): Promise<CommandInput> {
    game._commandCount = 0;
    setMulti(0);
    await flush_screen(1);
    let result: CommandInput;
    if (game.commandBindings.numberPad) {
        const key = await readchar('command');
        result = (key & 255) === game.commandBindings.specialKey('count')
            ? await readCommandCount() : { key, count: 0 };
    } else {
        result = await readCommandCount();
    }
    game._commandCount = result.count;
    setMulti(Math.max(0, result.count - 1));
    game._commandKey = result.key;
    // C parse() clears WIN_MESSAGE after reading the command key.
    if (game._pending_message || game._retained_message || game._promptOwnsTopline)
        clearMessageWindow();
    return result;
}

async function readCommandCount(): Promise<CommandInput> {
    let count = 0;
    let backspaced = false;
    for (;;) {
        const key = await readchar('command');
        let showZero = false;
        if (key >= 48 && key <= 57) {
            count = Math.min(NATIVE_COMMAND_CONSTANTS.LARGEST_INT,
                count * 10 + key - 48);
            showZero = key === 48;
        } else if (key === 8 || key === 127) {
            if (!count) return { key, count: 0 };
            count = Math.trunc(count / 10);
            backspaced = true;
        } else {
            return { key, count: key === 27 ? 0 : count };
        }
        if (count > 9 || backspaced) {
            const text = backspaced && !count && !showZero
                ? 'Count: ' : `Count: ${count}`;
            if (count || showZero) backspaced = false;
            clearMessageWindow();
            await setTopline(text);
            await flush_screen(0);
            game.nhDisplay?.setCursor(text.length, 0);
        }
    }
}


// C cmd.c:get_count(): only a positive typed count is passed on by getobj.
// Backspace edits the count; counts above nine are echoed.
export async function readInventoryCount(firstKey: number): Promise<{ key: number; count: number }> {
    let count = 0, key = firstKey, backspaced = false;
    for (;;) {
        let showZero = false;
        if (key >= 48 && key <= 57) {
            count = Math.min(NATIVE_COMMAND_CONSTANTS.LARGEST_INT, count * 10 + key - 48);
            showZero = key === 48;
        } else if (key === 8 || key === 127) {
            if (!count) {
                putMessageHistory(`Count: ${count} ${keyText(key)}`);
                return { key, count: 0 };
            }
            count = Math.trunc(count / 10);
            backspaced = true;
        } else {
            const finalCount = key === 27 ? 0 : count;
            // C get_count(GC_SAVEHIST): the final count and the accepting
            // key join the recall history; Escape breaks with a zero count.
            putMessageHistory(`Count: ${finalCount} ${keyText(key)}`);
            return { key, count: finalCount };
        }
        if (count > 9 || backspaced) {
            const text = backspaced && !count && !showZero ? 'Count: ' : `Count: ${count}`;
            if (count || showZero) backspaced = false;
            clearMessageWindow();
            // The echo itself is custompline(SUPPRESS_HISTORY).
            await setTopline(text);
            await flush_screen(0);
            game.nhDisplay?.setCursor(text.length, 0);
        }
        key = await readchar();
    }
}

// ── Named command keys (C cmd.c:cmd_from_ecname(), cmd_from_func()) ──────

const DEFAULT_COMMAND_KEYS = new Map([
    ['#', '#'],
    ['apply', 'a'], ['attributes', String.fromCharCode(24)],
    ['autopickup', '@'],
    ['cast', 'Z'], ['close', 'c'], ['known', '\\'], ['knownclass', '`'], ['down', '>'],
    ['drop', 'd'], ['droptype', 'D'], ['eat', 'e'], ['fire', 'f'], ['fight', 'F'],
    ['glance', ';'], ['help', '?'], ['inventory', 'i'],
    ['kick', String.fromCharCode(4)], ['look', ':'],
    ['moveeast', 'l'], ['movenorth', 'k'], ['movenortheast', 'u'],
    ['movenorthwest', 'y'], ['movesouth', 'j'], ['movesoutheast', 'n'],
    ['movesouthwest', 'b'], ['movewest', 'h'],
    ['open', 'o'], ['options', 'O'], ['pay', 'p'], ['pickup', ','], ['puton', 'P'],
    ['quaff', 'q'], ['quiver', 'Q'], ['read', 'r'], ['remove', 'R'],
    ['reqmenu', 'm'], ['run', 'G'], ['rush', 'g'], ['save', 'S'],
    ['search', 's'], ['swap', 'x'],
    ['prevmsg', String.fromCharCode(16)],
    ['seeamulet', '"'], ['seearmor', '['], ['seerings', '='], ['seeweapon', ')'],
    ['seetools', '('], ['seeall', '*'], ['inventtype', 'I'],
    ['showgold', '$'], ['showspells', '+'], ['terrain', String.fromCharCode(127)],
    ['takeoff', 'T'], ['throw', 't'], ['travel', '_'],
    ['up', '<'], ['wait', '.'], ['wear', 'W'],
    ['wield', 'w'], ['zap', 'z'],
    ['teleport', String.fromCharCode(20)], ['wizgenesis', String.fromCharCode(7)],
    ['wizlevelport', String.fromCharCode(22)], ['wizmap', String.fromCharCode(6)],
    ['wizwish', String.fromCharCode(23)],
]);

// C reset_commands() gives Ctrl-direction keys their rush bindings.
const CONTROL_RUSH_DIRECTION = new Map([
    [2, 'b'], [8, 'h'], [10, 'j'], [11, 'k'],
    [12, 'l'], [14, 'n'], [21, 'u'], [25, 'y'],
]);

export function controlRushDirection(key: number): string | null {
    return CONTROL_RUSH_DIRECTION.get(key) || null;
}

// These keys select existing JS handlers; they are not the live key map.
export function commandExecutionKey(command: string | null | undefined): string | null {
    if (!command) return null;
    const direct = DEFAULT_COMMAND_KEYS.get(command);
    if (direct) return direct;
    for (const mode of ['run', 'rush']) {
        if (!command?.startsWith(mode)) continue;
        const direction = DEFAULT_COMMAND_KEYS.get(`move${command.slice(mode.length)}`);
        if (direction) return mode === 'run' ? direction.toUpperCase()
            : String.fromCharCode(direction.charCodeAt(0) & 31);
    }
    return null;
}

// movecmd() recognizes a bound handler, including run/rush and vertical
// movement. This projection keeps the existing direction consumers on one
// coordinate alphabet without treating that alphabet as the live bindings.
export function movementDirectionKey(key: number, bindings: CommandBindings): string {
    const movement = bindings.movementForKey(key);
    return movement ? 'hykulnjb><'.charAt(movement.direction) : '';
}

export function promptedDirectionKey(key: number, bindings: CommandBindings): string {
    if (key === bindings.specialKey('getdir.self')
        || key === bindings.specialKey('getdir.self2')) return '.';
    return movementDirectionKey(key, bindings);
}

export function visibleCommandKey(code: number): string {
    code &= 255;
    if (code >= 128) return `M-${visibleCommandKey(code & 127)}`;
    if (code < 32) return `^${String.fromCharCode(code + 64)}`;
    if (code === 127) return '^?';
    return String.fromCharCode(code);
}

// C cmd.c:cmd_from_ecname().
export function commandKeyDescription(command: string, bindings: CommandBindings): string {
    const name = String(command);
    if (!NATIVE_COMMANDS.some(entry => entry.name === name)) return '';
    const key = bindings.keyForCommand(name);
    return key ? visibleCommandKey(key) : `#${name}`;
}

// ── Repeat queue (C cmd.c:CQ_REPEAT, cmdq_add_ec()) ───────────────────────

// C cmd.c:cmdq_clear() for the repeat queue.
export function clearRepeatCommand(): void {
    game._repeatCommands = [];
}

// C cmd.c:cmdq_add_ec() pushes the resolved command into CQ_REPEAT.
// Commands retain their selected handler; object choices retain inventory
// letters so repeating acts on the current inventory.
export function rememberCommand(binding: CommandBinding, append: boolean): void {
    if (game._inDoAgain) return;
    if (!append) clearRepeatCommand();
    game._repeatCommands ??= [];
    // cmdq_add_ec() looks up the first table entry for the function. Aliases
    // such as #name therefore repeat as #call, including Lua admission.
    const command = NATIVE_COMMANDS.find(candidate => candidate.handler === binding.command?.handler)
        ?? binding.command;
    game._repeatCommands.push({ kind: 'command', binding: {
        command, parameter: null,
        key: commandExecutionKey(command?.name)?.charCodeAt(0) ?? null,
    } });
}

export function rememberCommandKey(key: number): void {
    if (game._inDoAgain) return;
    game._repeatCommands ??= [];
    game._repeatCommands.push({ kind: 'key', key });
}

export function rememberObjectChoice(key: number, count: number | null): void {
    if (game._inDoAgain) return;
    game._repeatCommands ??= [];
    if (count !== null && count > 0)
        game._repeatCommands.push({ kind: 'count', count });
    rememberCommandKey(key);
}

// C cmd.c:yn_function() pushes a real-input answer into CQ_REPEAT without
// checking in_doagain, so an answer typed while a do-again replay is still
// unwinding (a death during ^A reaching end-of-game disclosure) becomes
// the queued answer for the following question.
export function rememberYnAnswerKey(key: number): void {
    game._repeatCommands ??= [];
    game._repeatCommands.push({ kind: 'key', key });
}

export function takeRepeatCommand(): RepeatCommandEntry | undefined {
    return game._inDoAgain ? game._repeatCommands?.shift() : undefined;
}

// ── Direction prompts (C cmd.c:getdir(), get_adjacent_loc(), confdir(),
//    help_dir()) ─────────────────────────────────────────────────────────

export interface DirectionSelection {
    key: string;
    dx: number;
    dy: number;
    dz: number;
}
export type DirectionKeyReader = (message: string, retry: boolean) => string | number | Promise<string | number>;

const GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const impairedDirections = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1],
] as const;

// C cmd.c:yn_function(query, (char *) 0, def, TRUE) for a response-free
// single-key question: cmdq_pop() answers from CQ_REPEAT during do-again
// without drawing anything, and a live answer is recorded back into
// CQ_REPEAT for the next do-again.
export async function ynSingleKey(message: string, cursorOffset = 0): Promise<number> {
    if (game._inDoAgain) {
        const queued = takeRepeatCommand();
        if (queued) {
            // A non-key entry clears CQ_CANNED and answers Escape.
            if (queued.kind !== 'key') clearCannedCommands();
            return queued.kind === 'key' ? queued.key : 27;
        }
    } else {
        // C cmdq_pop() takes CQ_CANNED here and sets addcmdq FALSE, so a
        // canned answer never lands in CQ_REPEAT. That one entry decides:
        // a key answers, a user-input placeholder asks live, and any other
        // entry — or a canned command reached through an empty response
        // queue — answers Escape after cmdq_clear(CQ_CANNED).
        const response = takeCommandResponse();
        if (typeof response === 'number') return response;
        if (response === undefined && game._cannedCommands?.length) {
            clearCannedCommands();
            return 27;
        }
        if (response !== undefined && response !== 'user-input') {
            clearCannedCommands();
            return 27;
        }
    }
    // The single cmdq_pop() already happened above (CQ_REPEAT during a
    // do-again, CQ_CANNED otherwise); CMDQ_USER_INPUT reads live from the
    // terminal, so the live question never takes another canned entry.
    const key = await promptKey(message, cursorOffset, { canned: false });
    rememberYnAnswerKey(key);
    return key;
}

// C cmd.c:getdir() removes its query immediately after receiving a key,
// before interpreting that key as a direction, cancellation, or help.
// Its cmdq_pop() at function entry (cmd.c:3962) is consumed once per
// getdir() call; after the help or redraw retry, every further key comes
// from readchar() (repeating) or yn_function() (ordinary play), never from
// the command queue again.
export async function readDirectionKey(message = 'In what direction? ', retry = false) {
    // C cmdq_pop() selects CQ_REPEAT during do-again, otherwise CQ_CANNED.
    if (game._inDoAgain) {
        const queued = retry ? undefined : takeRepeatCommand();
        if (queued) return queued.kind === 'key' ? queued.key : 27;
        // C getdir() bypasses yn_function() while repeating: readchar()
        // takes the next physical key without painting the question
        // (cmd.c:3985-3986), and the message line is still cleared
        // afterwards (cmd.c:4010-4011).
        const key = (await readchar('direction')) & 255;
        clearMessageWindow();
        return key;
    }
    const queued = retry ? undefined : takeCommandResponse();
    if (typeof queued === 'number') return queued;
    if (typeof queued === 'object') return queuedDirectionKey(queued);
    // C getdir() pops one entry from CQ_CANNED (cmd.c:3962) and only
    // CMDQ_KEY and CMDQ_DIR answer it. Every other popped entry — a
    // user-input placeholder or a queued extended command reached through
    // an empty response queue — makes getdir clear CQ_CANNED and report
    // the impossible (cmd.c:3974-3977); getdir has no live-input case
    // for a popped entry, unlike yn_function().
    if (queued !== undefined || (!retry && game._cannedCommands?.length)) {
        clearCannedCommands();
        await impossible('getdir: command queue had no dir?');
        return 0;
    }
    // tty_yn_function() skips an unread topline stopped by Escape, then
    // clears WIN_STOP before painting its question.
    if (game._suppressMessagesUntilInput) clearMessageWindow();
    else await flushPendingTopline();
    game._suppressMessagesUntilInput = false;
    await paintKeyPrompt(message);
    const key = (await readchar('direction')) & 255;
    if (game.commandBindings.lookup(key)?.command?.handler !== 'doredraw')
        rememberCommandKey(key);
    // getdir() asks through yn_function(), whose clean_up rewrites
    // gt.toplines with the prompt and its recorded answer.
    game._toplines = `${message}${keyText(key)}`;
    clearMessageWindow();
    return key;
}

// C getdir() converts CMDQ_DIR through xytodir() and Cmd.dirchars only
// when it needs the direction; other prompts must keep its entry type.
function queuedDirectionKey({ dx, dy, dz }: CommandDirection): number {
    const direction = dz ? zdir.findIndex(z => z === Math.sign(dz))
        : xdir.findIndex((x, index) => index < N_DIRS && x === dx && ydir[index] === dy);
    // A distant vector yields DIR_ERR. The pinned recorder reads NUL at
    // dirchars[-1] and cancels silently; avoid that out-of-bounds read.
    return direction < 0 ? 0 : game.commandBindings.directionKeys.charCodeAt(direction);
}

export interface DirectionPromptOptions {
    // C getdir callers pass a prompt starting with '^' (doidtrap) so that
    // help_dir() explains control-key forms of mistyped letters.
    ctrlCommandHint?: boolean;
}

export async function promptDirection(
    readKey: DirectionKeyReader = readDirectionKey,
    { ctrlCommandHint = false }: DirectionPromptOptions = {},
): Promise<DirectionSelection | null> {
    let retry = false;
    for (;;) {
        const key = await readKey('In what direction? ', retry);
        retry = true; // the entry cmdq_pop() is spent; retries read fresh keys
        const code = (typeof key === 'number' ? key : String(key).charCodeAt(0)) & 255;
        if (game.commandBindings.lookup(code)?.command?.handler === 'doredraw') {
            // docrt_flags(docrtRefresh) resends the current glyphs without
            // recalculating vision or choosing new hallucinated forms.
            game.context.botl = true;
            await flush_screen(1);
            continue;
        }
        const direction = promptedDirectionKey(code, game.commandBindings);
        const hero = game.u;
        if (direction !== '.' && code === game.commandBindings.specialKey('getdir.mouse'))
            return promptClickDirection();
        hero.dz = 0;
        const vector = DIRECTION_KEYS[direction];
        if (vector) {
            [hero.dx, hero.dy] = vector;
            if (hero.umonnum === GRID_BUG && hero.dx && hero.dy) {
                hero.dx = hero.dy = 0;
                await pline("You can't orient yourself that direction.");
                return null;
            }
        } else if (direction === '.') hero.dx = hero.dy = 0;
        else if (direction === '<' || direction === '>') {
            hero.dx = hero.dy = 0;
            hero.dz = direction === '<' ? -1 : 1;
        } else {
            // C getdir() skips invalid-direction help for all quitchars, including NUL.
            if ([0, 27, 32, 10, 13].includes(code)) return null;
            const helpRequested = code === game.commandBindings.specialKey('getdir.help');
            if (helpRequested || game.flags?.cmdassist !== false) {
                // cmd.c:4101 passes the typed key to help_dir() whenever the
                // caller prompt starts with '^', explicit help included.
                const assistPage = directionAssistPage(!helpRequested,
                    ctrlCommandHint ? code : null);
                await showTextPages([assistPage], {
                    validKeys: [27, 32, 10, 13],
                });
                await restoreCommandMap();
            } else await pline('What a strange direction!');
            if (helpRequested) continue;
            return null;
        }
        if (!hero.dz) confusePromptDirection(hero);
        return { key: direction, dx: hero.dx, dy: hero.dy, dz: hero.dz };
    }
}

// C getdir's simulated click returns directly from getpos: it bypasses
// both the grid-bug movement restriction and confusion redirection.
async function promptClickDirection(): Promise<DirectionSelection | null> {
    const bindings = game.commandBindings;
    const goal = `desired location, then type '${visibleCommandKey(
        bindings.specialKey('getpos.pick.quick') ?? 0,
    )}' for left click, '${visibleCommandKey(
        bindings.specialKey('getpos.pick') ?? 0,
    )}' for right`;
    const firstUse = shouldShowGetposTip();
    if (firstUse) await showGetposTip();
    await showGetposInstructions();
    if (firstUse) await pline(`Move cursor to ${goal}:`);
    const selected = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: game._pending_message || game._retained_message, goal,
    });
    const hero = game.u;
    if (!selected) {
        hero.dx = hero.dy = hero.dz = 0;
        if (game.iflags.getdir_click) game.iflags.getdir_click = 0;
        return null;
    }
    hero.dx = selected.x - hero.ux;
    hero.dy = selected.y - hero.uy;
    hero.dz = 0;
    if (game.iflags.getdir_click) {
        game.iflags.getdir_click = selected.pickType === LOOK_QUICK
            || selected.pickType === LOOK_ONCE ? CLICK_1 : CLICK_2;
    } else {
        hero.dx = Math.sign(hero.dx);
        hero.dy = Math.sign(hero.dy);
    }
    return { key: '_', dx: hero.dx, dy: hero.dy, dz: hero.dz };
}

// C getdir() calls confdir(FALSE) even for self, but never for up/down.
export function confusePromptDirection(hero: Hero, forceImpairment = false): void {
    const stunned = hero.stunned || (hero.stunnedTurns ?? 0) > 0;
    const confused = hero.confused || (hero.confusionTurns ?? 0) > 0;
    if (!forceImpairment && !stunned && !(confused && !rn2(5))) return;
    const count = hero.umonnum === GRID_BUG ? 4 : 8;
    const vector = impairedDirections[rn2(count)];
    if (!vector) throw new Error('The confused direction is outside the movement table');
    [hero.dx, hero.dy] = vector;
}

export async function restoreCommandMap() {
    // The dismissed menu or text window already restored its covered rows.
    // Release its topline without another redraw or status update.
    game._pending_message = '';
    game._retained_message = '';
}

// C help_dir(): use the current movement bindings and hide diagonals when
// the hero's body cannot use them. Explicit help omits the error heading.
export function directionAssistPage(invalidDirection = true, ctrlHintKey: number | null = null): TextPage {
    const bindings = game.commandBindings;
    const key = (direction: number) => visibleCommandKey(bindings.keyForDirection(direction) ?? 0);
    const lines = invalidDirection ? ['cmdassist: Invalid direction key!', ''] : [];
    if (ctrlHintKey !== null) lines.push(...controlKeyHintLines(ctrlHintKey));
    lines.push(`Valid direction keys${game.u.umonnum === GRID_BUG ? ' in your current form' : ''} are:`);
    if (game.u.umonnum === GRID_BUG) {
        lines.push(`             ${key(2)}   `, '             |   ',
            `          ${key(0)}- . -${key(4)}`, '             |   ',
            `             ${key(6)}   `);
    } else {
        lines.push(`          ${key(1)}  ${key(2)}  ${key(3)}`,
            '           \\ | / ', `          ${key(0)}- . -${key(4)}`,
            '           / | \\ ', `          ${key(7)}  ${key(6)}  ${key(5)}`);
    }
    const self = visibleCommandKey(bindings.specialKey(
        bindings.numberPad ? 'getdir.self2' : 'getdir.self',
    ) ?? 0);
    lines.push('', '          <  up', '          >  down',
        `       ${self.padStart(4)}  direct at yourself`);
    if (invalidDirection)
        lines.push('', '(Suppress this message with !cmdassist in config file.)');
    while (lines.length < 23) lines.push('');
    lines.push('--More--');
    return { lines, cursor: [8, 23] };
}

// C cmd.c:get_adjacent_loc() delegates input and command assistance to
// getdir(), then turns its relative result into a checked map location.
export async function getAdjacentLocation(prompt: string, errorMessage: string | null, x: number, y: number) {
    const direction = await promptDirection((_message, retry) => readDirectionKey(`${prompt} `, retry));
    if (!direction) {
        await pline('Never mind.');
        game.context.move = 0;
        return null;
    }
    const { dx, dy, dz } = direction;
    const target = { x: x + dx, y: y + dy, dx, dy, dz };
    if (target.x < 1 || target.x >= COLNO
        || target.y < 0 || target.y >= ROWNO) {
        if (errorMessage) await pline(errorMessage);
        game.context.move = 0;
        return null;
    }
    return target;
}

// ── Yes/no questions (C cmd.c:yn_function(), yn_function_menu(),
//    paranoid_ynq(), paranoid_query()) ───────────────────────────────────

// C cmd.c:yn_function() records the answer key, while yn_number remains
// the last tty question's value. Replaying '#' does not read another count.
// Only callers using C's shared response arrays opt into menus: equal text
// in a local buffer or string literal does not pass yn_menuable_resp().
export async function yn_function(
    query: string, responses: string | null, defaultAnswer = '', addCommandQueue = true,
    { visibleChoices = responses?.split('\x1b')[0] ?? '', menuable = false }: {
        visibleChoices?: string; menuable?: boolean;
    } = {},
): Promise<TtyPromptAnswer> {
    const queued = addCommandQueue ? takeRepeatCommand() : undefined;
    let result: TtyPromptAnswer;
    if (queued) {
        // A non-key CQ_REPEAT entry keeps the ESC initializer, and
        // cmdq_clear(CQ_CANNED) drops every canned command behind it.
        if (queued.kind !== 'key') clearCannedCommands();
        const answer = queued.kind === 'key' ? String.fromCharCode(queued.key) : '\x1b';
        result = { answer, count: game._ynNumber ?? 0n };
    } else {
        // C cmdq_pop() takes CQ_CANNED here, but never while a do-again
        // replay owns the input. That one entry decides the outcome: a
        // key answers, a user-input placeholder asks live, and any other
        // entry — or a canned command reached through an empty response
        // queue — keeps the ESC initializer while cmdq_clear(CQ_CANNED)
        // drops the remaining canned entries, so the question is never
        // shown.
        const response = addCommandQueue && !game._inDoAgain
            ? takeCommandResponse() : undefined;
        const cannedCommand = response === undefined && addCommandQueue && !game._inDoAgain
            ? game._cannedCommands?.shift() ?? null : null;
        if (typeof response === 'number') {
            result = { answer: String.fromCharCode(response), count: game._ynNumber ?? 0n };
        } else if (cannedCommand || (response !== undefined && response !== 'user-input')) {
            clearCannedCommands();
            result = { answer: '\x1b', count: game._ynNumber ?? 0n };
        } else {
            result = menuable && game.flags.query_menu && game.nhDisplay && responses !== null
                ? await queryResponseMenu(query, responses, defaultAnswer)
                : await tty_yn_function(query, responses, defaultAnswer, visibleChoices);
            if (addCommandQueue) rememberYnAnswerKey(result.answer ? result.answer.charCodeAt(0) : 0);
        }
    }
    if (!responses || !result.answer || result.answer === '\0' || responses.includes(result.answer))
        return result;
    const alternative = defaultAnswer || '\x1b';
    if (!game._inDoAgain || game.flags.debug)
        await reportInvalidYnAnswer(query, responses, defaultAnswer, result.answer, alternative);
    return { ...result, answer: alternative };
}

// cmd.c:yn_function_menu(): the preselected answer wins when the menu is
// cancelled; choosing another answer overrides it. This path keeps yn_number
// from the previous tty question because it never calls tty_yn_function().
async function queryResponseMenu(query: string, responses: string, defaultAnswer: string): Promise<TtyPromptAnswer> {
    const choices: [string, string][] = responses === 'rl' ? [['r', 'Right'], ['l', 'Left']]
        : responses === 'hsq' ? [['h', 'Hide'], ['s', 'Spin a web'], ['q', 'Quit']]
            : [['y', 'Yes'], ['n', 'No']];
    if (responses === 'ynaq') choices.push(['a', 'All']);
    if (responses === 'ynq' || responses === 'ynaq') choices.push(['q', 'Quit']);
    const selected = await showChoiceWindow({ title: query, entries: choices.map(([key, text]) => ({
        key, text, marker: key === defaultAnswer ? '*' : '-',
    })) });
    const answer = selected === 0 || selected === 27 ? defaultAnswer : String.fromCharCode(selected);
    await pline(`${query} ${keyText(answer ? answer.charCodeAt(0) : 0)}`);
    clearMessageWindow();
    return { answer, count: game._ynNumber ?? 0n };
}

async function reportInvalidYnAnswer(
    query: string, responses: string, defaultAnswer: string, answer: string, alternative: string,
): Promise<void> {
    const shownDefault = defaultAnswer ? visibleCommandKey(defaultAnswer.charCodeAt(0)) : '';
    const question = query.length >= QBUFSZ ? `${query.slice(0, QBUFSZ - 4)}...` : query;
    paniclog('yn debug', truncateRawMessage(`${question} [${responses}] (${shownDefault})`));
    // C uses fuzzer continue mode for this known diagnostic, preventing
    // both a panic and message-pager input while impossible() reports it.
    const previousMode = game.flags.debug_fuzzer;
    const previousInputFuzzer = game.iflags.debug_fuzzer;
    game.flags.debug_fuzzer = FUZZER_IMPOSSIBLE_CONTINUE;
    game.iflags.debug_fuzzer = true;
    try {
        const originalKey = visibleCommandKey(answer.charCodeAt(0));
        const alternativeKey = visibleCommandKey(alternative.charCodeAt(0));
        await impossible(`yn_function() returned '${originalKey}'; using '${alternativeKey}' instead`);
    } finally {
        if (previousMode === undefined) delete game.flags.debug_fuzzer;
        else game.flags.debug_fuzzer = previousMode;
        if (previousInputFuzzer === undefined) delete game.iflags.debug_fuzzer;
        else game.iflags.debug_fuzzer = previousInputFuzzer;
    }
}

// A per-question paranoia bit changes affirmative input from `y` to the full
// line `yes`.  PARANOID_CONFIRM additionally removes the default and requires
// `no` (or Escape) to reject, retrying other committed lines up to six times.
export async function paranoidQuery(
    beParanoid: boolean,
    prompt: string,
    paranoiaBits = game.flags?.paranoia_bits ?? 0,
): Promise<boolean> {
    return await paranoidYesNoQuit(beParanoid, prompt, false, paranoiaBits) === 'y';
}

// C cmd.c:paranoid_ynq(). Confirmation answers are deliberately excluded
// from command recall: every repeated dangerous action asks again.
export async function paranoidYesNoQuit(
    beParanoid: boolean, prompt: string, acceptQuit = true,
    paranoiaBits = game.flags?.paranoia_bits ?? 0,
): Promise<'y' | 'n' | 'q'> {
    if (!beParanoid) return acceptQuit
        ? promptChoice(prompt, ['y', 'n', 'q'], 'n', { addCommandQueue: false, menuable: true })
        : promptYesNo(prompt, 'n', false);
    const confirmAll = !!(paranoiaBits & PARANOID_CONFIRM);
    const responseType = confirmAll ? acceptQuit ? '[yes|no|quit]' : '[yes|no]'
        : acceptQuit ? '[yes|n|q] (n)' : '[yes|n] (n)';
    let prefix = '', question = prompt.slice(0, 255);
    for (let attempt = 0; attempt < 6; attempt++) {
        const extra = prefix.length + 1 + responseType.length;
        if (question.length + extra > QBUFSZ - 1)
            question = question.slice(0, QBUFSZ - 1 - extra - 4) + '...?';
        const line = await getLine(`${prefix}${question} ${responseType}`,
            (_ch, key) => key >= 32 && key < 127);
        if (line === null) return acceptQuit ? 'q' : 'n';
        const answer = line.trim().replace(/\s+/g, ' ').toLowerCase();
        if (answer === 'yes') return 'y';
        if (answer === 'quit') return acceptQuit ? 'q' : 'n';
        if (!confirmAll || answer === 'no') return 'n';
        prefix = '"Yes" or "No": ';
    }
    return 'n';
}

// ── Key input (C cmd.c:readchar(), readchar_core(), readchar_poskey(),
//    pgetchar(), randomkey()) ────────────────────────────────────────────

// C cmd.c:pgetchar(): one unprompted character, without readchar()'s
// Escape-prefix or EOF translation and without a command-queue entry.
export async function pgetchar(): Promise<number> {
    const key = game.iflags.debug_fuzzer
        ? await inputGate().readKey() : await nhgetch();
    return nativeChar(key);
}

export async function readchar(inputState: InputState = 'other'): Promise<number> {
    return (await readcharCore(inputState)).key;
}

// C readchar_poskey(): only position selection receives the click coordinates.
// All readchar callers receive the same NUL character for a click.
export function readcharPoskey(): Promise<CharacterInput> {
    return readcharCore('position');
}

// C cmd.c:readchar_core(). Escape prefixes only have meaning in command,
// direction, and position input. Ordinary prompts keep a literal Escape.
async function readcharCore(inputState: InputState): Promise<CharacterInput> {
    // Native fuzzer input skips the keyboard's NUL, EOF, and Escape decoding.
    if (game.iflags.debug_fuzzer)
        return { key: await inputGate().readKey(inputState), click: null };
    let key = await nhgetch(inputState);
    if (key === MAP_CLICK_KEY) {
        // C readchar_core(): clicks record their location even when getpos
        // has temporarily cleared the mouse-button command bindings.
        const click = inputGate().takeMapClick();
        game._clicklookTarget = click ? { x: click.x, y: click.y } : null;
        const command = click ? game.commandBindings.mouseCommand(click.button) : null;
        if (command?.name) {
            game._cannedCommands ??= [];
            game._cannedCommands.push({ kind: 'command', name: command.name });
        }
        return { key: 0, click };
    }
    if (key === -1) {
        key = 27;
    } else if (key === 27 && game.iflags?.altmeta && inputState !== 'other') {
        // pgetchar() returns char, unlike the first nh_poskey() int.
        const next = nativeChar(await nhgetch(inputState));
        key = next === -1 || next === 0 || next === 27 ? 27 : next | 128;
    }
    return { key: nativeChar(key), click: null };
}

function nativeChar(key: number): number {
    return NATIVE_COMMAND_PROFILE.signedChar ? (key << 24) >> 24 : key & 255;
}

// C cmd.c:randomkey()'s function statics: the extcmdlist index and the
// repeat key survive prompts. C keeps them for the whole process; the port
// scopes them to one game — bindInputGate() and resetInputState() reset
// both, so every newly started game begins the table from its head.
let fuzzerCommandIndex = 0;
let lastFuzzerCommand = 0;

// C cmd.c:randomkey(). The table index and repeat key survive prompts.
export function randomKey(inputState: InputState): number {
    if (inputState === 'command' && (lastFuzzerCommand === 1 || lastFuzzerCommand === 16)
        && rn2(5)) return lastFuzzerCommand;
    let key;
    switch (rn2(16)) {
    case 0: key = 10; break;
    case 1: case 2: case 3: case 4: key = rn1(95, 32); break;
    case 5: key = rn2(2) ? 9 : 32; break;
    case 6: key = rn1(26, 97); break;
    case 7: key = rn1(26, 65); break;
    case 8: key = NATIVE_COMMANDS[fuzzerCommandIndex++ % NATIVE_COMMANDS.length]?.key ?? 0; break;
    case 9: key = 35; break;
    case 10: case 11: case 12: {
        const direction = rn2(NATIVE_COMMAND_CONSTANTS.N_DIRS);
        const mode = rn2(7) ? 0 : !rn2(3) ? 2 : 1;
        key = game.commandBindings.keyForDirection(direction, mode);
        break;
    }
    case 13: key = rn1(10, 48); break;
    case 14: key = rnd(game.iflags.wc_eight_bit_input ? 255 : 127); break;
    default: key = 27; break;
    }
    key = nativeChar(key);
    if (inputState === 'command') lastFuzzerCommand = key;
    return key;
}

// Reset by bindInputGate() (every game binds a freshly built gate, as
// jsmain's start() does) and by resetInputState().
export function resetFuzzerCommandState(): void {
    fuzzerCommandIndex = 0;
    lastFuzzerCommand = 0;
}

// ── #prevmsg (C cmd.c:doprev_message()) ─────────────────────────────────

// C cmd.c:doprev_message() -> win/tty/topl.c:tty_doprev_message(). The
// prompt owners call this with inread set, which forces the single-message
// branch exactly like ttyDisplay->inread does; they manage their own
// repainting around the call. Takes no game time and draws no randomness.
export async function doprevMessage(inread = false): Promise<void> {
    const mode = messageWindowMode();
    if (mode !== 's' && !inread) {
        if (mode === 'f') {
            // Full: the window lists the ring oldest-first with the pending
            // topline last, and the walk cursor restarts.
            game._messageHistoryCursor = null;
            await showMessageHistoryWindow({ reversed: false });
        } else if (mode === 'c') {
            // Combination: the first two recalls page single lines (the
            // pending topline, then the newest remembered one), unless
            // maxrow wrapped to zero. Only a single-line step in this call
            // sets dismiss_more to ^P for the window's pager too.
            let acceptCtrlP = false;
            for (;;) {
                const cursor = game._messageHistoryCursor;
                let morc: number;
                const newestSavedLine = cursor === game._messageHistory.length - 1
                    && game._messageHistoryWriteIndex > 0;
                if (cursor === null || newestSavedLine) {
                    acceptCtrlP = true;
                    morc = await redotoplin(cursor === null
                        ? game._toplines : game._messageHistory[cursor] ?? '');
                    stepHistoryBack();
                } else {
                    game._messageHistoryCursor = null;
                    morc = await showMessageHistoryWindow({ reversed: false, acceptCtrlP });
                }
                if (morc !== CTRL_P) break;
            }
        } else {
            // Reversed: the pending topline leads, then the ring newest-first.
            game._messageHistoryCursor = null;
            await showMessageHistoryWindow({ reversed: true });
        }
    } else if (mode === 's') {
        // Single: each ^P walks one entry further back, wrapping to the
        // pending topline again after the oldest displayed entry.
        for (;;) {
            const cursor = game._messageHistoryCursor;
            const morc = await redotoplin(cursor === null
                ? game._toplines : game._messageHistory[cursor] ?? '');
            stepHistoryBack();
            if (morc !== CTRL_P) break;
        }
    }
}


// ── Key help (C cmd.c:key2extcmddesc(), dokeylist(), help_dir()) ──────────

// C misc_keys[] supplies descriptions to both key help and the bindings list.
const miscellaneousKeys = [
    { name: 'escape', description: 'cancel current prompt or pending prefix', numberPadOnly: false },
    { name: 'count', description: 'Prefix: for digits when preceding a command with a count', numberPadOnly: true },
] as const;

// C cmd.c:key2txt().
export function keyText(key: number): string {
    return key === 32 ? '<space>' : key === 27 ? '<esc>'
        : key === 10 ? '<enter>' : key === 127 ? '<del>' : visibleCommandKey(key);
}

// C cmd.c:key2extcmddesc().
export function describeCommandKey(key: number): string | null {
    const bindings = game.commandBindings;
    // key2extcmddesc() probes movecmd() in walk, rush, then run mode.
    // Each probe updates u.dz, even when the key is not a movement command.
    for (const mode of [0, 2, 1]) {
        const movement = bindings.movementForKey(key, mode);
        game.u.dz = movement?.dz ?? 0;
        if (!movement) continue;
        game.u.dx = movement.dx;
        game.u.dy = movement.dy;
        if (!movement.dz) break;
    }
    if (key >= 48 && key <= 57 && !bindings.numberPad)
        return 'start of, or continuation of, a count';
    if (bindings.numberPad) {
        if (key === 53 || key === 181)
            return `${bindings.pcHack !== (key === 181) ? 'run' : 'rush'} prefix`;
        if (key === 48 || bindings.pcHack && key === 176) return "synonym for 'i'";
    }
    for (const special of miscellaneousKeys) {
        if (special.numberPadOnly && !bindings.numberPad) continue;
        const code = special.name === 'escape' ? 27 : bindings.specialKey(special.name);
        if (key === code) return special.description;
    }
    const command = bindings.lookup(key)?.command;
    if (!command) return null;
    if (command.handler === 'do_reqmenu')
        return 'movement prefix: move without autopickup and without attacking\nnon-movement prefix: request menu or modify command (#reqmenu)';
    return commandDescription(command) + (command.name === '#' ? '' : ` (#${command.name})`);
}

// C cmd.c:help_dir(): after an invalid direction given to a caller whose
// prompt starts with '^', a letter key might have meant its control command.
export function controlKeyHintLines(key: number): string[] {
    const isLetter = (key >= '@'.charCodeAt(0) && key <= 'Z'.charCodeAt(0))
        || (key >= 'a'.charCodeAt(0) && key <= 'z'.charCodeAt(0));
    if (!isLetter && key !== '['.charCodeAt(0)) return [];
    const sym = String.fromCharCode(key).toUpperCase();
    const ctrl = sym.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    const explain = describeCommandKey(ctrl);
    const wizardOnly = 'EFGIVW'.includes(sym);
    if (explain === null || (wizardOnly && !game.flags.debug)) return [];
    return [
        `Are you trying to use ^${sym}${wizardOnly ? '' : ' as specified in the Guidebook'}?`,
        '',
        `${keyText(ctrl).padEnd(8)}${explain}.`,
        '',
        'To use that command, hold down the <Ctrl> key as a shift',
        `and press the <${sym}> key.`,
        '',
    ];
}

// C cmd.c:dokeylist().
// C cmd.c:keylist_func_has_key().
// C cmd.c:keylist_putcmds().
export async function showKeyBindings(): Promise<void> {
    const bindings = game.commandBindings;
    const used = new Set([3]); // SIGINT is reserved even if a key is rebound.
    const lines = ['', '            Full Current Key Bindings List',
        '        (also commands with no key assignment)', '', 'Directional keys:'];
    const key = (direction: number) => visibleCommandKey(bindings.keyForDirection(direction));
    lines.push(`          ${key(1)}  ${key(2)}  ${key(3)}`, '           \\ | / ',
        `          ${key(0)}- . -${key(4)}`, '           / | \\ ',
        `          ${key(7)}  ${key(6)}  ${key(5)}`, '');
    if (!bindings.numberPad) lines.push(
        'Ctrl+<direction> will run in specified direction until something very',
        '        interesting is seen.');
    lines.push(`${bindings.numberPad ? 'Meta' : 'Shift'}+<direction> will run in specified direction until you encounter`,
        '        an obstacle.', '', 'Miscellaneous keys:');
    const keyless = [];
    for (const special of miscellaneousKeys) {
        if (special.numberPadOnly && !bindings.numberPad) continue;
        const code = special.name === 'escape' ? 27 : bindings.specialKey(special.name);
        if (!code || used.has(code)) {
            keyless.push(special);
            continue;
        }
        used.add(code);
        lines.push(`${keyText(code).padEnd(7)} ${special.description}`);
    }
    lines.push('^C      interrupt: break out of NetHack (SIGINT)');
    for (const special of keyless)
        lines.push(`${`[${special.name}]`.padEnd(21)} ${special.description}`);
    lines.push('', 'Menu control keys:');
    for (const [control, description] of [
        ['>', 'Go to next page'], ['<', 'Go to previous page'], ['^', 'Go to first page'],
        ['|', 'Go to last page'], ['.', 'Select all items in entire menu'],
        ['@', 'Invert selection for all items'], ['-', 'Unselect all items in entire menu'],
        [',', 'Select all items on current page'], ['~', "Invert current page's selections"],
        ['\\', 'Unselect all items on current page'], [':', 'Search and invert matching items'],
        ['Return', 'Accept current choice(s) and dismiss menu'], ['Enter', 'Same as Return'],
        ['Space', 'If not on last page, advance one page;'], ['     ', 'when on last page, treat like Return'],
        ['Escape', 'Cancel menu without making any choice(s)'],
    ]) {
        // C options.c:show_menu_controls() uses the configured alias for
        // each menu command; Return, Space and Escape stay hardcoded.
        const key = control?.length === 1
            ? visibleCommandKey(bindings.menuKey(control)) : control ?? '';
        lines.push(`${key.padEnd(7)} ${description ?? ''}`);
    }
    const ignored = NATIVE_COMMAND_FLAGS.INTERNALCMD | NATIVE_COMMAND_FLAGS.MOVEMENTCMD | NATIVE_COMMAND_FLAGS.WIZMODECMD;
    const categories: readonly [string, (command: NativeCommand) => boolean][] = [
        ['General commands:', command => !!(command.flags & NATIVE_COMMAND_FLAGS.GENERALCMD) && !(command.flags & ignored)],
        ['Game commands:', command => !(command.flags & (NATIVE_COMMAND_FLAGS.GENERALCMD | ignored))],
        ['Debug mode commands:', command => !!game.flags.debug
            && !!(command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD) && !(command.flags & NATIVE_COMMAND_FLAGS.INTERNALCMD)],
    ];
    for (const [heading, include] of categories) {
        const commands = NATIVE_COMMANDS.filter(command => command.name !== null && include(command));
        if (!commands.length) continue;
        lines.push('', heading);
        const previouslyUsed = new Set(used);
        for (let code = 0; code < 256; code++) {
            if (used.has(code) || code === 32 && !game.flags.rest_on_space) continue;
            const binding = bindings.lookup(code);
            if (!binding?.command || !include(binding.command)) continue;
            lines.push(`${keyText(code).padEnd(7)} ${(binding.command.name ?? '').padEnd(13)} ${commandDescription(binding.command)}${binding.parameter === null ? '' : ` "${binding.parameter}"`}`);
            used.add(code);
        }
        for (const command of commands) {
            if (bindings.bindings.some(binding => !previouslyUsed.has(binding.key) && binding.command === command)) continue;
            lines.push(`#${(command.name ?? '').padEnd(20)} ${commandDescription(command)}`);
        }
    }
    await showTextWindow(lines);
    await restoreCommandMap();
    game.context.move = 0;
}

// Player-facing descriptions from pinned cmd.c:extcmdlist.
export const COMMAND_DESCRIPTIONS = new Map<string, string>([
    ["#", "enter and perform an extended command"],
    ["?", "list all extended commands"],
    ["adjust", "adjust inventory letters"],
    ["annotate", "name current level"],
    ["apply", "apply (use) a tool (pick-axe, key, lamp...)"],
    ["attributes", "show your attributes"],
    ["autopickup", "toggle the 'autopickup' option on/off"],
    ["bugreport", "file a bug report"],
    ["call", "name a monster, specific object, or type of object"],
    ["cast", "zap (cast) a spell"],
    ["chat", "talk to someone"],
    ["chronicle", "show journal of major events"],
    ["close", "close a door"],
    ["conduct", "list voluntary challenges you have maintained"],
    ["debugfuzzer", "start the fuzz tester"],
    ["dip", "dip an object into something"],
    ["down", "go down a staircase"],
    ["drop", "drop an item"],
    ["droptype", "drop specific item types"],
    ["eat", "eat something"],
    ["engrave", "engrave writing on the floor"],
    ["enhance", "advance or check weapon and spell skills"],
    ["exploremode", "enter explore (discovery) mode"],
    ["fight", "prefix: force fight even if you don't see a monster"],
    ["fire", "fire ammunition from quiver"],
    ["force", "force a lock"],
    ["genocided", "list monsters that have been genocided or become extinct"],
    ["glance", "show what type of thing a map symbol corresponds to"],
    ["help", "give a help message"],
    ["herecmdmenu", "show menu of commands you can do here"],
    ["history", "show a summary of the game's development"],
    ["inventory", "show your inventory"],
    ["inventtype", "show inventory of one specific item class"],
    ["invoke", "invoke an object's special powers"],
    ["jump", "jump to another location"],
    ["kick", "kick something"],
    ["known", "show what object types have been discovered"],
    ["knownclass", "show discovered types for one class of objects"],
    ["levelchange", "change experience level"],
    ["lightsources", "show mobile light sources"],
    ["look", "look at what is here"],
    ["lookaround", "describe what you can see"],
    ["loot", "loot a box on the floor"],
    ["monster", "use monster's special ability"],
    ["name", "same as call; name a monster or object or object type"],
    ["offer", "offer a sacrifice to the gods"],
    ["open", "open a door"],
    ["options", "show option settings"],
    ["optionsfull", "show all option settings, possibly change them"],
    ["overview", "show a summary of the explored dungeon"],
    ["panic", "test panic routine (fatal to game)"],
    ["pay", "pay your shopping bill"],
    ["perminv", "scroll persistent inventory display"],
    ["pickup", "pick up things at the current location"],
    ["polyself", "polymorph self"],
    ["pray", "pray to the gods for help"],
    ["prevmsg", "view recent game messages"],
    ["puton", "put on an accessory (ring, amulet, etc)"],
    ["quaff", "quaff (drink) something"],
    ["quit", "exit without saving current game"],
    ["quiver", "select ammunition for quiver"],
    ["read", "read a scroll or spellbook"],
    ["redraw", "redraw screen"],
    ["remove", "remove an accessory (ring, amulet, etc)"],
    ["repeat", "repeat a previous command"],
    ["reqmenu", "prefix: request menu or modify command"],
    ["retravel", "travel to previously selected travel location"],
    ["ride", "mount or dismount a saddled steed"],
    ["rub", "rub a lamp or a stone"],
    ["run", "prefix: run until something interesting is seen"],
    ["rush", "prefix: rush until something interesting is seen"],
    ["save", "save the game and exit"],
    ["saveoptions", "save the game configuration"],
    ["search", "search for traps and secret doors"],
    ["seeall", "show all equipment in use"],
    ["seeamulet", "show the amulet currently worn"],
    ["seearmor", "show the armor currently worn"],
    ["seerings", "show the ring(s) currently worn"],
    ["seetools", "show the tools currently in use"],
    ["seeweapon", "show the weapon currently wielded"],
    ["shell", "leave game to enter a sub-shell ('exit' to come back)"],
    ["showgold", "show gold, possibly shop credit or debt"],
    ["showspells", "list and reorder known spells"],
    ["showtrap", "describe an adjacent, discovered trap"],
    ["sit", "sit down"],
    ["stats", "show memory statistics"],
    ["suspend", "push game to background ('fg' to come back)"],
    ["swap", "swap wielded and secondary weapons"],
    ["takeoff", "take off one piece of armor"],
    ["takeoffall", "remove all armor"],
    ["teleport", "teleport around the level"],
    ["terrain", "view map without monsters or objects obstructing it"],
    ["therecmdmenu", "menu of commands you can do from here to adjacent spot"],
    ["throw", "throw something"],
    ["timeout", "look at timeout queue and hero's timed intrinsics"],
    ["tip", "empty a container"],
    ["toggle", "toggle boolean option"],
    ["travel", "travel to a specific location on the map"],
    ["turn", "turn undead away"],
    ["twoweapon", "toggle two-weapon combat"],
    ["untrap", "untrap something"],
    ["up", "go up a staircase"],
    ["vanquished", "list vanquished monsters"],
    ["version", "list compile time options for this version of NetHack"],
    ["versionshort", "show version and date+time program was built"],
    ["vision", "show vision array"],
    ["wait", "rest one move while doing nothing"],
    ["wear", "wear a piece of armor"],
    ["whatdoes", "tell what a command does"],
    ["whatis", "show what type of thing a symbol corresponds to"],
    ["wield", "wield (put in use) a weapon"],
    ["wipe", "wipe off your face"],
    ["wizborn", "show stats of monsters created"],
    ["wizbury", "bury objs under and around you"],
    ["wizcast", "cast any spell"],
    ["wizcustom", "show customized glyphs"],
    ["wizdetect", "reveal hidden things within a small radius"],
    ["wizdispmacros", "validate the display macro ranges"],
    ["wizfliplevel", "flip the level"],
    ["wizgenesis", "create a monster"],
    ["wizidentify", "identify all items in inventory"],
    ["wizintrinsic", "set an intrinsic"],
    ["wizkill", "slay a monster"],
    ["wizlevelport", "teleport to another level"],
    ["wizloaddes", "load and execute a des-file lua script"],
    ["wizloadlua", "load and execute a lua script"],
    ["wizobjprobs", "list object generation probabilities"],
    ["wizmakemap", "recreate the current level"],
    ["wizmap", "map the level"],
    ["wizmondiff", "validate the difficulty ratings of monsters"],
    ["wizrumorcheck", "verify rumor boundaries"],
    ["wizseenv", "show map locations' seen vectors"],
    ["wizshownhuuid", "show NHUUID for this game"],
    ["wizsmell", "smell monster"],
    ["wiztelekinesis", "telekinesis"],
    ["wizwhere", "show locations of special levels"],
    ["wizwish", "wish for something"],
    ["wmode", "show wall modes"],
    ["zap", "zap a wand"],
    ["movewest", "move west (screen left)"],
    ["movenorthwest", "move northwest (screen upper left)"],
    ["movenorth", "move north (screen up)"],
    ["movenortheast", "move northeast (screen upper right)"],
    ["moveeast", "move east (screen right)"],
    ["movesoutheast", "move southeast (screen lower right)"],
    ["movesouth", "move south (screen down)"],
    ["movesouthwest", "move southwest (screen lower left)"],
    ["rushwest", "rush west (screen left)"],
    ["rushnorthwest", "rush northwest (screen upper left)"],
    ["rushnorth", "rush north (screen up)"],
    ["rushnortheast", "rush northeast (screen upper right)"],
    ["rusheast", "rush east (screen right)"],
    ["rushsoutheast", "rush southeast (screen lower right)"],
    ["rushsouth", "rush south (screen down)"],
    ["rushsouthwest", "rush southwest (screen lower left)"],
    ["runwest", "run west (screen left)"],
    ["runnorthwest", "run northwest (screen upper left)"],
    ["runnorth", "run north (screen up)"],
    ["runnortheast", "run northeast (screen upper right)"],
    ["runeast", "run east (screen right)"],
    ["runsoutheast", "run southeast (screen lower right)"],
    ["runsouth", "run south (screen down)"],
    ["runsouthwest", "run southwest (screen lower left)"],
    ["migratemons", "show migrating monsters and migrate N random ones"],
]);
