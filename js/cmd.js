import { selectContextMenu } from './context_menu.js';
import { doapply, dorub, dojump } from './apply.js';
import { doname } from './do_name.js';
import { doannotate, doDungeonOverview } from './dungeon.js';
import { dochat } from './ambient_sounds.js';
import { doloot } from './pickup.js';
import { doinvoke } from './artifact_invoke.js';
import { doChronicle, doGenocided, doVanquished } from './insight.js';
import { doturn } from './pray.js';
import { dipInto, dodip } from './potion_dip.js';
import { doclose, doopen } from './lock.js';
import { moveIntoFailedUntrap } from './untrap.js';
import { askTeleportDestination, teleportAtWillCommand } from './teleport.js';
import { adjustSplit, doadjust, doPermanentInventory } from './invent.js';
import { CLICK_1, CLICK_2, xdir, ydir } from './const.js';
import { queueCommandResponses } from './input.js';
import { setHeroGrip } from './hero_grip.js';
import { continuePicking } from './lock_pick.js';
import { resetOccupations } from './occupation_reset.js';
import { ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME, PARANOID_QUIT } from './const.js';
import { STAIRS, THRONE } from './const.js';
import { wizIntrinsic } from './wizard_intrinsics.js';
import { wizTimeoutQueue } from './timeout_queue.js';
import { wizFuzzer, wizPanic } from './wizard_debug_commands.js';
import { wizDetect, wizGenesis, wizIdentify, wizKill, wizLevelChange, wizLevelTeleport, wizMap, wizPolyself, wizShowNhuuid, wizTelekinesis, wizWhere, wizWish, } from './wizcmds.js';
import { wizSmell } from './wizard_smell.js';
import { showSeenVectors, showVisionFlags, showWallModes } from './wizard_map_inspection.js';
import { wizRumorCheck } from './wizard_rumor_check.js';
import { wizCustom } from './wizard_custom.js';
import { wizBury } from './wizard_bury.js';
import { wizMigrateMonsters } from './wizard_migration.js';
import { wizFlipLevel } from './wizard_flip_level.js';
import { wizMakeMap } from './wizard_makemap.js';
import { wizardTeleportCommand } from './wizard_teleport.js';
import { continueSpellbookStudy } from './spellbook_study.js';
import { quaff } from './quaff.js';
import { clearMessageWindow } from './tty_topline.js';
// cmd.js — Command parsing and dispatch.
// C ref: cmd.c:rhack(); movement execution belongs to hack.ts.
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { ESCAPED } from './const.js';
import { VIBRATING_SQUARE } from './const.js';
import { surfaceName } from './terrain_name.js';
import { doFarlook, dohelp, dowhatis } from './pager.js';
import { lookatDescription } from './pager_description.js';
import { identifyTrap } from './pager_traps.js';
import { GETOBJ_SUGGEST } from './const.js';
import { monsterName } from './monster_name.js';
import { attackHostileMonster } from './hero_melee.js';
import { monsterAtPosition } from './monster_location.js';
import { observeBucForNaming } from './object_knowledge.js';
import { descendFromLevitation } from './levitation_commands.js';
import { beginCommandResult, clearCannedCommands, commandResultCancelled, commandResultFailed, endVoluntaryMultiTurn, resetCommandVariables, setMulti } from './command_state.js';
import { propertyIsActive } from './properties.js';
import { pickupAtHero } from './pickup.js';
import { gotoLevel } from './level_change.js';
import { dopay } from './shop_pay_command.js';
import { inventoryReport } from './inventory_reports.js';
import { isContainer } from './container.js';
import { tipCommand } from './container_tip.js';
import { dolookaround } from './lookaround.js';
import { doOptions, toggleBooleanOptionPrefix } from './options.js';
import { TRAVEL_DIRECTIONS, heroTestMove, applyHeroLiquidEffects, domove } from './hack.js';
import { commandExecutionKey, controlRushDirection, visibleCommandKey } from './command_keys.js';
import { NATIVE_COMMAND_FLAGS, NATIVE_COMMANDS } from './command_data.js';
import { stopHeroOccupation } from './occupation.js';
import { continueBulkTakeoff, takeOffAll } from './bulk_takeoff.js';
import { resetBulkTakeoff } from './takeoff_state.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { clearCommandKeys, nhgetch, queueCommandKeys, takeCommandResponse } from './input.js';
import { readCommandInput } from './command_input.js';
import { clearRepeatCommand, rememberCommand, takeRepeatCommand } from './command_repeat.js';
import { terrainCommand } from './terrain_view.js';
import { autoDescribePosition, selectTravelMenuPosition } from './getpos.js';
import { whatDoesCommand } from './command_help.js';
import { availableExtendedCommands, completeExtendedCommand, extendedCommandMenu, showExtendedCommandList } from './extended_commands.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { promptDirection } from './tty_prompts.js';
export { getLine, promptYesNo, promptYesNoQuit } from './query.js';
import { paranoidQuery, promptYesNo } from './query.js';
import { flush_screen, docrt } from './display.js';
import { pline, plineWithContinuation, setTopline } from './pline.js';
import { doprevMessage, messageWindowMode } from './prevmsg.js';
import { dozap, } from './zap.js';
import { bucAdjectiveForName, ddoinv, dolook } from './invent.js';
import { docast, dovspell, dowizcast } from './spell.js';
import { heroBreathAttack } from './hero_breath.js';
import { useHeroBreath } from './hero_breath_command.js';
import { monsterBreathAttack } from './dogmove.js';
import { heroSpitAttack, useHeroSpit } from './hero_spit.js';
import { heroGazeAttack, useHeroGaze } from './hero_gaze.js';
import { heroCanSplitLikeGremlin, useHeroGremlinSplit, } from './hero_gremlin.js';
import { heroCanShriek, useHeroShriek } from './hero_shriek.js';
import { heroCanSummonWerePack, useHeroWereSummon, } from './were.js';
import { heroHasHidingAbility, useHeroHide } from './hero_hide.js';
import { chooseSpiderAbility, heroCanSpinWeb, useHeroWeb, } from './hero_web.js';
import { heroCanMindBlast, useHeroMindBlast, } from './hero_mind_blast.js';
import { heroCanRemovePunishment, useHeroNymphAbility, } from './hero_nymph_ability.js';
import { heroCanUseUnicornHorn, useUnicornHorn, } from './unicorn_horn.js';
import { useHeroVampireShift } from './vampire_shift.js';
import { doread } from './read.js';
import { continueFoodMeal, doeat } from './eat.js';
import { continueTinOpening } from './tin.js';
import { doclassdisco, dodiscovered } from './o_init.js';
import { doattributes, doconduct } from './insight.js';
import { displayHelpFile } from './pager_help.js';
import { doextversion, NATIVE_VERSION } from './extversion.js';
import { dosearch } from './detect.js';
import { continueWipingFace, donull, dowipe, threateningMonsterNearby, } from './do.js';
import { objectQuantity } from './object_stack.js';
import { dropHeroObject } from './hero_drop.js';
import { dropMultipleObjects } from './drop_menu.js';
import { SELL_DELIBERATE, SELL_NORMAL, setSellDisposition } from './shop_sell.js';
import { setSecondaryWeapon } from './weapon_slots.js';
import { LOCK_PICK, CREDIT_CARD, SADDLE, POT_OIL, SKELETON_KEY } from './object_data.js';
import { NO_COLOR } from './terminal.js';
import { MONSTER_MOVE, MONSTER_NAME, monsterDigests, monsterSpeciesHidesOnCeiling } from './monster_data.js';
import { heroFormSticks } from './hero_species.js';
import { autopickupAtHero } from './pickup.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { dosave } from './save.js';
import { arriveTravel, captureRunmodeDelay, startRun, startWalkRepeat, stopRun } from './runmode.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { doride, stuckSteed } from './steed.js';
import { continueForceLock, doforce } from './lock.js';
import { doUntrap } from './untrap.js';
import { dosit } from './sit.js';
import { continueEngraving, doengrave } from './engrave_command.js';
import { climbOutOfPit, triggerHeroTrapAt } from './hero_traps.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { ledgerNo } from './hacklib.js';
import { nearCapacity, SLT_ENCUMBER } from './weight.js';
import { dopray } from './pray.js';
import { dosacrifice } from './sacrifice.js';
import { finishTeleportArrival } from './location_effects.js';
import { doborn, doquit, finishHeroDeath } from './end.js';
import { heroIsPolymorphed, heroCanChangeVampireShape } from './polyself.js';
import { continueTrapSetting } from './trap_setting.js';
import { isPick } from './weapon_type.js';
import { applyPickAxeDirection } from './pick_axe.js';
import { continueHeroDigging } from './hero_digging.js';
import { dowear, doputon, removeWornItem } from './do_wear.js';
import { doready, doswapweapon, dotwoweapon, dowield } from './wield.js';
import { dofire, dothrow } from './dothrow.js';
import { doenhance, } from './skills.js';
import { objectTypeKnown } from './shk.js';
import { showGetposTip, showGetposInstructions, selectMapPosition } from './getpos.js';
import { performPetRangedAttack } from './dogmove.js';
import { dokick } from './dokick.js';
import { bringLeashedFollowers } from './teleport.js';
import { COLNO, ROWNO, SCORR, DOOR, FOUNTAIN, SINK, D_CLOSED, D_LOCKED, PIT, SPIKED_PIT, TT_PIT, HOLE, TRAPDOOR, Is_airlevel, Is_waterlevel, Is_valley, W_ARMOR, W_ACCESSORY, isok } from './const.js';
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };
function isMovementKey(ch) {
    return ch.length === 1 && 'hjklyubn'.includes(ch);
}
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
// C cmd.c:dotravel_target() initializes travel before calling domove().
function startTravel(targetX, targetY, g = game) {
    g._runState = {
        mode: 8,
        targetX,
        targetY,
    };
    g.lastStrTurn = 0;
    g._travelTarget = { x: targetX, y: targetY };
    if (!g.multi)
        g.multi = Math.max(COLNO, ROWNO);
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
function prepareTimedCommand(binding) {
    const text = binding.command?.occupation;
    if (text && !game._occupation && game.multi) {
        game._occupation = { key: 'command', text, binding };
    }
}
async function redrawCommand() {
    await docrt();
    game.context.move = 0;
}
async function performWaitCommand(force = game.iflags.menu_requested) {
    if (!await donull(force, !!game.multi))
        return;
    game.context.move = 1;
}
// C cmd.c:can_do_extcmd(). Admission precedes prefixes and handler setup.
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
        const repeated = takeRepeatCommand();
        // C rhack() consumes unused answers as command keys before parse().
        // A non-key response at this boundary cancels the remaining queue.
        const response = game._inDoAgain ? undefined : takeCommandResponse();
        let cannedCommand = game._inDoAgain || response !== undefined
            ? null : game._cannedCommands?.shift() ?? null;
        if (response !== undefined)
            key = typeof response === 'number' ? response : 0;
        if (key === 0 && !cannedCommand && !repeated && response === undefined) {
            key = (await readCommandInput()).key;
            delete game._cursorOverride;
            // C parse() returns NUL after a click queues its mouse command.
            if (key === 0)
                cannedCommand = game._cannedCommands?.shift() ?? null;
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
            }
            else {
                const vertical = command.handler === 'doup' || command.handler === 'dodown';
                await pline(`The '${which}' prefix should be followed by a movement command${vertical ? ' other than up or down' : ''}.`);
            }
            resetCommandVariables(true);
            return;
        }
        let binding = { ...configured, command,
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
                if (lastExecuted)
                    rememberCommand({
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
        if (!selected)
            throw new Error('Command dispatch lost its selected command');
        if (selected.handler === 'do_repeat') {
            await repeatLastCommand();
            // The outer rhack() dispatches do_repeat, not dokick.
            if (game.context.move)
                game._kickedLoc = null;
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
        await executeCommandAction(binding, { cannedCommand });
        return;
    }
}
function cannedCommandDefinition(queued) {
    let name;
    switch (queued.kind) {
        case 'inventory-action': return inventoryActionCommand(queued.action);
        case 'context-menu':
            name = contextMenuCommand(queued.selection);
            break;
        case 'command':
            name = queued.name;
            break;
        case 'swap-weapon':
            name = 'swap';
            break;
        case 'rub':
        case 'apply':
        case 'wield':
        case 'kick':
        case 'reqmenu':
        case 'fire':
            name = queued.kind;
            break;
    }
    return NATIVE_COMMANDS.find(command => command.name === name) ?? null;
}
// C cmd.c:do_repeat(). Preserve the saved queue even when its execution
// cancels, so another repeat makes the same attempt in the new context.
async function repeatLastCommand() {
    if (game._inDoAgain)
        return;
    const saved = [...(game._repeatCommands ?? [])];
    if (!saved.length) {
        await plineWithContinuation('There is no command available to repeat.', { noRepeat: true });
        resetCommandVariables(true);
        return;
    }
    game._inDoAgain = true;
    try {
        await rhack(0);
    }
    finally {
        game._inDoAgain = false;
        game._repeatCommands = saved;
        game.iflags.menu_requested = false;
    }
}
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
// C cmd.c:rhack() clears kickedloc after an elapsed non-kick action.
// doextcmd's selected action, not the outer # editor, owns that result.
async function executeCommandAction(binding, options = {}) {
    beginCommandResult();
    await runCommandHandler(binding, options);
    if (game.program_state.gameover)
        return;
    // C cmd.c:rhack() result seam (3810-3826): ECMD_CANCEL and ECMD_FAIL
    // reset both command queues, a time-taking result keeps them, and an
    // ECMD_OK result resets them only under an involuntary delay. C's
    // moveloop presets context.move before rhack(); JS handlers set it, so
    // the TIME precedence over a cancellation reads the recorded result
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
    if (game.context.move
        && binding.command?.handler !== 'dokick'
        && binding.command?.handler !== 'doextcmd') {
        game._kickedLoc = null;
    }
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
// Admission belongs to the caller. Keep the selected binding, including its
// parameter, rather than looking up a possibly rebound key inside the action.
async function runCommandHandler(binding, { cannedCommand = null, } = {}) {
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
        }
        finally {
            clearCommandKeys();
        }
        return;
    }
    if (cannedCommand?.kind === 'kick') {
        queueCommandResponses([{ dx: cannedCommand.dx, dy: cannedCommand.dy, dz: 0 }]);
        try {
            await dokick();
        }
        finally {
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
        if (game.flags.debug)
            await wizardTeleportCommand(teleportAtWillCommand);
        else
            await teleportAtWillCommand(false);
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
        await pickupAtHero();
    }
    else if (ch === '>') {
        await travelStairs(false);
    }
    else if (ch === '<') {
        await travelStairs(true);
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
        await doFarlook();
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
        await doTerrainOverview();
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
function enqueueInventoryAction(action) {
    if (!action || ['\x1b', ' ', '\n', '\r'].includes(action.key))
        return;
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
    if (result.cancelled)
        commandResultCancelled(); // potion.c:dodrink() ECMD_CANCEL.
    game.context.move = result.spentTime && !result.heroDied ? 1 : 0;
}
async function readCommand() {
    const result = await doread();
    if (result.cancelled)
        commandResultCancelled(); // read.c:doread() ECMD_CANCEL.
}
// C do.c:u_stuck_cannot_go(). A sticky hero releases its captive, while
// being held or swallowed prevents even an attempt to use the floor below.
async function monsterPreventsStairTravel(up) {
    const holder = game.u.ustuck;
    if (!holder)
        return false;
    if (game.u.uswallow || !heroFormSticks(game)) {
        const condition = !game.u.uswallow ? 'being held'
            : monsterDigests(holder) ? 'swallowed' : 'engulfed';
        await plineWithContinuation(`You are ${condition}, and cannot go ${up ? 'up' : 'down'}.`);
        game.context.move = 1;
        return true;
    }
    setHeroGrip(null);
    await plineWithContinuation(`You release ${monsterName(holder)}.`);
    return false;
}
export async function travelStairs(up) {
    const level = requireGameLevel();
    requireInitializedHero(game.u);
    // C do.c doup()/dodown() start with set_move_cmd(): the menu prefix's
    // no-pickup request and the cleared travel state outlive a refusal.
    game.u.dx = game.u.dy = 0;
    game.u.dz = up ? -1 : 1;
    if (game.iflags.menu_requested)
        game.context.nopick = true;
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
            if (game.u.flying)
                await plineWithContinuation('You fly out of hiding.');
            else {
                await plineWithContinuation(`You drop to the ${surfaceName(game.u.ux, game.u.uy)}.`);
                if (isPoolAt(game.u.ux, game.u.uy) || isLavaAt(game.u.ux, game.u.uy)) {
                    await applyHeroLiquidEffects();
                }
                else {
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
        if (await monsterPreventsStairTravel(false))
            return false;
    }
    let stairs = game.stairs;
    while (stairs && (stairs.sx !== game.u.ux || stairs.sy !== game.u.uy))
        stairs = stairs.next;
    if (!stairs || stairs.up !== up) {
        const pit = !up && level.traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) && trap.tseen
            && !(game.u.utrap && game.u.utraptype === TT_PIT));
        if (pit) {
            await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            game.context.move = 1;
            return true;
        }
        const hole = !up && level.traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) && trap.tseen);
        if (hole) {
            const result = await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            if (result.died)
                return false;
            game.context.move = 1;
            return true;
        }
        const pick = game.uwep || game.u.uwep;
        if (!up && game.flags.autodig && !game.context.nopick && pick && isPick(pick)) {
            const result = await applyPickAxeDirection(pick, {
                state: game,
                attackMonster: (target, struckAt) => attackHostileMonster(target, struckAt.x, struckAt.y),
                payShopkeeper: dopay,
            });
            game.context.move = result.spentTime ? 1 : 0;
            return result.spentTime;
        }
        const vibratingSquare = !up && level.traps.some(trap => trap.tx === game.u.ux && trap.ty === game.u.uy && trap.ttyp === VIBRATING_SQUARE);
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
    if (up && await monsterPreventsStairTravel(true))
        return false;
    if (up && nearCapacity(game) > SLT_ENCUMBER) {
        await plineWithContinuation(`Your load is too heavy to climb the ${level.requireAt(game.u.ux, game.u.uy).typ === STAIRS ? 'stairs' : 'ladder'}.`);
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
    if (changed !== false)
        game.context.move = 1;
    return changed !== false;
}
async function doTerrainOverview() {
    await terrainCommand();
}
async function doherecmdmenu() {
    enqueueContextMenu(await selectContextMenu(game.u.ux, game.u.uy, CLICK_1));
}
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
function enqueueContextMenu(selection) {
    game.context.move = 0;
    if (!selection)
        return;
    // act_on_act() sets this before dotherecmdmenu() clears a mouse target.
    if (selection.action === 'look-at')
        game._clicklookTarget = { x: selection.x, y: selection.y };
    game._cannedCommands ??= [];
    if (selection.action === 'remove-saddle')
        game._cannedCommands.push({ kind: 'reqmenu' });
    game._cannedCommands.push({ kind: 'context-menu', selection });
}
// C cmd.c:doclicklook() retains the clicked location for later commands.
async function doclicklook() {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y))
        await autoDescribePosition(target.x, target.y);
}
async function domouseaction() {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y))
        mouseAction(target);
}
// C cmd.c:domouseaction(), the optional mouse binding which chooses an action.
function mouseAction(click) {
    requirePlayingGame(game);
    let dx = click.x - game.u.ux, dy = click.y - game.u.uy;
    const queue = (name) => {
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
            if (location?.typ === FOUNTAIN || location?.typ === SINK)
                queue('quaff');
            else if (location?.typ === THRONE)
                queue('sit');
            else {
                let stair = game.stairs;
                while (stair && (stair.sx !== click.x || stair.sy !== click.y))
                    stair = stair.next;
                const object = game.level?.objects[click.x]?.[click.y]?.[0];
                if (stair)
                    queue(stair.up ? 'up' : 'down');
                else
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
function contextMenuResponses(selection) {
    const dx = Math.sign(selection.x - game.u.ux), dy = Math.sign(selection.y - game.u.uy);
    const direction = { dx, dy, dz: 0 };
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
            queueCommandResponses([direction]);
            return;
        case 'lock': {
            const tool = [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]
                .map(type => game.inventory.find(object => object.otyp === type)).find(object => object);
            if (tool?.invlet)
                queueCommandResponses([tool.invlet.charCodeAt(0), direction, yes]);
            return;
        }
        case 'remove-saddle':
            queueCommandResponses([direction, yes]);
            return;
        case 'saddle': {
            const saddle = game.inventory.find(object => object.otyp === SADDLE);
            if (saddle?.invlet)
                queueCommandResponses([saddle.invlet.charCodeAt(0), direction]);
            return;
        }
        case 'name':
            queueCommandResponses(['m'.charCodeAt(0), direction]);
            return;
        case 'quaff':
        case 'tip':
        case 'eat':
            queueCommandResponses([yes]);
            return;
        case 'dip':
            queueCommandResponses(['user-input', yes]);
            return;
        case 'throw':
            // act_on_act() retains the raw offset for throwing.
            queueCommandResponses(['user-input', {
                    dx: selection.x - game.u.ux, dy: selection.y - game.u.uy, dz: 0,
                }]);
            return;
        case 'offer':
            queueCommandResponses(['user-input']);
            return;
        case 'untrap-here':
            queueCommandResponses([{ dx: 0, dy: 0, dz: 1 }]);
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
// windows.c:getlin() frees only the popped command entry, so any key or
// direction C queued behind it stays queued for the next pop. Several
// canned kinds bundle that tail inside one JS entry (dothrow.c:575-576,
// dig.c:1104-1105, apply.c:1808-1809, 2966-2967, 3442-3443, 3745-3746 and
// the cmd.c act_on_act() chains): restore it onto the response queue. The
// drain only drops a canned entry after the response queue emptied, so
// appending preserves the C order — tail first, then the remaining
// canned commands.
export function restoreCannedCommandTail(canned) {
    if (canned.kind === 'rub' || canned.kind === 'apply' || canned.kind === 'wield') {
        queueCommandResponses([canned.invlet.charCodeAt(0)]);
    }
    else if (canned.kind === 'kick') {
        queueCommandResponses([{ dx: canned.dx, dy: canned.dy, dz: 0 }]);
    }
    else if (canned.kind === 'context-menu') {
        contextMenuResponses(canned.selection);
    }
}
// C iactions.c:itemactions_pushkeys(). The menu closes before the queued
// command runs; its object letter answers the later inventory prompt.
function inventoryActionCommand({ key, item }) {
    const handlers = {
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
async function executeInventoryAction({ key, item }) {
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
            }
            else if (item === game.uswapwep) {
                resetBulkTakeoff();
                const twoweap = game.u.twoweap;
                await setSecondaryWeapon(null, game);
                await plineWithContinuation(twoweap ? 'You are no longer wielding two weapons at once.'
                    : 'You no longer have a second weapon readied.');
                game.context.move = 1;
            }
            else if (item === game.uquiver) {
                queueCommandKeys('-');
                await doready();
            }
            return;
        case 'a':
            queueCommandKeys(letter);
            if (item.oclass === 8 && !(item.otyp === POT_OIL && objectTypeKnown(item)))
                await dipInto();
            else
                await doapply();
            return;
        case 'c':
            queueCommandKeys(`i${letter}`);
            await doname();
            return;
        case 'C':
            queueCommandKeys(`o${letter}`);
            await doname();
            return;
        case 'd':
            queueCommandKeys(letter);
            await dodrop();
            return;
        case 'e':
            queueCommandKeys(letter);
            await doeat();
            return;
        case 'E':
            queueCommandKeys(letter);
            await doengrave();
            return;
        case 'f':
            await dofire();
            return;
        case 'i':
            queueCommandKeys(letter);
            await doadjust();
            return;
        case 'I':
            queueCommandKeys(letter);
            await adjustSplit();
            return;
        case 'O':
            queueCommandKeys(letter);
            await dosacrifice();
            return;
        case 'p':
            queueCommandKeys(letter);
            await dopay();
            return;
        case 'P':
        case 'W':
            queueCommandKeys(letter);
            await dowear();
            return;
        case 'q':
            queueCommandKeys(letter);
            await doquaff();
            return;
        case 'Q':
            queueCommandKeys(letter);
            await doready();
            return;
        case 'r':
            queueCommandKeys(letter);
            await readCommand();
            return;
        case 'R':
            queueCommandKeys(letter);
            if ((item.owornmask ?? 0) & W_ACCESSORY)
                await removeWornItem('take off', true);
            else
                await dorub();
            return;
        case 'T':
            queueCommandKeys(letter);
            if ((item.owornmask ?? 0) & W_ARMOR)
                await removeWornItem('take off', true);
            else
                await tipCommand();
            return;
        case 't':
            queueCommandKeys(letter);
            await dothrow();
            return;
        case 'w':
            queueCommandKeys(letter);
            await dowield();
            return;
        case 'V':
            queueCommandKeys(letter);
            await doinvoke();
            return;
        case 'x':
            await doswapweapon();
            return;
        case 'X':
            await dotwoweapon();
            return;
        case 'z':
            queueCommandKeys(letter);
            await dozap();
            return;
        case '/':
            queueCommandKeys(`i${letter}`);
            await dowhatis();
            return;
        case '\x1b':
        case ' ':
        case '\n':
        case '\r':
            game.context.move = 0;
            return;
    }
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
const EXTENDED_COMMAND_HANDLERS = new Map([
    ['?', showExtendedCommandList],
    ['whatdoes', whatDoesCommand],
    ['whatis', dowhatis],
    ['help', dohelp],
    ['glance', doFarlook],
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
async function useSteedBreathAbility(steed) {
    requirePlayingGame(game);
    const result = await performPetRangedAttack(steed, game, { forced: true });
    if (result.heroDied || game.program_state.gameover)
        return;
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
// TTY's extended-command line editor redraws the prompt at every input
// boundary. Completion expands visually while typed input advances the cursor.
async function editExtendedCommand() {
    let command = '';
    let completion = null;
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
                if (!doprev)
                    await doprevMessage(false);
                await doprevMessage(false);
                doprev = true;
            }
            else {
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
        if (key === 10 || key === 13)
            break;
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
        if (key < 32 || key === 127 || command.length >= COLNO)
            continue;
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
    if (!selected)
        await pline(`${initiator}${normalizedCommand.slice(0, 60)}: unknown extended command.`);
    return selected ?? null;
}
// C refs: cmd.c dotravel(), getpos.c getpos(), hack.c handle_tip(), and
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
    const state = startTravel(target.x, target.y);
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
    const arrived = game.u.ux === state.targetX && game.u.uy === state.targetY;
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
async function doversion() {
    if (game.iflags.menu_requested)
        await doextversion();
    else
        await pline(NATIVE_VERSION);
    game.context.move = 0;
}
function droppedObjectDescription(object) {
    const quantity = objectQuantity(object);
    // C do.c:drop() delegates to objnam.c:doname(), which keeps beatitude
    // and enchantment knowledge independent.  Merely carrying (or wishing
    // for) an object does not authorize either adjective.  xname_flags()
    // also applies implicit_uncursed after any Priest BUC observation.
    observeBucForNaming(object);
    const buc = bucAdjectiveForName(object) || '';
    const enchantment = object.known && [2, 3].includes(object.oclass)
        ? (typeof object.enchantment === 'number' && Number.isInteger(object.enchantment)
            ? object.enchantment
            : Number.isInteger(object.spe) ? object.spe : null)
        : null;
    const bonus = enchantment === null ? ''
        : `${enchantment >= 0 ? '+' : ''}${enchantment}`;
    const name = quantity > 1 ? object.plural || `${object.name}s` : object.name;
    const core = [buc, bonus, name].filter(Boolean).join(' ');
    return quantity > 1 ? `${quantity} ${core}`
        : withIndefiniteArticle(core);
}
async function dodrop() {
    const inShop = !!game.u?.ushops?.[0];
    if (inShop)
        setSellDisposition(SELL_DELIBERATE);
    try {
        // C do.c:dodrop(): getobj("drop", any_obj_ok, PROMPT | ALLOWCNT).
        // A cursed loadstone keeps the requested count for canletgo().
        const object = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { forcePrompt: true, allowCount: true });
        if (!object) {
            commandResultCancelled(); // do.c:dodrop() getobj ECMD_CANCEL.
            // dodrop() resets occupations for every nonzero result,
            // cancelled prompts included.
            resetOccupations();
            return;
        }
        const spentTime = await dropHeroObject(object, {
            state: game, publish: plineWithContinuation,
        });
        if (!spentTime) {
            // do.c:drop() returns ECMD_FAIL for every refusal.
            commandResultFailed();
            resetOccupations();
            return;
        }
        game.context.move = 1;
        resetOccupations();
        if (game._occupation?.key === 'pick-lock')
            game._occupation = null;
    }
    finally {
        if (inShop)
            setSellDisposition(SELL_NORMAL);
    }
}
//# sourceMappingURL=cmd.js.map