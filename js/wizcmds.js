// Wizard-mode commands.
// C refs: wizcmds.c wiz_wish()/wiz_polyself()/wiz_genesis()/wiz_detect()/
// wiz_kill()/wiz_telekinesis()/wiz_where()/wiz_level_tele()/wiz_level_change()/
// wiz_map()/wiz_identify()/wiz_show_nhuuid().
import { A_WIS, DIED, In_endgame, Invocation_lev, Is_airlevel, Is_earthlevel, Is_firelevel, Is_knox_level, Is_waterlevel, KILLED_BY, MAGIC_PORTAL, MENU_ITEMFLAGS_SKIPINVERT, MENU_ITEMFLAGS_SKIPMENUCOLORS, MGIVENNAME, NHW_MENU, PICK_ANY, POLY_CONTROLLED, } from './const.js';
import { AD_PHYS } from './monster_attack_types.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { ATR_INVERSE, addMenuHeading, showDisclosureOverlay, showPagedPickOneMenu, showTextMenuOverlay } from './windows.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from './tty_menu.js';
import { bot, canSpotMonster, consumeHallucinatedMenuObjectGlyph, docrt, map_engraving, map_trap, unmap_invisible, } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { getLine, paranoidQuery, promptYesNoQuit } from './query.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { visibleCommandKey } from './command_keys.js';
import { inventoryCommandLetter } from './invent.js';
import { askTeleportDestination } from './teleport.js';
import { selectMapPosition, showGetposTip } from './getpos.js';
import { setMulti } from './command_state.js';
import { makeWish } from './wish.js';
import { polymorphHero } from './polyself.js';
import { createParticularMonster } from './read_creation.js';
import { findit } from './detect.js';
import { monsterAtPosition, monsterHasMapPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { monsterIsNonliving } from './monster_data.js';
import { finishMonsterKilled, finishMonsterLiquidDeath } from './monster_death.js';
import { finishHeroDeath } from './end.js';
import { finishHeroMonsterKill, finishHeroMonsterKillOutcome, finishHurtleMonsterDeath, } from './hero_monster_death.js';
import { hurtleHero } from './hero_hurtle.js';
import { hurtleMonster } from './monster_hurtle.js';
import { finishTeleportArrival } from './location_effects.js';
import { gotoLevel } from './level_change.js';
import { levelTeleport } from './level_teleport.js';
import { loseHeroExperience, gainExperienceLevel } from './exper.js';
import { exerciseAttribute } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { withMonsterNoticesBlocked } from './monster_notices.js';
import { mapMagicLevel } from './magic_mapping.js';
import { dungeonDepth } from './hacklib.js';
import { specialDisplayName } from './dungeon.js';
import { addInventoryItem } from './u_init.js';
import { mksobj } from './mkobj.js';
import { AMULET_OF_YENDOR } from './object_data.js';
import { recordObjectEncounter, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { fullyIdentifyObject, identifyPack, inventoryItemDescription, inventoryPrimaryHandDetail, objectNeedsFullIdentification, } from './invent.js';
import { reassignInventoryLetters } from './inventory_prompt.js';
import { observeObjectForNaming } from './objnam.js';
import { inventorySortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { objectTypeKnown } from './shk.js';
// C wizcmds.c:wiz_wish().
export async function wizWish() {
    const verbose = game.flags.verbose;
    game.flags.verbose = false;
    try {
        await makeWish();
    }
    finally {
        if (verbose === undefined)
            delete game.flags.verbose;
        else
            game.flags.verbose = verbose;
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
    }
    finally {
        if (mongenSaved === undefined)
            delete game.iflags.debug_mongen;
        else
            game.iflags.debug_mongen = mongenSaved;
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
    let cursor = { x: game.u.ux, y: game.u.uy };
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
        }
        finally {
            if (verbose === undefined)
                delete game.flags.verbose;
            else
                game.flags.verbose = verbose;
            if (autodescribe === undefined)
                delete game.iflags.autodescribe;
            else
                game.iflags.autodescribe = autodescribe;
        }
        if (!target)
            break;
        cursor = target;
        const monster = await wizardKillTarget(cursor);
        if (monster === 'quit')
            break;
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
            }
            finally {
                game.context.mon_moving = false;
            }
        }
        else {
            await plineWithContinuation(`You ${destroyed ? 'destroy' : 'kill'} ${name}!`);
            await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
        }
        if (game.program_state.gameover || game.u.utotype
            || game.u.uz.dnum !== here.dnum || game.u.uz.dlevel !== here.dlevel)
            break;
    }
    level.monsters = level.monsters.filter(monster => !monster.dead);
    game.context.move = 0;
}
async function wizardKillTarget(cursor) {
    if (cursor.x === game.u.ux && cursor.y === game.u.uy) {
        const steed = game.u.usteed;
        if (steed) {
            const answer = await promptYesNoQuit(`Kill ${monsterName(steed)}?`);
            if (answer === 'q')
                return 'quit';
            if (answer === 'y')
                return steed;
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
export async function wizTelekinesis() {
    requirePlayingGame(game);
    let cursor = { x: game.u.ux, y: game.u.uy };
    await plineWithContinuation('Pick a monster to hurtle.');
    do {
        const tipShown = await showGetposTip();
        if (game.flags.verbose) {
            const helpKey = game.commandBindings.specialKey('getpos.help') ?? 63;
            await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
        }
        if (tipShown)
            await plineWithContinuation('Move cursor to a monster:');
        const target = await selectMapPosition({
            start: cursor, goal: 'a monster',
            prompt: game._pending_message,
        });
        if (!target)
            break;
        cursor = target;
        const monster = monsterAtPosition(game.level, cursor.x, cursor.y);
        const atHero = cursor.x === game.u.ux && cursor.y === game.u.uy;
        if (!(monster && canSpotMonster(monster)) && !atHero)
            continue;
        const direction = await promptDirection((_message, retry) => readDirectionKey('which direction? ', retry));
        if (!direction)
            break;
        if (monster) {
            await hurtleMonster(monster, direction.dx, direction.dy, 6, {
                finishMonsterDeath: finishHurtleMonsterDeath,
                // minliquid() credits drowning and lava burning to the hero;
                // rust and fatal damage to a fire-resistant monster use mondied().
                finishLiquidDeath: (target, death) => death.cause === 'drowning' || death.cause === 'lava-burning'
                    ? finishHeroMonsterKillOutcome(target, target.mx, target.my, { showKillMessage: false })
                    : finishMonsterLiquidDeath(target, death),
            });
            if (!monster.dead && monster.mhp > 0 && canSpotMonster(monster))
                cursor = { x: monster.mx, y: monster.my };
        }
        else {
            await hurtleHero(direction.dx, direction.dy, 6, {
                finishTeleport: finishTeleportArrival,
                gotoLevel, chooseTeleportDestination: askTeleportDestination,
                finishMonsterDeath: finishHurtleMonsterDeath,
            });
            cursor = { x: game.u.ux, y: game.u.uy };
        }
        if (game.program_state.gameover)
            break;
    } while (!game.u.utotype);
    if (game._helplessReason === 'moving through the air')
        setMulti(0);
    game.context.move = 0;
}
function menuLetter(index) {
    return index < 26
        ? String.fromCharCode('a'.charCodeAt(0) + index)
        : String.fromCharCode('A'.charCodeAt(0) + index - 26);
}
// C dungeon.c:print_dungeon() dungeon/branch heading.
function dungeonHeading(dnum) {
    const dungeon = game.dungeons[dnum];
    if (!dungeon)
        throw new RangeError(`Unknown dungeon ${dnum}`);
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
function branchKind(branch) {
    if (branch.type)
        return branch.type;
    if (branch.portal)
        return 'portal';
    const child = game.dungeons?.[branch.end2.dnum];
    if (child?.dname === 'Gehennom')
        return 'no_end1';
    if (child?.dname === 'The Elemental Planes')
        return 'no_end2';
    return 'stair';
}
function branchMenuLabel(branch) {
    const child = game.dungeons?.[branch.end2.dnum];
    if (!child)
        return null;
    return `${branchTypeDescription(branch)} to ${child.dname}: ${dungeonDepth(branch.end1.dnum, branch.end1.dlevel)}`;
}
function branchTypeDescription(branch) {
    return {
        portal: 'Portal',
        no_end1: 'Connection',
        no_end2: 'One way stair',
        stair: 'Stair',
    }[branchKind(branch)];
}
function dungeonLayoutEvents(dnum) {
    const events = [];
    for (const [name, level] of game.specialLevels || []) {
        if (level.dnum !== dnum)
            continue;
        events.push({ kind: 'special', name, ...level });
    }
    for (const branch of game.branches || []) {
        if (branch.end1.dnum !== dnum)
            continue;
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
function specialLevelReachable(event) {
    if (event.name === 'dummy')
        return false;
    if (event.name !== 'knox')
        return true;
    const incoming = (game.branches || []).find(branch => branch.end2?.dnum === event.dnum
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
async function endgamePrerequisite(destination) {
    if (!In_endgame(destination) || In_endgame(game.u?.uz)
        || game.u?.uhave?.amulet)
        return;
    const amulet = await addInventoryItem(await mksobj(AMULET_OF_YENDOR, true, false));
    // teleport.c prints the grant with prinv(); its doname()->xname() path
    // observes the visible object and appends it to the Amulet disco[] class
    // before the destination transaction begins.
    recordObjectEncounter(amulet.otyp);
    if (!game.u.uhave)
        game.u.uhave = {};
    game.u.uhave.amulet = 1;
    const message = `Endgame prerequisite: ${amulet.invlet} - the Amulet of Yendor.`;
    await pline(message);
}
// C ref: dungeon.c print_dungeon(TRUE). Build one source-ordered menu stream;
// the tty layer alone owns pagination and nested input capture.
function wizardLevelMenu() {
    const rows = [];
    const choices = new Map();
    let choiceIndex = 0;
    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
        if (In_endgame(game.u.uz) && dnum !== game.astral_level?.dnum)
            continue;
        // C print_dungeon(TRUE) emits the dungeon name via add_menu_heading(),
        // which skips menu coloring.
        rows.push({ text: dungeonHeading(dnum), attr: ATR_INVERSE,
            itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS });
        for (const event of dungeonLayoutEvents(dnum)) {
            const key = menuLetter(choiceIndex++);
            const current = game.u?.uz?.dnum === event.dnum
                && game.u?.uz?.dlevel === event.dlevel;
            let label;
            let destination;
            let reachable = true;
            if (event.kind === 'branch') {
                label = branchMenuLabel(event.branch);
                destination = { dnum: event.dnum, dlevel: event.dlevel };
            }
            else {
                label = `${specialDisplayName(event.name)}: ${dungeonDepth(event.dnum, event.dlevel)}`;
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
            }
            else {
                rows.push(`      ${label}`);
            }
        }
    }
    return { rows, choices };
}
// C dungeon.c:print_dungeon(FALSE), via wizcmds.c:wiz_where().
function wizardWhereLines() {
    const lines = [];
    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
        lines.push(dungeonHeading(dnum));
        for (const event of dungeonLayoutEvents(dnum)) {
            let label;
            if (event.kind === 'branch') {
                label = branchMenuLabel(event.branch);
            }
            else {
                label = `${specialDisplayName(event.name)}: ${dungeonDepth(event.dnum, event.dlevel)}`;
                if (event.name === 'castle')
                    label += ` (tune ${game.castleTune || ''})`;
            }
            const current = event.kind === 'special'
                && game.u.uz?.dnum === event.dnum && game.u.uz.dlevel === event.dlevel;
            if (label)
                lines.push(`${current ? '*' : ' '} ${label}`);
        }
    }
    const floating = game.branches.filter(branch => branch.end1.dnum === game.dungeons.length);
    if (floating.length) {
        lines.push('', 'Floating branches');
        for (const branch of floating) {
            const child = game.dungeons[branch.end2.dnum];
            if (!child)
                throw new Error(`Floating branch has no dungeon ${branch.end2.dnum}`);
            lines.push(`   ${branchTypeDescription(branch)} to ${child.dname}`);
        }
    }
    const hero = game.u;
    if (Invocation_lev(hero.uz)) {
        const position = game.level?.invocationPosition ?? { x: 0, y: 0 };
        lines.push('', `Invocation position @ (${position.x},${position.y}), hero @ (${hero.ux},${hero.uy})`);
    }
    else {
        const portal = game.level?.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (portal)
            lines.push('', `Portal @ (${portal.tx},${portal.ty}), hero @ (${hero.ux},${hero.uy})`);
        else if (wizardLevelExpectsPortal())
            lines.push('', 'No portal found.');
    }
    return lines;
}
function wizardLevelExpectsPortal() {
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
    if (!destination)
        return null;
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
    }
    else if (target < hero.ulevel) {
        if (hero.ulevel === 1) {
            await plineWithContinuation('You are already as inexperienced as you can get.');
            game.context.move = 0;
            return;
        }
        target = Math.max(1, target);
        while (hero.ulevel > target) {
            if (await loseHeroExperience('#levelchange'))
                return;
        }
    }
    else {
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
    }
    finally {
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
async function wizardIdentifyDescription(item, primaryHandDetail) {
    const override = game.iflags.override_ID;
    game.iflags.override_ID = true;
    try {
        return await inventoryItemDescription(item, { primaryHandDetail });
    }
    finally {
        if (override === undefined)
            delete game.iflags.override_ID;
        else
            game.iflags.override_ID = override;
    }
}
// C wizcmds.c:wiz_identify() delegates to display_inventory() with
// iflags.override_ID set.  Fully identified inventories still open a short
// PICK_NONE menu; the command does not collapse into a topline message.
export async function wizIdentify() {
    if (!game.inventory.length) {
        await pline('Not carrying anything.');
        game.context.move = 0;
        return;
    }
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    // display_pickinv() sorts the whole inventory before omitting fully
    // identified objects. Wizard naming also applies during the sort, so
    // alphabetization uses the names the menu reveals without discovering them.
    const override = game.iflags.override_ID;
    game.iflags.override_ID = true;
    let ordered;
    try {
        ordered = sortObjects(game.inventory, { mode: inventorySortMode() });
    }
    finally {
        if (override === undefined)
            delete game.iflags.override_ID;
        else
            game.iflags.override_ID = override;
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
    const window = tty_create_nhwindow(NHW_MENU);
    let selected;
    try {
        await tty_start_menu(window);
        tty_add_menu(window, {
            identifier: null,
            text: `Debug Identify -- unidentified or partially identified item${unidentified.length === 1 ? '' : 's'}`,
        });
        tty_add_menu(window, {
            identifier: 'all', selector: '_', group: String.fromCharCode(allKey),
            itemflags: MENU_ITEMFLAGS_SKIPINVERT,
            text: `select ${unidentified.length === 1
                ? 'it' : 'any or all of them'} to permanently identify${unidentified.length === 1 ? '' : ` (${visibleCommandKey(allKey)} for all)`}`,
        });
        let previousClass = null;
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
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
    if (selected.includes('all')) {
        await identifyPack(0);
        game.context.move = 0;
        return;
    }
    for (const item of selected) {
        if (item === 'all')
            continue;
        const learnedType = !objectTypeKnown(item);
        fullyIdentifyObject(item);
        if (learnedType)
            await exerciseAttribute(A_WIS, true);
        observeObjectForNaming(item);
        await plineWithContinuation(`${item.invlet} - ${await inventoryItemDescription(item, {
            primaryHandDetail: inventoryPrimaryHandDetail(item),
        })}.`);
    }
    game.context.move = 0;
}
//# sourceMappingURL=wizcmds.js.map