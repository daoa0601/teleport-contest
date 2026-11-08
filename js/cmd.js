// cmd.js — Command parsing and dispatch.
// C ref: cmd.c:rhack(); movement execution belongs to hack.ts. Also hosts
// the top-line key prompts (win/tty/wintty.c tty_yn_function()'s prompt
// path) that commands which pause for input render through.
import { FOOD_CLASS, POTION_CLASS } from './objclass.js';
import { DIRECTION_HANDLERS, INITIAL_COMMAND_BINDINGS, NATIVE_COMMAND_CONSTANTS, NATIVE_COMMAND_FLAGS, NATIVE_COMMAND_PROFILE, NATIVE_COMMANDS, NATIVE_SPECIAL_KEYS } from './command_data.js';
import { doapply, dorub, dojump, useUnicornHorn, continueTrapSetting, resetTrapSetting } from './apply.js';
import { doname, monsterName } from './do_name.js';
import { doannotate, doDungeonOverview, levelIsWizardTower, recordMappedOverviewState, sameDungeonLevel, specialPrototypeAt, u_on_rndspot } from './dungeon.js';
import { On_stairs_dn, On_stairs_up } from './stairs.js';
import { dochat } from './sounds.js';
import { doloot, dotip, autopickupAtHero } from './pickup.js';
import { doinvoke } from './artifact.js';
import { doChronicle, doGenocided, doVanquished, doattributes, doconduct } from './insight.js';
import { doturn, dopray, dosacrifice } from './pray.js';
import { dipInto, dodip, quaff } from './potion.js';
import { doclose, doopen, continuePicking, continueForceLock, doforce, maybeResetPick, resetPick } from './lock.js';
import { moveIntoFailedUntrap, doUntrap, resetUtrap } from './trap.js';
import { askTeleportDestination, dotelecmd } from './teleport.js';
import { adjustSplit, doadjust, doPermanentInventory, ddoinv, dolook } from './invent.js';
import { ACH_MINE_PRIZE, ACH_SOKO_PRIZE, CLICK_1, CLICK_2, xdir, ydir, ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME, PARANOID_QUIT, STAIRS, THRONE, ESCAPED, VIBRATING_SQUARE, COLNO, ROWNO, SCORR, DOOR, FOUNTAIN, SINK, D_CLOSED, D_LOCKED, PIT, SPIKED_PIT, TT_PIT, HOLE, TRAPDOOR, Is_airlevel, Is_waterlevel, Is_valley, W_ARMOR, W_ACCESSORY, ALTAR, BOLT_LIM, DIRECTION_KEYS, DIR_W, D_ISOPEN, GFILTER_VIEW, GLOC_DOOR, GLOC_INTERESTING, IS_DOOR, IS_ROOM, LOOK_ONCE, LOOK_QUICK, MENU_ITEMFLAGS_SELECTED, NHW_MENU, N_DIRS, PICK_ANY, PICK_ONE, ROOMOFFSET, TER_FULL, TER_MAP, TER_OBJ, TER_TRP, Upolyd, zdir, CORR, IS_STWALL, IS_TREE, IS_WATERWALL, LAVAWALL, IRONBARS, SDOOR, DRAWBRIDGE_UP, QBUFSZ, PARANOID_CONFIRM, CMDQ_KEY, CMDQ_EXTCMD, CMDQ_DIR, CMDQ_USER_INPUT, CMDQ_INT, CQ_CANNED, CQ_REPEAT, FEMALE, MALE } from './const.js';
import { nhgetch, nh_poskey, MAP_CLICK_KEY, inputGate } from './input.js';
import { visibleCommandKey } from './hacklib.js';
import { showSeenVectors, showTerrainCodeLegend, showTerrainCodes, showVisionFlags, showWallModes, wizCustom, wizDetect, wizFlipLevel, wizFuzzer, wizGenesis, wizIdentify, wizIntrinsic, wizKill, wizLevelChange, wizLevelTeleport, wizMigrateMonsters, wizMakeMap, wizMap, wizPanic, wizPolyself, wizRumorCheck, wizShowNhuuid, wizShowStats, wizSmell, wizTelekinesis, wizWhere, wizWish, makemapRemoveMons } from './wizcmds.js';
import { wizBury, continueHeroDigging } from './dig.js';
import { wizTimeoutQueue } from './timeout.js';
import { wizLightSources } from './light.js';
import { continueSpellbookStudy } from './spell.js';
import { clearMessageWindow, ttyDoprevMessage, flushPendingTopline, putMessageHistory, renderKeyPrompt } from './topl.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { doquickwhatis, dohelp, dowhatis, identifyTrap, lookatDescription, whatDoesCommand, displayHelpFile, describeMapLocation } from './pager.js';
import { monsterAtPosition, doride, monsterSaddle, monsterCanBeSaddled } from './steed.js';
import { withIndefiniteArticle, observeObjectForNaming } from './objnam.js';
import { TRAVEL_DIRECTIONS, heroTestMove, domove, threateningMonsterNearby, arriveTravel, captureRunmodeDelay, stopRun, showGetposTip, shouldShowGetposTip, checkSpecialRoom, dopickup } from './hack.js';
import { propertyIsActive } from './properties.js';
import { gotoLevel, dodown, doup, resolveHeroArrivalCollision, saveCurrentState } from './do.js';
import { inventoryReport } from './invent.js';
import { enqueueInventoryAction } from './iactions.js';
import { isContainer, unlinkObject, deallocateObject } from './mkobj.js';
import { doOptions, toggleBooleanOptionPrefix } from './message_types.js';
import { extFuncTabFromFunc } from './command_bindings.js';
import { stopHeroOccupation } from './allmain.js';
import { resetBulkTakeoff, dowear, doputon, removeWornItem, continueBulkTakeoff, takeOffAll, remarmSwapwep } from './do_wear.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { autoDescribePosition, selectTravelMenuPosition, showGetposInstructions, selectMapPosition, gatherLocsInteresting, knownVibratingSquareAt } from './getpos.js';
import { glyphToCmapSymbol } from './glyphs.js';
import { completeExtendedCommand, editExtendedCommand, promptChoice } from './query.js';
import { tty_yn_function } from './topl.js';
import { getLine, showTextWindow, addMenuHeading, showChoiceWindow, showMultiSelectWindow, showTextPages } from './windows.js';
import { NO_COLOR } from './terminal.js';
import { promptYesNo } from './query.js';
import { flush_screen, docrt, canSpotMonster, glyphAt, cls } from './display.js';
import { pline, plineWithContinuation, setTopline, pline_xy, set_msg_xy, truncateRawMessage, impossible, } from './pline.js';
import { dozap } from './zap.js';
import { docast, dovspell, dowizcast } from './spell.js';
import { heroBreathAttack } from './zap.js';
import { useHeroBreath, heroSpitAttack, useHeroSpit, heroGazeAttack, useHeroGaze, useHeroWereSummon, chooseSpiderAbility, heroCanSpinWeb, useHeroWeb, heroCanMindBlast, useHeroMindBlast, heroCanRemovePunishment, useHeroNymphAbility, useHeroVampireShift, heroIsPolymorphed, heroCanChangeVampireShape } from './polyself.js';
import { monsterBreathAttack, performPetRangedAttack } from './dogmove.js';
import { deliverMigratingMonsters } from './dog.js';
import { killGenocidedMonsters } from './mon.js';
import { heroIsPunished, placeBallAndChain, releaseCarriedBall, unplaceBallAndChain } from './ball.js';
import { deliverSpecialLevelMessages } from './questpgr.js';
import { heroCanSplitLikeGremlin, useHeroGremlinSplit } from './hero_gremlin.js';
import { heroCanShriek, useHeroShriek } from './hero_shriek.js';
import { heroCanSummonWerePack } from './were.js';
import { heroHasHidingAbility, useHeroHide } from './polyself.js';
import { heroCanUseUnicornHorn } from './unicorn_horn.js';
import { doread } from './read.js';
import { eatfood, doeat, opentin } from './eat.js';
import { doclassdisco, dodiscovered, objectTypeKnown } from './o_init.js';
import { doextversion, doversion, NATIVE_VERSION } from './extversion.js';
import { dosearch, revealTerrain } from './detect.js';
import { continueWipingFace, donull, dowipe, dodrop, dropMultipleObjects } from './do.js';
import { setSecondaryWeapon, doready, doswapweapon, dotwoweapon, dowield } from './wield.js';
import { LOCK_PICK, CREDIT_CARD, SADDLE, POT_OIL, SKELETON_KEY, BOULDER } from './object_data.js';
import { MONSTER_NAME } from './monster_data.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { dosave } from './save.js';
import { dosit } from './sit.js';
import { continueEngraving, doengrave } from './engrave.js';
import { finishTeleportArrival } from './teleport.js';
import { doquit, finishHeroDeath } from './end.js';
import { doborn } from './insight.js';
import { dofire, dothrow } from './dothrow.js';
import { doenhance } from './weapon.js';
import { dopay } from './shk.js';
import { dokick } from './dokick.js';
import { rn1, rn2, rnd } from './rng.js';
import { FUZZER_IMPOSSIBLE_CONTINUE } from './diagnostics.js';
import { paniclog } from './novel_tribute.js';
import { heroCanReachFloor } from './engrave.js';
import { CmapSymbol, GlyphOffset, monnumToGlyph, objnumToGlyph } from './glyph_numbers.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu } from './wintty.js';
import { selection_floodfill, selection_getbounds, selection_getpoint, selection_new, selection_size_description } from './selvar.js';
import { floorObjectDescription } from './invent.js';
import { cansee, couldsee, vision_reset_new_level } from './vision.js';
import { blockingTerrain } from './mthrowu.js';
import { monsterSpeciesHidesOnCeiling } from './mondata.js';
import { finishHeroMonsterKill } from './mon.js';
export { promptYesNo, promptYesNoQuit } from './query.js';
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };
// Part of C cmd.c:movecmd(): the vi-movement key test.
function isMovementKey(ch) {
    return ch.length === 1 && 'hjklyubn'.includes(ch);
}
// C cmd.c:isok() — x >= 1 && x <= COLNO-1 && y >= 0 && y <= ROWNO-1
export function isok(x, y) {
    return x >= 1 && x <= COLNO - 1 && y >= 0 && y <= ROWNO - 1;
}
// Part of C cmd.c:rhack(): resolving a pressed key to its bound command.
function configuredCommand(key) {
    key &= 255;
    if (key === 27)
        return { key, command: null, parameter: null };
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
export function xyToDirection(dx, dy) {
    const direction = xdir.findIndex((x, index) => x === dx && ydir[index] === dy);
    return direction < 8 ? direction : -1;
}
// Part of C allmain.c:moveloop_core(): the occupation continuation between complete world turns.
// C refs: cmd.c set_occupation()/timed_occupation() and
// allmain.c:moveloop_core().  A count-prefixed search executes once in
// rhack(), then repeats without reading another input key; each repetition is
// separated by the complete monster/global turn scheduler.
export async function continueCountedCommand(g = game) {
    if (!g._occupation)
        return false;
    g.context.move = 1;
    await continueOccupation(g);
    if (g.program_state.gameover)
        return false;
    g.context.move = 1;
    if (threateningMonsterNearby())
        await stopHeroOccupation(g);
    return !g.program_state.gameover;
}
// Part of C allmain.c:moveloop_core(): the per-occupation continuation
// dispatch (C calls the installed occupation function pointer).
async function continueOccupation(g) {
    const occupation = g._occupation;
    if (!occupation) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'command') {
        g.context.move = 1;
        await runCommandHandler(occupation.binding);
        if (g.program_state.gameover)
            return false;
        g.context.move = 1;
        if (g.multi > 0)
            --g.multi;
        if (!(g.multi > 0))
            g._occupation = null;
        return true;
    }
    if (occupation.key === 'dig') {
        const continuing = await continueHeroDigging(g);
        if (g.program_state.gameover)
            return false;
        if (!continuing)
            g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if (occupation.key === 'study-book') {
        const continuing = await continueSpellbookStudy({ state: g });
        if (g.program_state.gameover)
            return false;
        if (!continuing)
            g._occupation = null;
        return true;
    }
    if (occupation.key === 'force-lock') {
        return continueForceLock(occupation, g);
    }
    if (occupation.key === 'takeoff') {
        const continuing = await continueBulkTakeoff(g);
        if (!continuing)
            g._occupation = null;
        return continuing;
    }
    if (occupation.key === 'set-trap') {
        const continuing = await continueTrapSetting(g);
        if (!continuing)
            g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if ('remaining' in occupation && occupation.remaining <= 0) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'pick-lock')
        return continuePicking(occupation, g);
    if (occupation.key === 'eat-food') {
        return eatfood(occupation, g);
    }
    if (occupation.key === 'open-tin') {
        return opentin(occupation, g);
    }
    if (occupation.key === 'wipe-face') {
        return continueWipingFace(occupation, g);
    }
    if (occupation.key === 'engrave') {
        const continuing = await continueEngraving(g);
        if (g.program_state.gameover)
            return false;
        if (!continuing)
            g._occupation = null;
        g.context.move = 1;
        return true;
    }
    g._occupation = null;
    return false;
}
// Part of C cmd.c:set_occupation(): installing a count-prefixed command
// occupation.
function prepareTimedCommand(binding) {
    const text = binding.command?.occupation;
    if (text && !game._occupation && game.multi) {
        game._occupation = { key: 'command', text, binding };
    }
}
// C cmd.c:set_occupation(). Installs the resumable occupation and its
// progress text; xtime is modelled by the occupation's own key.
export function setOccupation(occupation, g = game) {
    g._occupation = occupation;
}
// C cmd.c:redraw_cmd()
async function redrawCommand() {
    await docrt();
    game.context.move = 0;
}
// Part of C do.c:donull(): the wait command.
async function performWaitCommand(force = game.iflags.menu_requested) {
    if (!await donull(force, !!game.multi))
        return;
    game.context.move = 1;
}
// C cmd.c:can_do_extcmd(). Admission precedes prefixes and handler setup.
// Also C cmd.c:ecname_from_fn(): inlined here (command.name is the
// ext_func_tab name C looks up from the function pointer).
async function commandAllowed(command) {
    if (!command)
        return true;
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
export async function rhack(key) {
    requirePlayingGame(game);
    game.context.nopick = false;
    game.iflags.menu_requested = false;
    if (key !== 0)
        delete game._cursorOverride;
    game._heroMeleeThisCommand = false;
    game._silentPrefixRetainedTopline = false;
    const previousMessage = game._pending_message;
    const movement = game._movementAttempt ?? { walk: false, rush: false };
    game._movementAttempt = movement;
    let prefix = null;
    let menuPrefix = false;
    for (;;) {
        // C cmd.c:rhack() pops one command queue entry before parse()
        // (cmd.c:3642-3657): a queued extended command dispatches directly,
        // a queued key becomes the command key, and any other entry leaves
        // key 0 for the no-command reset below. cmdq_pop() selects
        // CQ_REPEAT while a do-again replay owns the input.
        const cmdq = cmdq_pop();
        let queuedCommand = null;
        if (cmdq) {
            if (cmdq.typ === CMDQ_EXTCMD)
                queuedCommand = cmdq.ecEntry;
            else if (cmdq.typ === CMDQ_KEY)
                key = cmdq.key;
            else
                key = 0;
        }
        else if (key === 0) {
            key = (await readCommandInput()).key;
            delete game._cursorOverride;
            // C parse() returns NUL after a click queues its mouse command;
            // got_prefix_input pops it without reading another key
            // (cmd.c:3652-3656).
            if (key === 0 && cmdq_peek(CQ_CANNED))
                continue;
        }
        delete game._statusGoldOverride;
        if (!queuedCommand && [0, -1, 255, 27].includes(key)) {
            resetCommandVariables(true);
            return;
        }
        // C rhack() drops any pending travel destination for every command
        // dispatched here (cmd.c:3674); the empty/ESC branches above clear
        // it through reset_cmd_vars() instead.
        game.context.travel = game.context.travel1 = false;
        const configured = queuedCommand
            ? {
                key: commandExecutionKey(queuedCommand.name)?.charCodeAt(0) ?? null,
                command: queuedCommand, parameter: null,
            }
            : configuredCommand(key);
        if (!cmdq || game._inDoAgain) {
            game._pending_message = '';
            game._retained_message = '';
        }
        const command = configured.command;
        if (!command) {
            // C parse()/rhack() report an unknown key with
            // custompline(SUPPRESS_HISTORY): the previous line is
            // remembered, the complaint itself is not.
            await setTopline(`Unknown command '${visibleCommandKey(key)}'.`);
            // Unlike a rejected known command, C's unknown-key tail keeps
            // pending movement flags until the next command resolves them.
            cmdq_clear(CQ_CANNED);
            cmdq_clear(CQ_REPEAT);
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
            }
            else {
                const vertical = command.handler === 'doup' || command.handler === 'dodown';
                await pline(`The '${which}' prefix should be followed by a movement command${vertical ? ' other than up or down' : ''}.`);
            }
            resetCommandVariables(true);
            return;
        }
        let binding = { ...configured, command };
        prepareTimedCommand(binding);
        if (command.handler === 'doextcmd') {
            cmdq_clear(CQ_REPEAT);
            const { selected, lastExecuted } = await readExtendedCommand();
            if (!selected || !await commandAllowed(selected)) {
                // doextcmd() leaves ext_tlist pointing at the last list it
                // executed when the following editor quits or is rejected;
                // rhack() adds that entry and shifts it first
                // (cmd.c:3752-3759).
                if (lastExecuted) {
                    cmdq_add_ec(CQ_REPEAT, lastExecuted.handler);
                    cmdq_shift(CQ_REPEAT);
                }
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
        if (!selected)
            throw new Error('Command dispatch lost its selected command');
        if (selected.handler === 'do_repeat') {
            await repeatLastCommand();
            // The outer rhack() dispatches do_repeat, not dokick.
            if (game.context.move)
                game._kickedLoc = null;
            return;
        }
        // C cmd.c:rhack() records the command for do-again (cmd.c:3727-
        // 3739): a fresh command replaces CQ_REPEAT, a prefix appends
        // behind it, and do_repeat (returned above) plus the doextcmd
        // editor never enter the queue — the '#' dispatch above cleared
        // CQ_REPEAT the way C's func == doextcmd branch does, and the
        // command it selected is recorded here like any other, so answers
        // its prompts push while it runs land behind it. That is the same
        // final order as C's post-execution add and shift (cmd.c:3752-
        // 3759).
        if (!game._inDoAgain && selected.handler !== 'doextcmd') {
            if (!prefix)
                cmdq_clear(CQ_REPEAT);
            cmdq_add_ec(CQ_REPEAT, selected.handler);
        }
        if (selected.flags & NATIVE_COMMAND_FLAGS.PREFIXCMD) {
            if (!await applyMovementPrefix(selected, movement)) {
                resetCommandVariables(true);
                return;
            }
            prefix = selected;
            if (selected.handler === 'do_reqmenu') {
                // rhack() tests the outer function, which remains doextcmd
                // when #reqmenu supplies the selected prefix.
                if (command.handler === 'do_reqmenu')
                    menuPrefix = true;
                game._silentPrefixRetainedTopline = !!previousMessage;
            }
            key = 0;
            continue;
        }
        if (selected.flags & NATIVE_COMMAND_FLAGS.MOVEMENTCMD) {
            await dispatchMovement(binding, movement);
            return;
        }
        beginCommandResult();
        await runCommandHandler(binding);
        if (game.program_state.gameover)
            return;
        // C cmd.c:rhack() result seam (cmd.c:3810-3826) after
        // res = (*func)(): ECMD_CANCEL and ECMD_FAIL reset both command
        // queues, a time-taking result keeps them, and an ECMD_OK result
        // resets them only under an involuntary delay. C's moveloop
        // presets context.move before rhack(); JS handlers set it, so the
        // TIME precedence over a cancellation reads the recorded result
        // bits, not the possibly stale context.move.
        const result = game._commandResult ?? ECMD_OK;
        if (result & (ECMD_CANCEL | ECMD_FAIL)) {
            resetCommandVariables(true);
            if (result & ECMD_TIME)
                game.context.move = 1;
        }
        else if (!game.context.move) {
            resetCommandVariables(game.multi < 0);
        }
        // C cmd.c:rhack() clears kickedloc after an elapsed non-kick action
        // (cmd.c:3822-3826). doextcmd's selected action, not the outer
        // # editor, owns that result.
        if (game.context.move
            && selected.handler !== 'dokick'
            && selected.handler !== 'doextcmd') {
            game._kickedLoc = null;
        }
        return;
    }
}
// C cmd.c:do_repeat(). Preserve the saved queue even when its execution
// cancels, so another repeat makes the same attempt in the new context.
async function repeatLastCommand() {
    if (game._inDoAgain)
        return;
    if (!cmdq_peek(CQ_REPEAT)) {
        await plineWithContinuation('There is no command available to repeat.', { noRepeat: true });
        resetCommandVariables(true);
        return;
    }
    const saved = cmdq_copy(CQ_REPEAT);
    game._inDoAgain = true;
    try {
        await rhack(0);
    }
    finally {
        game._inDoAgain = false;
        cmdq_clear(CQ_REPEAT);
        game.command_queue[CQ_REPEAT] = saved;
        game.iflags.menu_requested = false;
    }
}
// Part of C cmd.c:rhack(): dispatch adapter for do_reqmenu(), do_fight(), do_rush(), and do_run().
// C cmd.c's four movement-prefix commands, each a branch here:
// Also C cmd.c:do_reqmenu(): inlined here (menu_requested toggle).
// Also C cmd.c:do_fight(): inlined here (forcefight toggle).
// Also C cmd.c:do_rush(): inlined here (run = 2, DOMOVE_RUSH).
// Also C cmd.c:do_run(): inlined here (run = 3, DOMOVE_RUSH).
async function applyMovementPrefix(command, movement) {
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
// C cmd.c:set_move_cmd(). This is rhack()'s MOVEMENTCMD dispatch tail
// with the twenty-four one-line movement wrappers inlined: the key's case
// and any pending prefix select the mode those wrappers each passed to
// set_move_cmd(dir, run).
// Also C cmd.c:dxdy_moveok(): inlined here (the grid-bug diagonal refusal).
// Also C cmd.c:do_move_west(): inlined here (set_move_cmd(DIR_W, 0)).
// Also C cmd.c:do_move_northwest(): inlined here (set_move_cmd(DIR_NW, 0)).
// Also C cmd.c:do_move_north(): inlined here (set_move_cmd(DIR_N, 0)).
// Also C cmd.c:do_move_northeast(): inlined here (set_move_cmd(DIR_NE, 0)).
// Also C cmd.c:do_move_east(): inlined here (set_move_cmd(DIR_E, 0)).
// Also C cmd.c:do_move_southeast(): inlined here (set_move_cmd(DIR_SE, 0)).
// Also C cmd.c:do_move_south(): inlined here (set_move_cmd(DIR_S, 0)).
// Also C cmd.c:do_move_southwest(): inlined here (set_move_cmd(DIR_SW, 0)).
// Also C cmd.c:do_run_west(): inlined here (set_move_cmd(DIR_W, 1)).
// Also C cmd.c:do_run_northwest(): inlined here (set_move_cmd(DIR_NW, 1)).
// Also C cmd.c:do_run_north(): inlined here (set_move_cmd(DIR_N, 1)).
// Also C cmd.c:do_run_northeast(): inlined here (set_move_cmd(DIR_NE, 1)).
// Also C cmd.c:do_run_east(): inlined here (set_move_cmd(DIR_E, 1)).
// Also C cmd.c:do_run_southeast(): inlined here (set_move_cmd(DIR_SE, 1)).
// Also C cmd.c:do_run_south(): inlined here (set_move_cmd(DIR_S, 1)).
// Also C cmd.c:do_run_southwest(): inlined here (set_move_cmd(DIR_SW, 1)).
// Also C cmd.c:do_rush_west(): inlined here (set_move_cmd(DIR_W, 3)).
// Also C cmd.c:do_rush_northwest(): inlined here (set_move_cmd(DIR_NW, 3)).
// Also C cmd.c:do_rush_north(): inlined here (set_move_cmd(DIR_N, 3)).
// Also C cmd.c:do_rush_northeast(): inlined here (set_move_cmd(DIR_NE, 3)).
// Also C cmd.c:do_rush_east(): inlined here (set_move_cmd(DIR_E, 3)).
// Also C cmd.c:do_rush_southeast(): inlined here (set_move_cmd(DIR_SE, 3)).
// Also C cmd.c:do_rush_south(): inlined here (set_move_cmd(DIR_S, 3)).
// Also C cmd.c:do_rush_southwest(): inlined here (set_move_cmd(DIR_SW, 3)).
async function dispatchMovement(binding, prefixes) {
    const key = binding.key ?? 0;
    const ch = String.fromCharCode(key);
    const direction = controlRushDirection(key) || ch.toLowerCase();
    if (!isMovementKey(direction))
        throw new Error('Movement command has no direction');
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
    const mode = prefixes.walk || prefixes.rush
        ? game.context.run === 2 ? 2 : game.context.run === 3 ? 3 : 0
        : controlRushDirection(key) ? 3 : ch !== ch.toLowerCase() ? 1 : 0;
    // C cmd.c:set_move_cmd() replaces context.run only when no movement
    // prefix is pending (domove_attempting); an 'F' or rush-prefixed
    // direction keeps the run value an earlier rush or travel left set.
    if (!(prefixes.walk || prefixes.rush))
        game.context.run = mode;
    if (game.iflags.menu_requested)
        game.context.nopick = true;
    if (rushDispatch || (mode && !prefixes.walk))
        startRun(hero.dx, hero.dy, game, mode);
    else if (game.multi > 0)
        // A counted walk-style direction marks the repeat active without
        // replacing context.run or granting a rush's movement ration.
        startWalkRepeat(hero.dx, hero.dy, game);
    const outcome = await domove(hero.dx, hero.dy);
    const moved = outcome === 'time';
    if (game.program_state.gameover)
        return;
    // C domove_core() also delays counted walks after arrival effects.
    if (moved && game._domoveReachedTail)
        await captureRunmodeDelay(game, !!game.context.run || game.multi > 0);
    game.context.move = moved ? 1 : 0;
    if (!moved && outcome !== 'opened-door')
        stopRun();
    if (!mode || prefixes.walk)
        game.context.forcefight = false;
    game.iflags.menu_requested = false;
}
// C cmd.c:dotoggleoption(): without a binding parameter the command only
// points the player at the options menu; with one it is
// toggle_bool_option(param).
async function doToggleOption(parameter) {
    game.context.move = 0;
    if (parameter === null) {
        await pline('Use #optionsfull to set any option instead.');
        return;
    }
    if (!await toggleBooleanOptionPrefix(parameter))
        commandResultFailed();
}
// Part of C cmd.c:rhack(): invoking the bound command's handler.
// Admission belongs to the caller. Keep the selected binding, including its
// parameter, rather than looking up a possibly rebound key inside the action.
async function runCommandHandler(binding) {
    const { key, command } = binding;
    const ch = key === null ? '' : String.fromCharCode(key);
    if (key === null && command) {
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
        await dotelecmd();
        return;
    }
    if (key === 6 && game.flags?.debug) { // Ctrl-F: wiz_map()
        await wizMap();
        return;
    }
    if (binding.command?.handler === 'doprev_message') {
        // Ctrl-P: doprev_message(), a GENERALCMD redisplay that follows the
        // binding rather than one raw key.
        await ttyDoprevMessage();
        game.context.move = 0;
        return;
    }
    if (ch === 'i') {
        enqueueInventoryAction(await ddoinv());
    }
    else if (ch === 'I') {
        enqueueInventoryAction(await inventoryReport('type'));
    }
    else if (ch === '(') {
        enqueueInventoryAction(await inventoryReport('tools'));
    }
    else if (ch === '*') {
        enqueueInventoryAction(await inventoryReport('inuse'));
    }
    else if (ch === 'O') {
        await doOptions(game.iflags.menu_requested);
    }
    else if (ch === 'Z') {
        await docast();
    }
    else if (ch === '+') {
        await dovspell();
    }
    else if (ch === '\\') {
        await dodiscovered();
    }
    else if (ch === '`') {
        await doclassdisco();
    }
    else if (key === 24) { // Ctrl-X
        await doattributes();
    }
    else if (ch === 's') {
        await dosearch(game.iflags.menu_requested);
    }
    else if (key === 4) { // Ctrl-D
        await dokick();
    }
    else if (ch === 'f') {
        await dofire();
    }
    else if (ch === '.') {
        await performWaitCommand();
    }
    else if (ch === 'e') {
        await doeat();
    }
    else if (ch === 'q') {
        await doquaff();
    }
    else if (ch === 'p') {
        await dopay();
    }
    else if (ch === 'd') {
        await dodrop();
    }
    else if (ch === 'D') {
        const result = await dropMultipleObjects();
        // doddrop() returns the drop transaction's result bits (or the
        // traditional-mode dropped count) to rhack() unchanged.
        game._commandResult = result;
        game.context.move = Number((result & ECMD_TIME) !== 0);
        if (result) {
            resetOccupations();
            if (game._occupation?.key === 'pick-lock')
                game._occupation = null;
        }
    }
    else if (ch === 'c') {
        await doclose();
    }
    else if (ch === 'o') {
        await doopen();
    }
    else if (ch === '@') {
        // C options.c:dotogglepickup().  This is an immediate option command,
        // not a turn, and its class list is the live pickup_types setting.
        game.flags.pickup = !game.flags.pickup;
        const classes = game.flags.pickup_types || '';
        await pline(game.flags.pickup
            ? `Autopickup: ON, for ${classes || 'all'} objects.`
            : 'Autopickup: OFF.');
        game.context.move = 0;
    }
    else if (ch === ',') {
        await dopickup();
    }
    else if (ch === '>') {
        await dodown();
    }
    else if (ch === '<') {
        await doup();
    }
    else if (ch === 'z') {
        await dozap();
    }
    else if (ch === 'r') {
        await readCommand();
    }
    else if (ch === 'T' || ch === 'R') {
        await removeWornItem(ch === 'R' ? 'remove' : 'take off');
    }
    else if (ch === 'A') {
        await takeOffAll();
    }
    else if (ch === 'P') {
        await doputon();
    }
    else if (ch === 'W') {
        await dowear();
    }
    else if (ch === 'w') {
        await dowield();
    }
    else if (ch === 'x') {
        await doswapweapon();
    }
    else if (ch === 'a') {
        await doapply();
    }
    else if (ch === ':') {
        await dolook();
    }
    else if (ch === 'V') {
        await doversion();
    }
    else if (ch === '&') {
        await whatDoesCommand();
    }
    else if (ch === '?') {
        await dohelp();
    }
    else if (ch === '#') {
        await rhack(game.commandBindings.keyForCommand('#'));
    }
    else if (ch === 'Q') {
        await doready();
    }
    else if (ch === 't') {
        await dothrow();
    }
    else if (ch === '_') {
        await dotravel();
    }
    else if (ch === ';') {
        await doquickwhatis();
    }
    else if (ch === 'S') {
        await dosave();
    }
    else if (ch === '$') {
        enqueueInventoryAction(await inventoryReport('gold'));
    }
    else if (ch === ')') {
        enqueueInventoryAction(await inventoryReport('weapon'));
    }
    else if (ch === '[') {
        enqueueInventoryAction(await inventoryReport('armor'));
    }
    else if (ch === '=') {
        enqueueInventoryAction(await inventoryReport('rings'));
    }
    else if (ch === '"') {
        enqueueInventoryAction(await inventoryReport('amulet'));
    }
    else if (ch === '|') {
        await doPermanentInventory();
    }
    else if (key === 127) { // Delete: overview of known terrain.
        await terrainCommand();
    }
    else if (key === 27) { // Escape cancels without producing a message.
        game.context.move = 0;
    }
    else {
        // Unknown command
        await setTopline(`Unknown command '${ch}'.`);
        game.context.move = 0;
    }
}
// Port only: result adapter between the quaff command and potion.c's
// dodrink().
async function doquaff() {
    const result = await quaff();
    if (result.cancelled)
        commandResultCancelled(); // potion.c:dodrink() ECMD_CANCEL.
    game.context.move = result.spentTime && !result.heroDied ? 1 : 0;
}
// Port only: result adapter between the read command and read.c's
// doread().
async function readCommand() {
    const result = await doread();
    if (result.cancelled)
        commandResultCancelled(); // read.c:doread() ECMD_CANCEL.
}
// C cmd.c:doterrain().
export async function terrainCommand() {
    recordMappedOverviewState();
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    const choices = ['known map without monsters, objects, and traps',
        'known map without monsters and objects', 'known map without monsters'];
    if (game.flags.explore || game.flags.debug)
        choices.push('full map without monsters, objects, and traps');
    if (game.flags.debug)
        choices.push('internal levl[][].typ codes in base-36', 'legend of base-36 levl[][].typ codes');
    for (const [index, text] of choices.entries())
        tty_add_menu(window, {
            identifier: index + 1, text,
            itemflags: index === 0 ? MENU_ITEMFLAGS_SELECTED : 0,
        });
    tty_end_menu(window, 'View which?');
    const result = await tty_select_menu(window, PICK_ONE);
    await tty_destroy_nhwindow(window);
    if (!result.cancelled) {
        const which = result.selections.find(selection => selection.identifier !== 1)?.identifier ?? 1;
        if (which === 5)
            await showTerrainCodes();
        else if (which === 6)
            await showTerrainCodeLegend();
        else {
            const subset = which === 4 ? TER_MAP | TER_FULL
                : TER_MAP | (which >= 2 ? TER_TRP : 0) | (which >= 3 ? TER_OBJ : 0);
            await revealTerrain(subset);
        }
    }
    game.context.move = 0;
}
// C cmd.c:here_cmd_menu(): inlined here (there_cmd_menu at the hero's own
// square with CLICK_1; C doherecmdmenu() is this function's own name).
async function doherecmdmenu() {
    enqueueContextMenu(await selectContextMenu(game.u.ux, game.u.uy, CLICK_1));
}
// C cmd.c:dotherecmdmenu()
async function dotherecmdmenu() {
    game.iflags.getdir_click = CLICK_1 | CLICK_2;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y)) {
        enqueueContextMenu(await selectContextMenu(target.x, target.y, target.x === game.u.ux && target.y === game.u.uy ? CLICK_1 : game.iflags.getdir_click));
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
    enqueueContextMenu(await selectContextMenu(game.u.ux + direction.dx, game.u.uy + direction.dy, direction.dx || direction.dy ? click : CLICK_1));
}
// C cmd.c:act_on_act() queues the chosen action's command together with
// the answers its prompts consume (cmd.c:4686-4835); every entry lands on
// CQ_CANNED at menu-selection time, before the menu command returns.
function enqueueContextMenu(selection) {
    game.context.move = 0;
    if (!selection)
        return;
    // act_on_act() sets this before dotherecmdmenu() clears a mouse target.
    if (selection.action === 'look-at')
        game._clicklookTarget = { x: selection.x, y: selection.y };
    if (selection.action === 'remove-saddle')
        cmdq_add_ec(CQ_CANNED, 'do_reqmenu');
    cmdq_add_ec(CQ_CANNED, commandByName(contextMenuCommand(selection)).handler);
    contextMenuResponses(selection);
}
// C cmd.c:doclicklook() retains the clicked location for later commands.
async function doclicklook() {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y))
        await autoDescribePosition(target.x, target.y);
}
// C cmd.c:domouseaction()
async function domouseaction() {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y))
        mouseAction(target);
}
// Part of C cmd.c:domouseaction(): the chooser half over a click target.
function mouseAction(click) {
    requirePlayingGame(game);
    let dx = click.x - game.u.ux, dy = click.y - game.u.uy;
    const queue = (name) => {
        cmdq_add_ec(CQ_CANNED, commandByName(name).handler);
    };
    if (game.flags.travel !== false) {
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            game._travelTarget = { x: click.x, y: click.y };
            queue('retravel');
            return;
        }
        const location = game.level?.at(click.x, click.y);
        if (!dx && !dy) {
            if (location?.typ === FOUNTAIN || location?.typ === SINK)
                queue('quaff');
            else if (location?.typ === THRONE)
                queue('sit');
            else if (On_stairs_up(game, click.x, click.y))
                queue('up');
            else if (On_stairs_dn(game, click.x, click.y))
                queue('down');
            else {
                const object = game.level?.objects[click.x]?.[click.y]?.[0];
                queue(object ? isContainer(object) ? 'loot' : 'pickup' : 'wait');
            }
            return;
        }
        if (!monsterAtPosition(game.level, click.x, click.y) && !heroTestMove(click.x, click.y)) {
            if (location?.typ === DOOR && location.doormask & (D_CLOSED | D_LOCKED))
                queue(location.doormask & D_LOCKED ? 'kick' : 'open');
            else if (location && location.typ <= SCORR)
                queue('search');
            else
                queue(contextMenuCommand({ action: 'move', x: click.x, y: click.y }));
            return;
        }
    }
    else {
        if (Math.abs(dx) > 2 * Math.abs(dy))
            dy = 0;
        else if (Math.abs(dy) > 2 * Math.abs(dx))
            dx = 0;
        dx = Math.sign(dx);
        dy = Math.sign(dy);
        if (!dx && !dy) {
            queue('wait');
            return;
        }
    }
    queue(contextMenuCommand({ action: 'move', x: game.u.ux + Math.sign(dx), y: game.u.uy + Math.sign(dy) }));
}
// Part of C cmd.c:act_on_act(): the MCMD-action-to-command mapping half;
// the queued-answer half is contextMenuResponses() below.
function contextMenuCommand(selection) {
    switch (selection.action) {
        case 'move':
        case 'attack': {
            const dx = Math.sign(selection.x - game.u.ux), dy = Math.sign(selection.y - game.u.uy);
            const direction = TRAVEL_DIRECTIONS.findIndex(([x, y]) => x === dx && y === dy);
            const name = ['west', 'north', 'east', 'south', 'northwest', 'northeast', 'southeast', 'southwest'][direction];
            if (!name)
                throw new Error('A contextual move needs an adjacent target');
            return `move${name}`;
        }
        case 'lock':
        case 'saddle': return 'apply';
        case 'untrap-door':
        case 'untrap-here': return 'untrap';
        case 'remove-saddle': return 'loot';
        case 'dismount': return 'ride';
        case 'look-at': return 'clicklook';
        case 'travel': return 'retravel';
        case 'open':
        case 'kick':
        case 'close':
        case 'search':
        case 'showtrap':
        case 'untrap':
        case 'ride':
        case 'chat':
        case 'name':
        case 'quaff':
        case 'dip':
        case 'sit':
        case 'up':
        case 'down':
        case 'pickup':
        case 'loot':
        case 'tip':
        case 'eat':
        case 'drop':
        case 'wait':
        case 'look':
        case 'offer':
        case 'inventory':
        case 'cast':
        case 'throw': return selection.action;
    }
}
// Part of C cmd.c:act_on_act(): the queued-answer half; contextMenuCommand() supplies the command.
// The answer tail C cmd.c:act_on_act() queues behind each action's
// command (cmd.c:4690-4833): directions, letters, and the user-input
// placeholder its prompts consume.
function contextMenuResponses(selection) {
    const dx = Math.sign(selection.x - game.u.ux), dy = Math.sign(selection.y - game.u.uy);
    const yes = 'y'.charCodeAt(0);
    switch (selection.action) {
        case 'open':
        case 'untrap-door':
        case 'kick':
        case 'close':
        case 'showtrap':
        case 'untrap':
        case 'ride':
        case 'chat':
            cmdq_add_dir(CQ_CANNED, dx, dy, 0);
            return;
        case 'lock': {
            const tool = [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]
                .map(type => game.inventory.find(object => object.otyp === type)).find(object => object);
            if (tool?.invlet) {
                cmdq_add_key(CQ_CANNED, tool.invlet.charCodeAt(0));
                cmdq_add_dir(CQ_CANNED, dx, dy, 0);
                cmdq_add_key(CQ_CANNED, yes);
            }
            return;
        }
        case 'remove-saddle':
            cmdq_add_dir(CQ_CANNED, dx, dy, 0);
            cmdq_add_key(CQ_CANNED, yes);
            return;
        case 'saddle': {
            const saddle = game.inventory.find(object => object.otyp === SADDLE);
            if (saddle?.invlet) {
                cmdq_add_key(CQ_CANNED, saddle.invlet.charCodeAt(0));
                cmdq_add_dir(CQ_CANNED, dx, dy, 0);
            }
            return;
        }
        case 'name':
            cmdq_add_key(CQ_CANNED, 'm'.charCodeAt(0));
            cmdq_add_dir(CQ_CANNED, dx, dy, 0);
            return;
        case 'quaff':
        case 'tip':
        case 'eat':
            cmdq_add_key(CQ_CANNED, yes);
            return;
        case 'dip':
            cmdq_add_userinput(CQ_CANNED);
            cmdq_add_key(CQ_CANNED, yes);
            return;
        case 'throw':
            // act_on_act() retains the raw offset for throwing.
            cmdq_add_userinput(CQ_CANNED);
            cmdq_add_dir(CQ_CANNED, selection.x - game.u.ux, selection.y - game.u.uy, 0);
            return;
        case 'offer':
            cmdq_add_userinput(CQ_CANNED);
            return;
        case 'untrap-here':
            cmdq_add_dir(CQ_CANNED, 0, 0, 1);
            return;
        case 'travel':
            game._travelTarget = { x: selection.x, y: selection.y };
            return;
        case 'attack':
        case 'cast':
        case 'dismount':
        case 'down':
        case 'drop':
        case 'inventory':
        case 'look':
        case 'look-at':
        case 'loot':
        case 'move':
        case 'pickup':
        case 'search':
        case 'sit':
        case 'up':
        case 'wait': return;
    }
}
// C cmd.c:there_cmd_menu(). The dispatcher frame: menu window, self /
// next2u / far entry sections, the no-entry move-or-travel fallback, the
// single-entry shortcut, and the selection that feeds enqueueContextMenu
// (act_on_act()).
// Also C cmd.c:there_cmd_menu_common(): inlined here (the look-at entry
// and the CLICK_1/CLICK_2 suppression).
// Also C cmd.c:there_cmd_menu_far(): inlined here (the throw and travel
// entries for a distant CLICK_1).
// Also C cmd.c:mcmd_addmenu(): inlined here (tty_add_menu per entry).
export async function selectContextMenu(x, y, click) {
    const entries = [];
    const add = (action, text) => entries.push({ action, text });
    const dx = x - game.u.ux, dy = y - game.u.uy;
    const self = dx === 0 && dy === 0;
    const adjacent = Math.max(Math.abs(dx), Math.abs(dy)) <= 1;
    if (self)
        await selfEntries(add, x, y);
    else if (adjacent)
        adjacentEntries(add, x, y, click);
    else
        farEntries(add, x, y, click);
    commonEntries(add, x, y, click);
    if (!entries.length) {
        // getdir's ordinary keyboard direction has no click modifier. With
        // no contextual action, native queues movement or travel directly.
        return adjacent && heroTestMove(x, y) ? { action: 'move', x, y }
            : game.flags.travel !== false ? { action: 'travel', x, y } : null;
    }
    if (entries.length === 1 && entries[0]?.action === 'attack')
        return { action: 'attack', x, y };
    clearMessageWindow();
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    for (const entry of entries)
        tty_add_menu(window, { identifier: entry.action, text: entry.text });
    tty_end_menu(window, 'What do you want to do?');
    const result = await tty_select_menu(window, PICK_ONE);
    await tty_destroy_nhwindow(window);
    const action = result.selections[0]?.identifier;
    return action ? { action, x, y } : null;
}
// C cmd.c:there_cmd_menu_far(): the far-click entries.  linedup(..., 1):
// boulders do not obstruct an explicitly chosen throw, so the walk toward
// the target only rejects other blocking terrain.
function farEntries(add, x, y, click) {
    if (click !== CLICK_1)
        return;
    requirePlayingGame(game);
    const dx = game.u.ux - x, dy = game.u.uy - y;
    let linedUp = !(dx && dy && Math.abs(dx) !== Math.abs(dy)
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM);
    if (linedUp && !couldsee(x, y)) {
        let tx = x, ty = y;
        do {
            tx += Math.sign(dx);
            ty += Math.sign(dy);
            if (blockingTerrain(game, tx, ty)) {
                linedUp = false;
                break;
            }
        } while (tx !== game.u.ux || ty !== game.u.uy);
    }
    if (linedUp && dx * dx + dy * dy < 18 * 18)
        add('throw', 'Throw something');
    add('travel', 'Travel here');
}
// C cmd.c:there_cmd_menu_self().
async function selfEntries(add, x, y) {
    const level = requireGameLevel();
    const terrain = level.requireAt(x, y).typ;
    if ((terrain === FOUNTAIN || terrain === SINK) && heroCanReachFloor())
        add('quaff', `Drink from the ${terrain === FOUNTAIN ? 'fountain' : 'sink'}`);
    if (terrain === FOUNTAIN && heroCanReachFloor())
        add('dip', 'Dip something into the fountain');
    if (terrain === THRONE)
        add('sit', 'Sit on the throne');
    if (terrain === ALTAR)
        add('offer', 'Sacrifice something on the altar');
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.sx !== x || stair.sy !== y)
            continue;
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
        if (first.oclass === FOOD_CLASS)
            add('eat', `Eat ${await menuObjectName(first)}`);
    }
    if (game.inventory.length) {
        add('inventory', 'Inventory');
        add('drop', 'Drop items');
    }
    add('wait', 'Rest one turn');
    add('search', 'Search around you');
    add('look', 'Look at what is here');
    if (game.spells.length)
        add('cast', 'Cast a spell');
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && trap.ttyp !== VIBRATING_SQUARE)
        add('untrap-here', 'Attempt to disarm trap');
}
// Part of C cmd.c:there_cmd_menu(): the object entry's name.
async function menuObjectName(object) {
    observeObjectForNaming(object);
    return floorObjectDescription(object);
}
// C cmd.c:there_cmd_menu_next2u().
function adjacentEntries(add, x, y, click) {
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
        }
        else if (location.doormask & D_ISOPEN && click === CLICK_2)
            add('close', 'Close the door');
    }
    if (location.typ <= SCORR)
        add('search', 'Search for secret doors');
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen) {
        add('showtrap', 'Examine trap');
        if (trap.ttyp !== VIBRATING_SQUARE)
            add('untrap', 'Attempt to disarm trap');
        add('move', 'Move on the trap');
    }
    if (location.remembered_glyph?.glyph === objnumToGlyph(BOULDER))
        add('move', 'Push the boulder');
    const occupant = monsterAtPosition(level, x, y);
    const monster = occupant && canSpotMonster(occupant) ? occupant : null;
    if (monster && monsterSaddle(monster)) {
        const name = monsterName(monster, { article: 'the', suppressSaddle: true });
        if (!game.u.usteed)
            add('ride', `Ride ${name}`);
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
// C cmd.c:there_cmd_menu_common(): the "Look at map symbol" entry shared
// by every click (iflags.clicklook is ignored here); on the hero's own
// square it appears only when the shown glyph is not the ordinary hero
// symbol (steed, invisible without see invisible, polymorphed).
function commonEntries(add, x, y, click) {
    if (click !== CLICK_1 && click !== CLICK_2)
        return;
    const hero = game.u;
    if (x === hero.ux && y === hero.uy) {
        // hero_glyph: the ordinary hero symbol, or the race symbol while
        // showrace is on.
        let unusual = Upolyd(hero);
        if (!unusual) {
            const species = game.flags.showrace ? game.urace?.mnum : hero.umonnum;
            if (species === undefined)
                throw new Error('A contextual hero menu requires an initialized species');
            const glyph = monnumToGlyph(species, game.flags.female ? FEMALE : MALE);
            unusual = glyphAt(hero.ux, hero.uy)?.glyph !== glyph;
        }
        if (!unusual)
            return;
    }
    add('look-at', 'Look at map symbol');
}
// ── #lookaround (C cmd.c:dolookaround() and its selection helpers) ─────
// C cmd.c:dolookaround_floodfill_findroom(): the room flood-fill boundary.
// A missing map cell behaves like solid rock and stops the fill.
function lookaroundFloodFillFindRoom(x, y) {
    const typ = game.level?.at(x, y)?.typ ?? 0;
    return !(IS_STWALL(typ) || IS_DOOR(typ) || IS_TREE(typ)
        || IS_WATERWALL(typ) || typ === LAVAWALL || typ === IRONBARS
        || typ === SCORR || typ === SDOOR || typ === DRAWBRIDGE_UP);
}
// C cmd.c:u_have_seen_whole_selection(): no selected square still shows the
// unexplored glyph.
function haveSeenWholeSelection(selection) {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored)
                    return false;
            }
    return true;
}
// C cmd.c:u_have_seen_bounds_selection(): the rectangular outline of the
// selection has been seen, even when its interior has not.
function haveSeenBoundsSelection(selection) {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++) {
        for (const y of [bounds.ly, bounds.hy])
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored)
                    return false;
            }
    }
    for (let y = bounds.ly; y <= bounds.hy; y++) {
        for (const x of [bounds.lx, bounds.hx])
            if (isok(x, y) && selection_getpoint(x, y, selection)) {
                const glyph = glyphAt(x, y);
                if (!glyph || glyph.glyph === GlyphOffset.unexplored)
                    return false;
            }
    }
    return true;
}
// C cmd.c:u_can_see_whole_selection().
function canSeeWholeSelection(selection) {
    const bounds = selection_getbounds(selection);
    for (let x = bounds.lx; x <= bounds.hx; x++)
        for (let y = bounds.ly; y <= bounds.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, selection)
                && !cansee(x, y))
                return false;
    return true;
}
// C cmd.c:lookaround_known_room(): describe the room containing x,y.
async function lookaroundKnownRoom(x, y) {
    const selection = selection_new();
    selection_floodfill(selection, x, y, true, lookaroundFloodFillFindRoom);
    const heroHere = game.u.ux === x && game.u.uy === y;
    if (!heroHere)
        set_msg_xy(x, y);
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
    }
    else if (haveSeenBoundsSelection(selection)) {
        await pline(`You guess ${heroHere ? 'this' : 'that'} to be ${size} ${noun}.`);
    }
    else {
        await pline(`You can't guess the size of ${heroHere ? 'this' : 'that'} area.`);
    }
}
// C cmd.c:dolookaround(): the #lookaround extended command.  Describes the
// hero's room (or the rooms beside a doorway, or nothing in a corridor),
// then every seen interesting square plus remembered corridors.  Messages
// carry the accessiblemsg "(north,3east): " location prefix.
export async function dolookaround() {
    const savedFilter = game.iflags.getloc_filter;
    const savedAccessible = game.flags.accessiblemsg;
    game.flags.accessiblemsg = true;
    try {
        const heroType = game.level?.at(game.u.ux, game.u.uy)?.typ;
        let corridorNextToHero = false;
        if (heroType === CORR) {
            // In a corridor, mention corridors next to you.
            corridorNextToHero = true;
        }
        else if (heroType !== undefined && IS_DOOR(heroType)) {
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
        }
        else {
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
                if (x === game.u.ux && y === game.u.uy)
                    continue;
                if (!(gatherLocsInteresting(x, y, GLOC_INTERESTING) || isCorridor))
                    continue;
                // do_screen_description() with looked=TRUE: the detailed
                // lookat() description replaces the symbol explanation
                // whenever the screen symbol is ambiguous.
                const firstMatch = await describeMapLocation(x, y);
                await pline_xy(x, y, `${firstMatch}.`);
            }
        }
    }
    finally {
        if (savedFilter === undefined)
            delete game.iflags.getloc_filter;
        else
            game.iflags.getloc_filter = savedFilter;
        if (savedAccessible === undefined)
            delete game.flags.accessiblemsg;
        else
            game.flags.accessiblemsg = savedAccessible;
    }
    game.context.move = 0;
}
// C cmd.c:enter_explore_mode(). The pinned build's sysconf ships
// EXPLORERS=*, so authorize_explore_mode() always grants access; the
// "cannot access explore mode" and "Note: normally..." refusals stay
// unreachable for this environment.
async function enterExploreMode() {
    if (game.flags.explore) {
        await pline('You are already in explore mode.');
    }
    else {
        const oldMode = game.flags.debug ? 'debug mode' : 'normal game';
        await pline(`Beware!  From explore mode there will be no return to ${oldMode},`);
        if (await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_QUIT), 'Do you want to enter explore mode?')) {
            game.flags.explore = true;
            game.flags.debug = false;
            clearMessageWindow();
            await pline('You are now in non-scoring explore mode.');
        }
        else {
            clearMessageWindow();
            await pline(`Continuing with ${oldMode}.`);
        }
    }
    game.context.move = 0;
}
// Part of C save.c:saveobjchn(): the release_data() block that releases a
// level-owned object — victual/tin/spbook keep their o_id so the pointer
// can be restored on reload, then dealloc_obj().  Kept here because the
// level teardown that needs it lives in this module.
function freeLevelObject(object) {
    for (const content of [...(object.contents ?? [])])
        freeLevelObject(content);
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
// C cmd.c:makemap_prepost(). The pre half discards the current level —
// after wizcmds.c:makemap_remove_mons() has taken its monsters off — and
// the post half re-enters the rebuilt replacement. C parks the kept pets
// in mydogs for the post half's losedogs(); the port returns them to the
// caller instead, so the pre half returns the kept followers, and null
// when monster removal ends the game (an abort C's synchronous halves
// cannot take). In the pre half, dobjsfree() plus savelev(FREEING)
// release the level's objects below — get_freeing_nhfile() and
// close_nhfile() are only the file plumbing around that release, which
// the port performs in memory — set_uinwater(0) is the u.uinwater write,
// and the svd.dndest/svu.updest memsets need no counterpart because the
// arrival regions belong to the replacement level, which rebuilds them.
// In the post half, vision_reset() is vision_reset_new_level(),
// u_on_rndspot() keeps its C name in dungeon.ts, losedogs() is
// deliverMigratingMonsters(), u_collide_m() is resolveHeroArrivalCollision(),
// initrack() is the track reset, and deliver_splev_message() is
// deliverSpecialLevelMessages(). The INSURANCE save_currentstate()
// checkpoint is saveCurrentState() (do.ts).
// Also C dungeon.c:rm_mapseen(): inlined here (the overview record and
// annotation of the replaced level are discarded).
export async function makemapPrepost(pre, wasInsideTower, pets = []) {
    requirePlayingGame(game);
    if (pre) {
        const kept = await makemapRemoveMons();
        if (game.program_state.gameover)
            return null;
        // rm_mapseen(): discard the overview record of the level being
        // replaced; mklev() re-creates an empty one via init_mapseen().
        const key = `${game.u.uz.dnum}:${game.u.uz.dlevel}`;
        game._overviewRecords?.delete(key);
        game._levelAnnotations?.delete(key);
        // Achievement tracking; if replacing a level that has a special
        // prize, lose credit for previously finding it and reset for the
        // new instance of that prize (remove_achievement()).
        const prototype = specialPrototypeAt(game.u.uz.dnum, game.u.uz.dlevel);
        const achievement = prototype === 'minend' ? ACH_MINE_PRIZE
            : prototype === 'soko1' ? ACH_SOKO_PRIZE : null;
        if (achievement !== null) {
            const earned = game.u.uachieved ?? [];
            if (earned.some(entry => Math.abs(entry) === achievement)) {
                game.u.uachieved = earned.filter(entry => Math.abs(entry) !== achievement);
                await plineWithContinuation(`${achievement === ACH_MINE_PRIZE ? "Mine's-end" : 'Soko-prize'} achievement revoked.`);
            }
            const prizes = game.context.achieveo;
            if (prizes) {
                if (achievement === ACH_MINE_PRIZE)
                    prizes.mines_prize_oid = 0;
                else
                    prizes.soko_prize_oid = 0;
            }
        }
        if (heroIsPunished()) {
            await releaseCarriedBall(game);
            await unplaceBallAndChain();
        }
        maybeResetPick(null);
        if (sameDungeonLevel(game.context.digging?.level, game.u.uz))
            delete game.context.digging;
        game._travelTarget = null;
        if (game.context.polearm)
            game.context.polearm.hitmonId = null;
        await resetUtrap(false);
        await checkSpecialRoom({ newLevel: true });
        game.u.ustuck = null;
        game.u.uswallow = game.uswallow = 0;
        game.u.uswldtim = 0;
        game.u.uinwater = 0;
        game.u.uundetected = false;
        // savelev(FREEING) releases level-owned objects without destruction
        // rolls or uncreating their artifacts. Carried objects have
        // already left.
        const oldLevel = game.level;
        for (const column of oldLevel.objects)
            for (const pile of column ?? [])
                for (const object of [...(pile ?? [])])
                    freeLevelObject(object);
        for (const object of [...(oldLevel.buriedObjects ?? [])])
            freeLevelObject(object);
        game._levelCache?.delete(key);
        return kept;
    }
    vision_reset_new_level();
    await cls();
    const level = requireGameLevel();
    const up = !!game.u.uhave.amulet;
    const stayInsideTower = wasInsideTower && levelIsWizardTower();
    const region = stayInsideTower
        ? game._activeSpecialLevel?.downTeleportExclude
        : up ? level.upTeleportRegion : level.downTeleportRegion;
    await u_on_rndspot(region, !stayInsideTower && up);
    await deliverMigratingMonsters(game, pets);
    if (game.program_state.gameover)
        return [];
    if ((await killGenocidedMonsters()).heroDied)
        return [];
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
    await saveCurrentState();
    return [];
}
const EXTENDED_COMMAND_HANDLERS = new Map([
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
    ['terrain', terrainCommand],
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
    ['tip', dotip],
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
    ['lightsources', wizLightSources],
    ['stats', wizShowStats],
]);
// Part of C cmd.c:domonability(): the mounted steed breath-attack branch.
// C ref: cmd.c:domonability().
async function useSteedBreathAbility(steed) {
    requirePlayingGame(game);
    const result = await performPetRangedAttack(steed, game, { forced: true });
    if (result.heroDied || game.program_state.gameover)
        return;
    game.context.move = 1;
}
// C cmd.c:domonability()
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
        if ('heroDied' in result && result.heroDied)
            return;
        // polyself.c:dobreathe() returns ECMD_CANCEL for a refused direction.
        if (!result.spentTime && result.reason === 'cancelled')
            commandResultCancelled();
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const spit = heroSpitAttack(game);
    if (spit) {
        const result = await useHeroSpit({ state: game, attack: spit });
        if ('heroDied' in result && result.heroDied)
            return;
        // polyself.c:dospit() returns ECMD_CANCEL for a refused direction.
        if (result.used === false && result.reason === 'cancelled')
            commandResultCancelled();
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
// C cmd.c:doextcmd() runs the list inside its editor loop and retains the
// last executed command separately from the next editor selection.
async function readExtendedCommand() {
    let lastExecuted = null;
    for (;;) {
        // tty_get_ext_cmd() calls its line editor directly, bypassing core
        // getlin()'s status suppression. Its prompt restores status after #?.
        const selected = game.flags.extmenu ? await extendedCommandMenu() : await editExtendedCommand();
        if (selected?.handler !== 'doextlist')
            return { selected, lastExecuted };
        if (!await commandAllowed(selected))
            return { selected: null, lastExecuted };
        await showExtendedCommandList();
        lastExecuted = selected;
    }
}
// ── Extended-command list and autocomplete (C cmd.c:doextlist(),
//    extcmd_via_menu(), parseautocomplete(), handler_change_autocompletions()) ──
// Runtime AUTOCOMPLETE overlay: parseAutocomplete() flips the flag on
// individual extcmdlist entries at runtime, and the generated command
// table here is immutable, so the adjustments live in this overlay.
const autocompleteOverrides = new Map();
// Part of C cmd.c:parseautocomplete(): setting one command's
// autocomplete flag.
export function setCommandAutocomplete(name, enabled) {
    const command = NATIVE_COMMANDS.find(entry => entry.name === name);
    if (command && enabled === !!(command.flags & NATIVE_COMMAND_FLAGS.AUTOCOMPLETE))
        autocompleteOverrides.delete(name);
    else
        autocompleteOverrides.set(name, enabled);
}
// Port only: clear per-engine autocomplete overrides.
// One native process parses one rc file; the overrides must not outlive an
// engine start in this port.
export function resetCommandAutocomplete() {
    autocompleteOverrides.clear();
}
// Part of C cmd.c:parseautocomplete(): the effective autocomplete flag.
export function commandAutocompletes(command) {
    const override = command.name !== null ? autocompleteOverrides.get(command.name) : undefined;
    return override !== undefined ? override : !!(command.flags & NATIVE_COMMAND_FLAGS.AUTOCOMPLETE);
}
// C cmd.c:count_autocompletions() counts changes from the compiled defaults.
export function countCommandAutocompletions() {
    return autocompleteOverrides.size;
}
// C cmd.c:handler_change_autocompletions()
// This editor includes wizard commands even during ordinary play, as C does.
// C cmd.c:handler_change_autocompletions().
export async function changeCommandAutocompletions() {
    const commands = NATIVE_COMMANDS.filter(command => command.name !== null
        && command.name.length >= 2
        && !(command.flags & (NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE | NATIVE_COMMAND_FLAGS.INTERNALCMD)));
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    for (const command of commands) {
        tty_add_menu(window, { identifier: command,
            text: `${autocompleteOverrides.has(command.name ?? '') ? '*' : ' '} ${command.name}: ${commandDescription(command)}`,
            itemflags: commandAutocompletes(command) ? MENU_ITEMFLAGS_SELECTED : 0 });
    }
    tty_end_menu(window, 'Which commands autocomplete?');
    const result = await tty_select_menu(window, PICK_ANY);
    await tty_destroy_nhwindow(window);
    if (result.cancelled)
        return;
    const selected = new Set(result.selections.map(item => item.identifier));
    for (const command of commands) {
        if (command.name !== null)
            setCommandAutocomplete(command.name, selected.has(command));
    }
}
// C cmd.c:extcmds_match(): find the available extended-command entries
// matching a prefix (or all of them for a null findstr), for windowport
// autocompletion.
export function extcmdsMatch(findstr, options = {}) {
    const { ignoreAutocomplete = false, exactMatch = false, noOneCharCommand = false } = options;
    const needle = findstr?.toLowerCase();
    return NATIVE_COMMANDS.filter(command => {
        const name = command.name;
        if (name === null
            || (command.flags & (NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE | NATIVE_COMMAND_FLAGS.INTERNALCMD)) !== 0)
            return false;
        if (!game.flags.debug && (command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD) !== 0)
            return false;
        if (!ignoreAutocomplete && !commandAutocompletes(command))
            return false;
        if (noOneCharCommand && name.length === 1)
            return false;
        if (needle === undefined)
            return true;
        const haystack = name.toLowerCase();
        return exactMatch ? haystack === needle : haystack.startsWith(needle);
    });
}
// Part of C cmd.c:extcmds_match(): the findstr == NULL, ECM_IGNOREAC case:
// every flag-eligible entry, shared by the extended-command editor, list,
// and menu.
export function availableExtendedCommands() {
    return extcmdsMatch(null, { ignoreAutocomplete: true });
}
// Port only: the ext_func_tab description text keyed by command name.
export function commandDescription(command) {
    // update_rest_on_space() binds its own wait entry with a distinct description.
    if (command.name === 'wait' && command.key === 32)
        return "rest one move via 'rest_on_space' option";
    return COMMAND_DESCRIPTIONS.get(command.name ?? '') ?? '';
}
// C cmd.c:extcmd_via_menu().
export async function extendedCommandMenu() {
    let prefix = '';
    let biggest = 0;
    for (;;) {
        const choices = availableExtendedCommands().filter(command => commandAutocompletes(command) && command.name?.startsWith(prefix));
        if (choices.length <= 1)
            return choices[0] ?? null;
        biggest = Math.max(biggest, ...choices.map(command => commandDescription(command).length));
        const window = tty_create_nhwindow(NHW_MENU);
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
            if (initial !== previous || onePerLine)
                wrapped = false;
            if (initial !== previous || onePerLine
                || (count >= 2 && text.length + 4 + name.length >= COLNO - 6)) {
                if (count) {
                    flush();
                    count = 0;
                    if (initial === previous && !onePerLine)
                        wrapped = true;
                }
            }
            previous = initial;
            if (!count || onePerLine)
                text = `${wrapped ? 'or ' : ''}${name} [${commandDescription(command)}]`;
            else if (count === 1)
                text = `${wrapped ? 'or ' : ''}${choices[index - 1]?.name ?? ''} or ${name}`;
            else
                text += ` or ${name}`;
            count++;
        }
        if (count)
            flush();
        tty_end_menu(window, `Extended Command: ${prefix}`);
        const result = await tty_select_menu(window, PICK_ONE);
        await tty_destroy_nhwindow(window);
        const selected = result.selections[0]?.identifier;
        if (selected)
            prefix += selected;
        else if (prefix)
            prefix = '';
        else
            return null;
    }
}
// C cmd.c:doextlist()
// A list entry is informational. Only the list controls are selectable.
// C cmd.c:doc_extcmd_flagstr().
// C cmd.c:accept_menu_prefix().
export async function showExtendedCommandList() {
    let autocompleteOnly = false, oneList = false, search = '';
    for (;;) {
        const window = tty_create_nhwindow(NHW_MENU);
        await tty_start_menu(window);
        const label = (text) => tty_add_menu(window, { identifier: null, text });
        const option = (key, text, group = '') => tty_add_menu(window, { identifier: key, selector: key, group, text });
        label('Extended Commands List');
        label('');
        option('a', `Switch to ${autocompleteOnly ? 'including' : 'excluding'} commands that don't autocomplete`);
        if (!search)
            option(':', 'Search extended commands', 's');
        else
            option('s', `Switch back from search ("${search}")`, ':');
        if (game.flags.debug)
            option('z', oneList
                ? 'Switch to showing debugging commands in separate section'
                : 'Switch to showing all alphabetically, including debugging commands');
        label('');
        let found = 0;
        for (const wizardSection of oneList || !game.flags.debug ? [false] : [false, true]) {
            const entries = availableExtendedCommands().map(command => ({
                command, description: listedCommandDescription(command),
            })).filter(({ command, description }) => (oneList || !!(command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD) === wizardSection)
                && (!autocompleteOnly || commandAutocompletes(command))
                && (!search || matchesSearch(command.name ?? '', search)
                    || matchesSearch(description, search)));
            if (!entries.length)
                continue;
            addMenuHeading(window, wizardSection ? 'Debugging Extended Commands' : 'Extended commands');
            for (const { command, description } of entries) {
                const markers = `${command.flags & NATIVE_COMMAND_FLAGS.CMD_M_PREFIX ? 'm' : ''}${commandAutocompletes(command) ? 'A' : ''}`;
                label(` ${(command.name ?? '').padEnd(14)} ${(markers ? `[${markers}]` : '').padStart(4)} ${description}`);
                found++;
            }
            label('');
        }
        if (search && !found)
            label('no matches');
        else {
            label('[A] Command autocompletes');
            label(`[m] Command accepts '${visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'))}' prefix`);
        }
        tty_end_menu(window);
        const result = await tty_select_menu(window, PICK_ONE);
        await tty_destroy_nhwindow(window);
        const action = result.selections[0]?.identifier;
        if (action === 'a')
            autocompleteOnly = !autocompleteOnly;
        else if (action === 'z') {
            oneList = !oneList;
            search = '';
        }
        else if (action === 's')
            search = '';
        else if (action === ':') {
            const phrase = await getLine('Extended command list search phrase?', (_ch, key) => key >= 32);
            search = phrase?.trim().replace(/\s+/g, ' ') ?? '';
            if (!search) {
                game.context.move = 0;
                return;
            }
        }
        else {
            game.context.move = 0;
            return;
        }
    }
}
// Part of C cmd.c:doextlist(): the #genocided description wording for
// ordinary games.
// C doextlist() changes the description before both searching and display.
function listedCommandDescription(command) {
    const description = commandDescription(command);
    if (game.flags.debug || game.flags.explore || !(command.flags & NATIVE_COMMAND_FLAGS.GENERALCMD))
        return description;
    return description.replace(' been genocided or become extinct', ' been genocided');
}
// Part of C cmd.c:doextlist(): the substring-then-pmatchi() wildcard
// search filter.
function matchesSearch(text, pattern) {
    if (text.toLowerCase().includes(pattern.toLowerCase()))
        return true;
    const expression = [...pattern].map(character => character === '*' ? '.*'
        : character === '?' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    return new RegExp(`^${expression}$`, 'i').test(text);
}
// C cmd.c:dotravel()
// Uses getpos.c:getpos(), hack.c:handle_tip(), and
// dat/nhcore.lua show_getpos_tip().  The tty message window and the Lua text
// window own distinct input boundaries; after the tutorial, getpos retains
// its cursor and accepts terrain-symbol cycling before one of the pick keys.
async function dotravel() {
    game.iflags.getloc_travelmode = true;
    // C cmd.c dotravel(): the travel pline precedes getpos() and joins the
    // instructions pline in the tty topline transaction; only the menu path
    // skips both.
    if (!game.iflags.menu_requested)
        await pline('Where do you want to travel to?');
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
                if (firstUse)
                    await pline('Move cursor to the desired destination:');
                return game._pending_message;
            },
            goal: 'the desired destination',
        });
    if (!cursor) {
        game.iflags.getloc_travelmode = false;
        // dotravel() returns ECMD_OK for menu dismissal, ECMD_CANCEL for ESC
        // in getpos(). Only the latter discards both command queues.
        if (game.iflags.menu_requested)
            game.context.move = 0;
        else
            commandResultCancelled();
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
async function dotravelTarget() {
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
    // C cmd.c:dotravel_target(): context.travel = travel1 = 1, run = 8,
    // nopick = 1, the DOMOVE_RUSH repeat ration when multi is zero,
    // last_str_turn = 0, context.mv = TRUE. _runState is the port's
    // DOMOVE_RUSH mirror and _travelTarget holds iflags.travelcc.
    game.context.travel = true;
    game.context.travel1 = true;
    game.context.run = 8;
    game.context.nopick = true;
    game._runState = { mode: 8, targetX: target.x, targetY: target.y };
    if (!game.multi)
        game.multi = Math.max(COLNO, ROWNO);
    game.lastStrTurn = 0;
    game.context.mv = true;
    game._travelTarget = { x: target.x, y: target.y };
    const outcome = await domove(game.u.dx ?? 0, game.u.dy ?? 0);
    const moved = outcome === 'time';
    if (game.program_state.gameover)
        return;
    // C domove_core() skips runmode_delay_output() on early returns,
    // including attacks, blocked steps and the final travel pet bump.
    // A refused pet swap reaches the tail after restoring the hero.
    const reachedTail = !!game._domoveReachedTail;
    if (moved && reachedTail)
        await captureRunmodeDelay(game, !!game.context.run || game.multi > 0);
    // The target-selection command itself is time-consuming.  A blocked
    // first step stops travel but still reaches the monster/global turn.
    game.context.move = 1;
    const arrived = game.u.ux === target.x && game.u.uy === target.y;
    if (arrived)
        game._travelTarget = null;
    if (!moved && outcome !== 'opened-door')
        stopRun();
    // Only findtravelpath()'s own nomul(0)-then-run=8 paths (the adjacent
    // shortcut and the backward-search arrival) keep C's lingering run at
    // 8.  A step that entered the target without one of those ends at C's
    // found: label instead: nomul(0) leaves run 0 with the repaint pending.
    else if (arrived && !game._runState)
        arriveTravel(game);
    else if (arrived)
        stopRun();
    // Pathfinding can end travel without entering the target. Keep
    // C's restored run value and let screen flushes own time updates.
    else if (!game._runState && game.context.run === 8)
        arriveTravel(game);
}
// C cmd.c:count_bind_keys()
// ── Key-binding menus (C cmd.c:handler_rebind_keys*(), count_bind_keys(),
//    get_changed_key_binds()) ────────────────────────────────────────────
// C cmd.c:count_bind_keys()
// cmd.c count_bind_keys(): user rebinds plus default keys that no longer
// have their command bound.
export function countBindKeys() {
    const bound = new Set(game.commandBindings.bindings.map(binding => binding.key));
    let count = 0;
    for (const binding of game.commandBindings.bindings)
        if (binding.user && binding.command && binding.command.key !== binding.key)
            count++;
    for (const command of NATIVE_COMMANDS)
        if (command.key && !bound.has(command.key))
            count++;
    return count;
}
// C cmd.c:get_changed_key_binds()
// The "BIND=key:command" config rows.
export function changedKeyBindsLines() {
    const bound = new Set(game.commandBindings.bindings.map(binding => binding.key));
    const lines = [];
    for (const binding of game.commandBindings.bindings) {
        if (!binding.user || !binding.command || binding.command.key === binding.key)
            continue;
        const parameter = binding.command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM
            && binding.parameter !== null ? `(${binding.parameter})` : '';
        lines.push(`BIND=${keyText(binding.key)}:${binding.command.name}${parameter}`);
    }
    for (const command of NATIVE_COMMANDS)
        if (command.key && !bound.has(command.key))
            lines.push(`BIND=${keyText(command.key)}:nothing`);
    return lines;
}
// C cmd.c:handler_rebind_keys_add()
// keyfirst asks for the key before showing
// the command list, otherwise the key is asked after a command is chosen.
async function handlerRebindKeysAdd(keyfirst) {
    let key = 0;
    if (keyfirst) {
        await pline('Bind which key? ');
        renderKeyPrompt('Bind which key? ');
        key = (await pgetchar()) & 255;
        if (!key || key === 27)
            return;
    }
    const rows = [];
    if (key) {
        const binding = game.commandBindings.lookup(key);
        rows.push(binding?.command
            ? { selectable: false, text: `Key '${keyText(key)}' is currently bound to "${binding.command.name}".` }
            : { selectable: false, text: `Key '${keyText(key)}' is not bound to anything.` });
        rows.push({ selectable: false, text: '' });
    }
    // The unbind row carries identifier -1; command rows keep their
    // extcmdlist index + 1, as C's add_menu identifiers do.
    rows.push({ value: -1, text: 'nothing: unbind the key' });
    rows.push({ selectable: false, text: '' });
    for (const [index, command] of NATIVE_COMMANDS.entries()) {
        if (command.flags & (NATIVE_COMMAND_FLAGS.MOVEMENTCMD
            | NATIVE_COMMAND_FLAGS.INTERNALCMD | NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE))
            continue;
        rows.push({ value: index + 1,
            text: `${command.name}: ${COMMAND_DESCRIPTIONS.get(command.name ?? '') ?? ''}` });
    }
    const picks = await showMultiSelectWindow({
        title: key ? `Bind '${keyText(key)}' to what command?` : 'Bind what command?',
        omitHeadings: true, pickOne: true, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows }],
    });
    if (!picks || !picks.length)
        return;
    const pick = picks[0];
    if (pick === undefined)
        return;
    let commandText;
    let command = null;
    if (pick === -1) {
        commandText = 'nothing';
    }
    else {
        command = NATIVE_COMMANDS[pick - 1] ?? null;
        if (!command)
            return;
        if (command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM) {
            const answer = await getLine(`Command ${command.name} requires a parameter:`, (_character, keyCode) => keyCode >= 32 && keyCode < 127);
            // mungspaces() condenses the answer; an ESC stays in the buffer
            // and ends up inside the binding parameter, as in C.
            const parameter = (answer ?? '\x1b').replace(/\s+/g, ' ').trim();
            commandText = `${command.name}(${parameter})`;
        }
        else {
            commandText = command.name ?? '';
        }
    }
    if (!key) {
        await pline('Bind which key? ');
        renderKeyPrompt('Bind which key? ');
        key = (await pgetchar()) & 255;
        if (!key || key === 27)
            return;
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
    }
    else {
        await pline('Key binding failed?!');
    }
}
// C cmd.c:handler_rebind_keys()
// The "Do what?" pick list, redone after every
// action until it is cancelled.
export async function handlerRebindKeys() {
    for (;;) {
        const rows = [
            { value: 1, text: 'bind key to a command' },
            { value: 2, text: 'bind command to a key' },
        ];
        if (countBindKeys())
            rows.push({ value: 3, text: 'view changed key binds' });
        const picks = await showMultiSelectWindow({
            title: 'Do what?', omitHeadings: true, pickOne: true, signalEscape: true,
            pageLocalKeys: true,
            sections: [{ items: rows }],
        });
        if (!picks || !picks.length)
            return;
        if (picks[0] === 1)
            await handlerRebindKeysAdd(true);
        else if (picks[0] === 2)
            await handlerRebindKeysAdd(false);
        else if (picks[0] === 3)
            await showTextWindow(changedKeyBindsLines());
    }
}
// C cmd.c:parseautocomplete(): splits on the first comma, else the first
// colon, processes the remainder first, then requires an exact (case
// sensitive) extended-command name.
export function parseAutocomplete(value, addRawError) {
    let separator = value.indexOf(',');
    if (separator < 0)
        separator = value.indexOf(':');
    if (separator >= 0) {
        parseAutocomplete(value.slice(separator + 1), addRawError);
        value = value.slice(0, separator);
    }
    value = value.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (!value)
        return;
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
// Part of C cmd.c:rhack(): adapter that initializes the command result before a handler runs.
// ── Runtime command counts and results (C cmd.c:rhack(), reset_cmd_vars()) ──
// Port only: begin an ECMD_* result accumulation.
// C command handlers return an ECMD_* status which rhack() inspects after
// the command finishes (cmd.c:3810): ECMD_CANCEL and ECMD_FAIL make it call
// reset_cmd_vars(TRUE), clearing CQ_CANNED and CQ_REPEAT. JS handlers run
// before that seam, so they record the same bits here instead.
export function beginCommandResult(state = game) {
    state._commandResult = ECMD_OK;
}
// Port only: OR ECMD_CANCEL into the result a C return value would carry.
// Multiple failure paths can combine bits exactly like a C return value
// (use_pole() returns res|ECMD_CANCEL after an already-timed wield).
export function commandResultCancelled(state = game) {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_CANCEL;
}
// Port only: OR ECMD_FAIL into the result a C return value would carry.
export function commandResultFailed(state = game) {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_FAIL;
}
// Part of C apply.c:doapply(): adapter that preserves ECMD_TIME from an artifact speaking during tool use.
// doapply() ORs arti_speak()'s ECMD_TIME into the tool result
// (apply.c:4422), so a cancelled tool use by a speaking artifact still
// spends its turn.
export function commandResultSpentTime(state = game) {
    state._commandResult = (state._commandResult ?? ECMD_OK) | ECMD_TIME;
}
// Part of C cmd.c:rhack(): the DOMOVE_RUSH setup after set_move_cmd(), before hack.c:lookaround().
// C refs: cmd.c set_move_cmd(run=1) and hack.c lookaround().
export function startRun(dx, dy, g = game, mode = 1) {
    g._runState = {
        dx, dy,
        mode,
    };
    g.lastStrTurn = 0;
    // C's DOMOVE_RUSH dispatch grants the movement ration whenever the
    // repeat begins, regardless of the surviving context.run value.
    if (!g.multi)
        g.multi = Math.max(COLNO, ROWNO);
    g.context.run = mode;
    g.context.mv = true;
    return g._runState;
}
// Part of C cmd.c:rhack(): the DOMOVE_WALK setup for a counted direction.
// C rhack()'s DOMOVE_WALK dispatch (cmd.c:3785-3788): a counted direction
// only marks the repeat active.  context.run keeps whatever value an
// earlier rush or travel left behind, as does the last corridor turn.
// No movement ration is granted.
export function startWalkRepeat(dx, dy, g = game) {
    g._runState = { dx, dy, mode: 0 };
    g.context.mv = true;
    return g._runState;
}
// C cmd.c:reset_cmd_vars(). Full command_count belongs to the next parse.
// Unlike end_running(), reset_cmd_vars() zeroes context.run directly: no
// time repaint is queued and the terrain classifier is not recomputed.
export function resetCommandVariables(clearQueues) {
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
        cmdq_clear(CQ_CANNED);
        cmdq_clear(CQ_REPEAT);
    }
}
// C cmd.c:reset_occupations(): forget resumable occupation state whose
// target may have changed since the occupation was interrupted.
export function resetOccupations(state = game) {
    resetBulkTakeoff(state);
    resetPick(state);
    resetTrapSetting(state);
}
// ── Command queues (C cmd.c:cmdq_*) ──────────────────────────────────────
// gc.command_queue[CQ_CANNED] holds canned sequences the game queues for
// itself; CQ_REPEAT records the player's live command and its answers for
// do-again. cmdq_pop() picks CQ_REPEAT while a do-again replay runs, exactly
// like gi.in_doagain does in C (cmd.c:412).
// C cmd.c:cmdq_add_ec()
export function cmdq_add_ec(q, handler, state = game) {
    state.command_queue[q].push({ typ: CMDQ_EXTCMD, ecEntry: extFuncTabFromFunc(handler) });
}
// C cmd.c:cmdq_add_key()
export function cmdq_add_key(q, key, state = game) {
    state.command_queue[q].push({ typ: CMDQ_KEY, key: key & 255 });
}
// C cmd.c:cmdq_add_dir()
export function cmdq_add_dir(q, dx, dy, dz, state = game) {
    state.command_queue[q].push({ typ: CMDQ_DIR, dirx: dx, diry: dy, dirz: dz });
}
// C cmd.c:cmdq_add_userinput()
export function cmdq_add_userinput(q, state = game) {
    state.command_queue[q].push({ typ: CMDQ_USER_INPUT });
}
// C cmd.c:cmdq_add_int()
export function cmdq_add_int(q, val, state = game) {
    state.command_queue[q].push({ typ: CMDQ_INT, intval: val });
}
// Port only: resolve an extended-command name to its table entry. C's
// act_on_act() and domouseaction() hold the ext_func_tab pointer directly;
// the TS menu selections carry the visible name, so this stands in for that
// pointer at every cmdq_add_ec() call.
function commandByName(name) {
    const command = NATIVE_COMMANDS.find(candidate => candidate.name === name);
    if (!command)
        throw new Error(`No command named ${name}`);
    return command;
}
// C cmd.c:cmdq_pop(): take the topmost entry from the selected queue.
export function cmdq_pop(state = game) {
    const q = state._inDoAgain ? CQ_REPEAT : CQ_CANNED;
    return state.command_queue[q].shift() ?? null;
}
// C cmd.c:cmdq_peek(): the top entry without popping it.
export function cmdq_peek(q, state = game) {
    return state.command_queue[q][0] ?? null;
}
// C cmd.c:cmdq_clear()
export function cmdq_clear(q, state = game) {
    state.command_queue[q].length = 0;
}
// C cmd.c:cmdq_copy()
export function cmdq_copy(q, state = game) {
    return state.command_queue[q].map(entry => ({ ...entry }));
}
// C cmd.c:cmdq_shift(): move the last entry to the front.
export function cmdq_shift(q, state = game) {
    const queue = state.command_queue[q];
    const last = queue.pop();
    if (last)
        queue.unshift(last);
}
// Port only: the u.multi counter with involuntary delays mirrored
// negative.
// C has one multi counter; involuntary delays have a positive mirror here.
export function currentMulti(state = game) {
    const helplessTurns = state._helplessTurns ?? 0;
    if (helplessTurns > 0)
        return -helplessTurns;
    return state.multi;
}
// Port only: assignment of the unified multi counter.
// Direct native assignments (combat wake, life saving, unmul, countdown)
// must change the same counter that nomul() compares during this turn.
export function setMulti(value, state = game) {
    state.multi = value;
    state._helplessTurns = Math.max(0, -value);
}
// Port only: the native multi < 0 involuntary-delay test.
// Native multi < 0 includes sleep, paralysis, prayer, and delayed actions.
export function heroHasInvoluntaryDelay(state = game) {
    return currentMulti(state) < 0;
}
// ── Command counts (C cmd.c:get_count(), parse()) ─────────────────────────
// C cmd.c:parse(): read the command key and its count prefix; C's rhack()
// runs this whenever the command queue has no queued input.
export async function readCommandInput() {
    game._commandCount = 0;
    setMulti(0);
    await flush_screen(1);
    // parse() runs get_count() in command input state.
    const readCount = async () => {
        const { key, count } = await getCount(0, BigInt(NATIVE_COMMAND_CONSTANTS.LARGEST_INT), GC_NOFLAGS, 'command');
        return { key, count: Number(count) };
    };
    let result;
    if (game.commandBindings.numberPad) {
        const key = await readchar('command');
        result = (key & 255) === game.commandBindings.specialKey('count')
            ? await readCount() : { key, count: 0 };
    }
    else {
        result = await readCount();
    }
    game._commandCount = result.count;
    setMulti(Math.max(0, result.count - 1));
    game._commandKey = result.key;
    // C parse() clears WIN_MESSAGE after reading command key.
    if (game._pending_message || game._retained_message || game._promptOwnsTopline)
        clearMessageWindow();
    return result;
}
// C include/hack.h: get_count() control flags.
export const GC_NOFLAGS = 0;
export const GC_SAVEHIST = 1; /* save "Count: 123" in message history */
export const GC_CONDHIST = 2; /* save it unless the count equals the first digit */
export const GC_ECHOFIRST = 4; /* echo "Count: 1" even when there's only one digit */
// C cmd.c:get_count(): gather typed digits into a count and return the next
// non-digit key (allowchars is Null at every C call site, so any key
// accepts). Backspace edits the count, Escape breaks with a zero count,
// and counts above nine are echoed. The bigint count models C's long:
// AppendLongDigit() overflow past the native maximum resets it to zero.
export async function getCount(inkey, maxcount, gcFlags, inputState = 'other') {
    const historicmsg = (gcFlags & GC_SAVEHIST) !== 0;
    const conditionalmsg = (gcFlags & GC_CONDHIST) !== 0;
    const echoalways = (gcFlags & GC_ECHOFIRST) !== 0;
    const first = inkey ? BigInt(inkey - 48) : 0n;
    let key = 0;
    let count = 0n;
    let accepted = 0n;
    let backspaced = false;
    let showzero = false;
    for (;;) {
        if (inkey) {
            key = inkey;
            inkey = 0;
        }
        else {
            key = await readchar(inputState);
        }
        if (key >= 48 && key <= 57) {
            const next = count * 10n + BigInt(key - 48);
            count = next > 9223372036854775807n ? 0n : next;
            if (maxcount > 0n && count > maxcount)
                count = maxcount;
            /* if we've backed up to nothing, then typed 0, show that 0 */
            showzero = key === 48;
        }
        else if (key === 8 || key === 127) {
            if (!count && !echoalways)
                break;
            showzero = false;
            count /= 10n;
            backspaced = true;
        }
        else if (key === 27) {
            break;
        }
        else {
            accepted = count;
            break;
        }
        if (count > 9n || backspaced || echoalways) {
            clearMessageWindow();
            let text;
            if (backspaced && !count && !showzero) {
                text = 'Count: ';
            }
            else {
                text = `Count: ${count}`;
                backspaced = false;
            }
            // The echo itself is custompline(SUPPRESS_HISTORY).
            await setTopline(text);
            await flush_screen(0);
            game.nhDisplay?.setCursor(text.length, 0);
        }
    }
    // C get_count() files "Count: N <key>" after the loop: always under
    // GC_SAVEHIST, and under GC_CONDHIST only when the final count differs
    // from the first digit passed in via inkey.
    if (historicmsg || (conditionalmsg && accepted !== first))
        putMessageHistory(`Count: ${accepted} ${keyText(key)}`);
    return { key, count: accepted };
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
// Part of C cmd.c:reset_commands(): the Ctrl-direction rush bindings.
export function controlRushDirection(key) {
    return CONTROL_RUSH_DIRECTION.get(key) || null;
}
// Port only: the execution key a command-table entry selects (not the
// live key map).
// These keys select existing JS handlers; they are not the live key map.
export function commandExecutionKey(command) {
    if (!command)
        return null;
    const direct = DEFAULT_COMMAND_KEYS.get(command);
    if (direct)
        return direct;
    for (const mode of ['run', 'rush']) {
        if (!command?.startsWith(mode))
            continue;
        const direction = DEFAULT_COMMAND_KEYS.get(`move${command.slice(mode.length)}`);
        if (direction)
            return mode === 'run' ? direction.toUpperCase()
                : String.fromCharCode(direction.charCodeAt(0) & 31);
    }
    return null;
}
// Part of C cmd.c:yn_function(): converting a direction to its movement
// key.
// movecmd() recognizes a bound handler, including run/rush and vertical
// movement. This projection keeps the existing direction consumers on one
// coordinate alphabet without treating that alphabet as the live bindings.
export function movementDirectionKey(key, bindings) {
    const movement = bindings.movementForKey(key);
    return movement ? 'hykulnjb><'.charAt(movement.direction) : '';
}
// Part of C cmd.c:yn_function(): the self-key answer for a queued
// direction.
export function promptedDirectionKey(key, bindings) {
    if (key === bindings.specialKey('getdir.self')
        || key === bindings.specialKey('getdir.self2'))
        return '.';
    return movementDirectionKey(key, bindings);
}
// C cmd.c:cmd_from_ecname().
export function commandKeyDescription(command, bindings) {
    const name = String(command);
    if (!NATIVE_COMMANDS.some(entry => entry.name === name))
        return '';
    const key = bindings.keyForCommand(name);
    return key ? visibleCommandKey(key) : `#${name}`;
}
const GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const impairedDirections = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1],
];
// Top-line key prompts used by commands which can pause for input.
// C refs: win/tty/topl.c more() and win/tty/wintty.c tty_nhgetch().
// Part of C cmd.c:yn_function(): paint the pending key prompt on the
// topline (C's tty_yn_function() shows the question via
// custompline(SUPPRESS_HISTORY) and reads the answer key).
async function paintKeyPrompt(message, cursorOffset = 0) {
    await setTopline(message);
    await flush_screen(1);
    return renderKeyPrompt(message, cursorOffset);
}
// Part of C cmd.c:yn_function(): the queue-aware key prompt and its
// canned answers.
export async function promptKey(message, cursorOffset = 0, { canned = true } = {}) {
    // C cmd.c:yn_function() answers from the command queue without ever
    // reaching tty_yn_function(); gt.toplines is untouched then. A queued
    // direction or extended command is the "not CMDQ_USER_INPUT" branch
    // (cmd.c:5496-5509): cmdq_clear(CQ_CANNED) and the ESC initializer,
    // while the user-input placeholder keeps the live question.
    if (canned) {
        const cmdq = cmdq_pop();
        if (cmdq && cmdq.typ === CMDQ_KEY)
            return cmdq.key;
        if (cmdq && cmdq.typ !== CMDQ_USER_INPUT) {
            cmdq_clear(CQ_CANNED);
            return 27;
        }
    }
    // tty_yn_function() with a null response list goes straight from its
    // custompline(SUPPRESS_HISTORY) prompt to readchar() and clean_up:
    // ^P has no special meaning and comes back as the answer.
    game._suppressMessagesUntilInput = false;
    const coveredRows = await paintKeyPrompt(message, cursorOffset);
    // tty_yn_function() uses readchar(), including its EOF and fuzzer rules.
    const key = await readchar();
    // Fuzzer input bypasses nhgetch(); tty_yn_function's cleanup still marks
    // its question as read.
    if (game._pending_message) {
        game._retained_message = game._pending_message;
        game._pending_message = '';
    }
    // clean_up rewrites gt.toplines with the prompt and its recorded answer.
    game._toplines = `${message}${keyText(key)}`;
    // C tty_yn_function() retains a one-line query, but clears wrapped ones.
    if (coveredRows > 1)
        clearMessageWindow(coveredRows);
    return key;
}
// Part of C cmd.c:yn_function(): the response-free single-key query path.
// The response-free single-key call form of cmd.c:yn_function() —
// yn_function(query, (char *) 0, def, TRUE) — used by getobj() prompts
// and invent.c:adjust_split(). Its queue handling is yn_function()'s
// (below); the live question renders through promptKey() rather than the
// response-list menu path. cmdq_pop() answers from CQ_REPEAT during
// do-again without drawing anything, and a live answer is recorded back
// into CQ_REPEAT for the next do-again.
export async function ynSingleKey(message, cursorOffset = 0) {
    // C cmd.c:yn_function(): one cmdq_pop() (cmd.c:5496) — CQ_REPEAT
    // during do-again, CQ_CANNED otherwise — sets addcmdq FALSE when it
    // holds anything but the user-input placeholder, so a canned answer
    // never lands in CQ_REPEAT. A key answers, the placeholder asks live,
    // and every other entry clears CQ_CANNED and answers Escape.
    const cmdq = cmdq_pop();
    if (cmdq && cmdq.typ !== CMDQ_USER_INPUT) {
        if (cmdq.typ !== CMDQ_KEY)
            cmdq_clear(CQ_CANNED);
        return cmdq.typ === CMDQ_KEY ? cmdq.key : 27;
    }
    // CMDQ_USER_INPUT reads live from the terminal, so the live question
    // never takes another queue entry.
    const key = await promptKey(message, cursorOffset, { canned: false });
    cmdq_add_key(CQ_REPEAT, key);
    return key;
}
// Part of C cmd.c:yn_function(): the queued-direction answer key.
// C getdir() converts CMDQ_DIR through xytodir() and Cmd.dirchars only
// when it needs the direction; other prompts must keep its entry type.
function queuedDirectionKey({ dirx, diry, dirz }) {
    const direction = dirz ? zdir.findIndex(z => z === Math.sign(dirz))
        : xdir.findIndex((x, index) => index < N_DIRS && x === dirx && ydir[index] === diry);
    // A distant vector yields DIR_ERR. The pinned recorder reads NUL at
    // dirchars[-1] and cancels silently; avoid that out-of-bounds read.
    return direction < 0 ? 0 : game.commandBindings.directionKeys.charCodeAt(direction);
}
// C cmd.c:getdir(): the direction-question loop with its key handling,
// movecmd() translation, confdir() and help_dir() assists.  Key
// acquisition pops one entry (cmd.c:3962); cmdq_pop() selects CQ_REPEAT
// during do-again, otherwise CQ_CANNED, and only CMDQ_DIR and CMDQ_KEY
// answer it.  After the help or redraw retry, every further key comes from
// readchar() (repeating) or yn_function() (ordinary play), never from the
// command queue again.  The query is removed immediately after a key
// arrives, before it is interpreted as a direction, cancellation, or help.
// Also C cmd.c:redraw_cmd(): inlined here (the doredraw retry check that
// keeps the redraw key out of the recorded answer, and the retry branch).
// Also C cmd.c:dxdy_moveok(): inlined here (the grid-bug refusal that
// ends the question with "You can't orient yourself that direction.").
export async function promptDirection(prompt = 'In what direction? ', { ctrlCommandHint = false } = {}) {
    let retry = false;
    for (;;) {
        // C cmd.c:getdir() pops one entry (cmd.c:3962); cmdq_pop() selects
        // CQ_REPEAT during do-again, otherwise CQ_CANNED. Only CMDQ_DIR and
        // CMDQ_KEY answer it; every other popped entry clears CQ_CANNED and
        // reports the impossible (cmd.c:3974-3977).
        const queued = retry ? null : cmdq_pop();
        let key;
        if (queued) {
            if (queued.typ === CMDQ_DIR)
                key = queuedDirectionKey(queued);
            else if (queued.typ === CMDQ_KEY)
                key = queued.key;
            else {
                cmdq_clear(CQ_CANNED);
                await impossible('getdir: command queue had no dir?');
                key = 0;
            }
        }
        else if (game._inDoAgain) {
            // C getdir() bypasses yn_function() while repeating: readchar()
            // takes the next physical key without painting the question
            // (cmd.c:3985-3986), and the message line is still cleared
            // afterwards (cmd.c:4010-4011).
            key = (await readchar('direction')) & 255;
            clearMessageWindow();
        }
        else {
            // tty_yn_function() skips an unread topline stopped by Escape, then
            // clears WIN_STOP before painting its question.
            if (game._suppressMessagesUntilInput)
                clearMessageWindow();
            else
                await flushPendingTopline();
            game._suppressMessagesUntilInput = false;
            await paintKeyPrompt(prompt);
            key = (await readchar('direction')) & 255;
            // C cmd.c:4017-4018 records the live answer for do-again, except a
            // redraw key, which getdir() retries instead.
            if (game.commandBindings.lookup(key)?.command?.handler !== 'doredraw')
                cmdq_add_key(CQ_REPEAT, key);
            // getdir() asks through yn_function(), whose clean_up rewrites
            // gt.toplines with the prompt and its recorded answer.
            game._toplines = `${prompt}${keyText(key)}`;
            clearMessageWindow();
        }
        retry = true; // the entry cmdq_pop() is spent; retries read fresh keys
        const code = key & 255;
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
        }
        else if (direction === '.')
            hero.dx = hero.dy = 0;
        else if (direction === '<' || direction === '>') {
            hero.dx = hero.dy = 0;
            hero.dz = direction === '<' ? -1 : 1;
        }
        else {
            // C getdir() skips invalid-direction help for all quitchars, including NUL.
            if ([0, 27, 32, 10, 13].includes(code))
                return null;
            const helpRequested = code === game.commandBindings.specialKey('getdir.help');
            if (helpRequested || game.flags?.cmdassist !== false) {
                // cmd.c:4101 passes the typed key to help_dir() whenever the
                // caller prompt starts with '^', explicit help included.
                const assistPage = directionAssistPage(!helpRequested, ctrlCommandHint ? code : null);
                await showTextPages([assistPage], {
                    validKeys: [27, 32, 10, 13],
                });
                await restoreCommandMap();
            }
            else
                await pline('What a strange direction!');
            if (helpRequested)
                continue;
            return null;
        }
        if (!hero.dz)
            confusePromptDirection(hero);
        return { key: direction, dx: hero.dx, dy: hero.dy, dz: hero.dz };
    }
}
// Part of C getpos.c:getpos(): the mouse-click aiming prompt.
// C getdir's simulated click returns directly from getpos: it bypasses
// both the grid-bug movement restriction and confusion redirection.
async function promptClickDirection() {
    const bindings = game.commandBindings;
    const goal = `desired location, then type '${visibleCommandKey(bindings.specialKey('getpos.pick.quick') ?? 0)}' for left click, '${visibleCommandKey(bindings.specialKey('getpos.pick') ?? 0)}' for right`;
    const firstUse = shouldShowGetposTip();
    if (firstUse)
        await showGetposTip();
    await showGetposInstructions();
    if (firstUse)
        await pline(`Move cursor to ${goal}:`);
    const selected = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: game._pending_message || game._retained_message, goal,
    });
    const hero = game.u;
    if (!selected) {
        hero.dx = hero.dy = hero.dz = 0;
        if (game.iflags.getdir_click)
            game.iflags.getdir_click = 0;
        return null;
    }
    hero.dx = selected.x - hero.ux;
    hero.dy = selected.y - hero.uy;
    hero.dz = 0;
    if (game.iflags.getdir_click) {
        game.iflags.getdir_click = selected.pickType === LOOK_QUICK
            || selected.pickType === LOOK_ONCE ? CLICK_1 : CLICK_2;
    }
    else {
        hero.dx = Math.sign(hero.dx);
        hero.dy = Math.sign(hero.dy);
    }
    return { key: '_', dx: hero.dx, dy: hero.dy, dz: hero.dz };
}
// C cmd.c:confdir()
// C getdir() calls confdir(FALSE) even for self, but never for up/down.
export function confusePromptDirection(hero, forceImpairment = false) {
    const stunned = hero.stunned || (hero.stunnedTurns ?? 0) > 0;
    const confused = hero.confused || (hero.confusionTurns ?? 0) > 0;
    if (!forceImpairment && !stunned && !(confused && !rn2(5)))
        return;
    const count = hero.umonnum === GRID_BUG ? 4 : 8;
    const vector = impairedDirections[rn2(count)];
    if (!vector)
        throw new Error('The confused direction is outside the movement table');
    [hero.dx, hero.dy] = vector;
}
// Port only: release the topline after a dismissed overlay window.
export async function restoreCommandMap() {
    // The dismissed menu or text window already restored its covered rows.
    // Release its topline without another redraw or status update.
    game._pending_message = '';
    game._retained_message = '';
}
// Part of C cmd.c:help_dir(): the help-page projection; the caller owns its window and input.
// C help_dir(): use the current movement bindings and hide diagonals when
// the hero's body cannot use them. Explicit help omits the error heading.
// Also C cmd.c:show_direction_keys(): inlined here (the direction-key
// diagram, grid-bug form included).
export function directionAssistPage(invalidDirection = true, ctrlHintKey = null) {
    const bindings = game.commandBindings;
    const key = (direction) => visibleCommandKey(bindings.keyForDirection(direction) ?? 0);
    const lines = invalidDirection ? ['cmdassist: Invalid direction key!', ''] : [];
    if (ctrlHintKey !== null)
        lines.push(...controlKeyHintLines(ctrlHintKey));
    lines.push(`Valid direction keys${game.u.umonnum === GRID_BUG ? ' in your current form' : ''} are:`);
    if (game.u.umonnum === GRID_BUG) {
        lines.push(`             ${key(2)}   `, '             |   ', `          ${key(0)}- . -${key(4)}`, '             |   ', `             ${key(6)}   `);
    }
    else {
        lines.push(`          ${key(1)}  ${key(2)}  ${key(3)}`, '           \\ | / ', `          ${key(0)}- . -${key(4)}`, '           / | \\ ', `          ${key(7)}  ${key(6)}  ${key(5)}`);
    }
    const self = visibleCommandKey(bindings.specialKey(bindings.numberPad ? 'getdir.self2' : 'getdir.self') ?? 0);
    lines.push('', '          <  up', '          >  down', `       ${self.padStart(4)}  direct at yourself`);
    if (invalidDirection)
        lines.push('', '(Suppress this message with !cmdassist in config file.)');
    while (lines.length < 23)
        lines.push('');
    lines.push('--More--');
    return { lines, cursor: [8, 23] };
}
// C cmd.c:get_adjacent_loc() delegates input and command assistance to
// getdir(), then turns its relative result into a checked map location.
export async function getAdjacentLocation(prompt, errorMessage, x, y) {
    const direction = await promptDirection(`${prompt} `);
    if (!direction) {
        await pline('Never mind.');
        game.context.move = 0;
        return null;
    }
    const { dx, dy, dz } = direction;
    const target = { x: x + dx, y: y + dy, dx, dy, dz };
    if (target.x < 1 || target.x >= COLNO
        || target.y < 0 || target.y >= ROWNO) {
        if (errorMessage)
            await pline(errorMessage);
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
export async function yn_function(query, responses, defaultAnswer = '', addCommandQueue = true, { visibleChoices = responses?.split('\x1b')[0] ?? '', menuable = false } = {}) {
    // C cmd.c:yn_function(): one cmdq_pop() (cmd.c:5496) answers from the
    // queue — CQ_REPEAT during do-again, CQ_CANNED otherwise. A key
    // answers, the user-input placeholder asks live, and every other
    // entry keeps the ESC initializer while cmdq_clear(CQ_CANNED) drops
    // the remaining canned entries, so the question is never shown.
    const cmdq = addCommandQueue ? cmdq_pop() : null;
    let result;
    if (cmdq && cmdq.typ !== CMDQ_USER_INPUT) {
        if (cmdq.typ !== CMDQ_KEY)
            cmdq_clear(CQ_CANNED);
        const answer = cmdq.typ === CMDQ_KEY ? String.fromCharCode(cmdq.key) : '\x1b';
        result = { answer, count: game._ynNumber ?? 0n };
    }
    else {
        result = menuable && game.flags.query_menu && game.nhDisplay && responses !== null
            ? await queryResponseMenu(query, responses, defaultAnswer)
            : await tty_yn_function(query, responses, defaultAnswer, visibleChoices);
        // C cmd.c:5542-5543 records the live answer without checking
        // in_doagain, so an answer typed while a do-again replay is still
        // unwinding becomes the queued answer for the following question.
        if (addCommandQueue)
            cmdq_add_key(CQ_REPEAT, result.answer ? result.answer.charCodeAt(0) : 0);
    }
    if (!responses || !result.answer || result.answer === '\0' || responses.includes(result.answer))
        return result;
    const alternative = defaultAnswer || '\x1b';
    if (!game._inDoAgain || game.flags.debug)
        await reportInvalidYnAnswer(query, responses, defaultAnswer, result.answer, alternative);
    return { ...result, answer: alternative };
}
// C cmd.c:yn_function_menu()
// The preselected answer wins when the menu is
// cancelled; choosing another answer overrides it. This path keeps yn_number
// from the previous tty question because it never calls tty_yn_function().
// Also C cmd.c:yn_func_menu_opt(): inlined here (one menu entry per
// response letter, the default marked selected).
async function queryResponseMenu(query, responses, defaultAnswer) {
    const choices = responses === 'rl' ? [['r', 'Right'], ['l', 'Left']]
        : responses === 'hsq' ? [['h', 'Hide'], ['s', 'Spin a web'], ['q', 'Quit']]
            : [['y', 'Yes'], ['n', 'No']];
    if (responses === 'ynaq')
        choices.push(['a', 'All']);
    if (responses === 'ynq' || responses === 'ynaq')
        choices.push(['q', 'Quit']);
    const selected = await showChoiceWindow({ title: query, entries: choices.map(([key, text]) => ({
            key, text, marker: key === defaultAnswer ? '*' : '-',
        })) });
    const answer = selected === 0 || selected === 27 ? defaultAnswer : String.fromCharCode(selected);
    await pline(`${query} ${keyText(answer ? answer.charCodeAt(0) : 0)}`);
    clearMessageWindow();
    return { answer, count: game._ynNumber ?? 0n };
}
// Part of C cmd.c:yn_function(): the invalid-answer diagnostic.
async function reportInvalidYnAnswer(query, responses, defaultAnswer, answer, alternative) {
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
    }
    finally {
        if (previousMode === undefined)
            delete game.flags.debug_fuzzer;
        else
            game.flags.debug_fuzzer = previousMode;
        if (previousInputFuzzer === undefined)
            delete game.iflags.debug_fuzzer;
        else
            game.iflags.debug_fuzzer = previousInputFuzzer;
    }
}
// C cmd.c:paranoid_query()
// A per-question paranoia bit changes affirmative input from `y` to the full
// line `yes`.  PARANOID_CONFIRM additionally removes the default and requires
// `no` (or Escape) to reject, retrying other committed lines up to six times.
export async function paranoidQuery(beParanoid, prompt, paranoiaBits = game.flags?.paranoia_bits ?? 0) {
    return await paranoidYesNoQuit(beParanoid, prompt, false, paranoiaBits) === 'y';
}
// C cmd.c:paranoid_ynq(). Confirmation answers are deliberately excluded
// from command recall: every repeated dangerous action asks again.
export async function paranoidYesNoQuit(beParanoid, prompt, acceptQuit = true, paranoiaBits = game.flags?.paranoia_bits ?? 0) {
    if (!beParanoid)
        return acceptQuit
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
        const line = await getLine(`${prefix}${question} ${responseType}`, (_ch, key) => key >= 32 && key < 127);
        if (line === null)
            return acceptQuit ? 'q' : 'n';
        const answer = line.trim().replace(/\s+/g, ' ').toLowerCase();
        if (answer === 'yes')
            return 'y';
        if (answer === 'quit')
            return acceptQuit ? 'q' : 'n';
        if (!confirmAll || answer === 'no')
            return 'n';
        prefix = '"Yes" or "No": ';
    }
    return 'n';
}
// ── Key input (C cmd.c:readchar(), readchar_core(), readchar_poskey(),
//    pgetchar(), randomkey()) ────────────────────────────────────────────
// C cmd.c:pgetchar(): one unprompted character, without readchar()'s
// Escape-prefix or EOF translation and without a command-queue entry.
export async function pgetchar() {
    const key = game.iflags.debug_fuzzer
        ? await inputGate().readKey() : await nhgetch();
    return nativeChar(key);
}
// C cmd.c:readchar()
export async function readchar(inputState = 'other') {
    return (await readcharCore(inputState)).key;
}
// C cmd.c:readchar_poskey()
// C readchar_poskey(): only position selection receives the click coordinates.
// All readchar callers receive the same NUL character for a click.
export function readcharPoskey() {
    return readcharCore('position');
}
// C cmd.c:readchar_core(). Escape prefixes only have meaning in command,
// direction, and position input. Ordinary prompts keep a literal Escape.
// Also C cmd.c:click_to_cmd(): inlined here (store the click location and
// queue the mouse button's bound command).
async function readcharCore(inputState) {
    // Native fuzzer input skips the keyboard's NUL, EOF, and Escape decoding.
    if (game.iflags.debug_fuzzer)
        return { key: await inputGate().readKey(inputState), click: null };
    let key = await nh_poskey(inputState);
    if (key === MAP_CLICK_KEY) {
        // C readchar_core(): clicks record their location even when getpos
        // has temporarily cleared the mouse-button command bindings.
        const click = inputGate().takeMapClick();
        game._clicklookTarget = click ? { x: click.x, y: click.y } : null;
        const command = click ? game.commandBindings.mouseCommand(click.button) : null;
        if (command?.name) {
            // C readchar_core() calls click_to_cmd() for NUL input
            // (upstream cmd.c:5264: "click_to_cmd(*x, *y, *mod);").
            // click_to_cmd() queues the mouse button's bound command.
            cmdq_add_ec(CQ_CANNED, command.handler);
        }
        return { key: 0, click };
    }
    if (key === -1) {
        key = 27;
    }
    else if (key === 27 && game.iflags?.altmeta && inputState !== 'other') {
        // pgetchar() returns char, unlike the first nh_poskey() int.
        const next = nativeChar(await nhgetch(inputState));
        key = next === -1 || next === 0 || next === 27 ? 27 : next | 128;
    }
    return { key: nativeChar(key), click: null };
}
// Port only: normalize a key to the native signed/unsigned char model.
function nativeChar(key) {
    return NATIVE_COMMAND_PROFILE.signedChar ? (key << 24) >> 24 : key & 255;
}
// C cmd.c:randomkey(). Its function statics — the extcmdlist index and
// the repeat key — survive prompts; C keeps them for the whole process,
// while the port scopes them to one game: bindInputGate() and
// resetInputState() reset both, so every newly started game begins the
// table from its head.
let fuzzerCommandIndex = 0; /* static unsigned i: extcmdlist index */
let lastFuzzerCommand = 0; /* static char last_c: repeat key */
// C cmd.c:randomkey()
export function randomKey(inputState) {
    if (inputState === 'command' && (lastFuzzerCommand === 1 || lastFuzzerCommand === 16)
        && rn2(5))
        return lastFuzzerCommand;
    let key;
    switch (rn2(16)) {
        case 0:
            key = 10;
            break;
        case 1:
        case 2:
        case 3:
        case 4:
            key = rn1(95, 32);
            break;
        case 5:
            key = rn2(2) ? 9 : 32;
            break;
        case 6:
            key = rn1(26, 97);
            break;
        case 7:
            key = rn1(26, 65);
            break;
        case 8:
            key = NATIVE_COMMANDS[fuzzerCommandIndex++ % NATIVE_COMMANDS.length]?.key ?? 0;
            break;
        case 9:
            key = 35;
            break;
        case 10:
        case 11:
        case 12: {
            const direction = rn2(NATIVE_COMMAND_CONSTANTS.N_DIRS);
            const mode = rn2(7) ? 0 : !rn2(3) ? 2 : 1;
            key = game.commandBindings.keyForDirection(direction, mode);
            break;
        }
        case 13:
            key = rn1(10, 48);
            break;
        case 14:
            key = rnd(game.iflags.wc_eight_bit_input ? 255 : 127);
            break;
        default:
            key = 27;
            break;
    }
    key = nativeChar(key);
    if (inputState === 'command')
        lastFuzzerCommand = key;
    return key;
}
// Port only: reset the per-game fuzzer key statics.
// Reset by bindInputGate() (every game binds a freshly built gate, as
// jsmain's start() does) and by resetInputState().
export function resetFuzzerCommandState() {
    fuzzerCommandIndex = 0;
    lastFuzzerCommand = 0;
}
// ── Key help (C cmd.c:key2extcmddesc(), dokeylist(), help_dir()) ──────────
// C misc_keys[] supplies descriptions to both key help and the bindings list.
const miscellaneousKeys = [
    { name: 'escape', description: 'cancel current prompt or pending prefix', numberPadOnly: false },
    { name: 'count', description: 'Prefix: for digits when preceding a command with a count', numberPadOnly: true },
];
// C cmd.c:key2txt().
export function keyText(key) {
    return key === 32 ? '<space>' : key === 27 ? '<esc>'
        : key === 10 ? '<enter>' : key === 127 ? '<del>' : visibleCommandKey(key);
}
// C cmd.c:key2extcmddesc().
export function describeCommandKey(key) {
    const bindings = game.commandBindings;
    // key2extcmddesc() probes movecmd() in walk, rush, then run mode.
    // Each probe updates u.dz, even when the key is not a movement command.
    for (const mode of [0, 2, 1]) {
        const movement = bindings.movementForKey(key, mode);
        game.u.dz = movement?.dz ?? 0;
        if (!movement)
            continue;
        game.u.dx = movement.dx;
        game.u.dy = movement.dy;
        if (!movement.dz)
            break;
    }
    if (key >= 48 && key <= 57 && !bindings.numberPad)
        return 'start of, or continuation of, a count';
    if (bindings.numberPad) {
        if (key === 53 || key === 181)
            return `${bindings.pcHack !== (key === 181) ? 'run' : 'rush'} prefix`;
        if (key === 48 || bindings.pcHack && key === 176)
            return "synonym for 'i'";
    }
    for (const special of miscellaneousKeys) {
        if (special.numberPadOnly && !bindings.numberPad)
            continue;
        const code = special.name === 'escape' ? 27 : bindings.specialKey(special.name);
        if (key === code)
            return special.description;
    }
    const command = bindings.lookup(key)?.command;
    if (!command)
        return null;
    if (command.handler === 'do_reqmenu')
        return 'movement prefix: move without autopickup and without attacking\nnon-movement prefix: request menu or modify command (#reqmenu)';
    return commandDescription(command) + (command.name === '#' ? '' : ` (#${command.name})`);
}
// C cmd.c:help_dir(): after an invalid direction given to a caller whose
// prompt starts with '^', a letter key might have meant its control command.
export function controlKeyHintLines(key) {
    const isLetter = (key >= '@'.charCodeAt(0) && key <= 'Z'.charCodeAt(0))
        || (key >= 'a'.charCodeAt(0) && key <= 'z'.charCodeAt(0));
    if (!isLetter && key !== '['.charCodeAt(0))
        return [];
    const sym = String.fromCharCode(key).toUpperCase();
    const ctrl = sym.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    const explain = describeCommandKey(ctrl);
    const wizardOnly = 'EFGIVW'.includes(sym);
    if (explain === null || (wizardOnly && !game.flags.debug))
        return [];
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
// Also C cmd.c:show_direction_keys(): inlined here (the direction-key
// diagram at the top of the list).
// Also C cmd.c:spkey_name(): inlined here (the "[name]" labels of keyless
// special keys use the spkeys_binds names).
export async function showKeyBindings() {
    const bindings = game.commandBindings;
    const used = new Set([3]); // SIGINT is reserved even if a key is rebound.
    const lines = ['', '            Full Current Key Bindings List',
        '        (also commands with no key assignment)', '', 'Directional keys:'];
    const key = (direction) => visibleCommandKey(bindings.keyForDirection(direction));
    lines.push(`          ${key(1)}  ${key(2)}  ${key(3)}`, '           \\ | / ', `          ${key(0)}- . -${key(4)}`, '           / | \\ ', `          ${key(7)}  ${key(6)}  ${key(5)}`, '');
    if (!bindings.numberPad)
        lines.push('Ctrl+<direction> will run in specified direction until something very', '        interesting is seen.');
    lines.push(`${bindings.numberPad ? 'Meta' : 'Shift'}+<direction> will run in specified direction until you encounter`, '        an obstacle.', '', 'Miscellaneous keys:');
    const keyless = [];
    for (const special of miscellaneousKeys) {
        if (special.numberPadOnly && !bindings.numberPad)
            continue;
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
    const categories = [
        ['General commands:', command => !!(command.flags & NATIVE_COMMAND_FLAGS.GENERALCMD) && !(command.flags & ignored)],
        ['Game commands:', command => !(command.flags & (NATIVE_COMMAND_FLAGS.GENERALCMD | ignored))],
        ['Debug mode commands:', command => !!game.flags.debug
                && !!(command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD) && !(command.flags & NATIVE_COMMAND_FLAGS.INTERNALCMD)],
    ];
    for (const [heading, include] of categories) {
        const commands = NATIVE_COMMANDS.filter(command => command.name !== null && include(command));
        if (!commands.length)
            continue;
        lines.push('', heading);
        const previouslyUsed = new Set(used);
        for (let code = 0; code < 256; code++) {
            if (used.has(code) || code === 32 && !game.flags.rest_on_space)
                continue;
            const binding = bindings.lookup(code);
            if (!binding?.command || !include(binding.command))
                continue;
            lines.push(`${keyText(code).padEnd(7)} ${(binding.command.name ?? '').padEnd(13)} ${commandDescription(binding.command)}${binding.parameter === null ? '' : ` "${binding.parameter}"`}`);
            used.add(code);
        }
        for (const command of commands) {
            if (bindings.bindings.some(binding => !previouslyUsed.has(binding.key) && binding.command === command))
                continue;
            lines.push(`#${(command.name ?? '').padEnd(20)} ${commandDescription(command)}`);
        }
    }
    await showTextWindow(lines);
    await restoreCommandMap();
    game.context.move = 0;
}
// Player-facing descriptions from pinned cmd.c:extcmdlist.
export const COMMAND_DESCRIPTIONS = new Map([
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
//# sourceMappingURL=cmd.js.map