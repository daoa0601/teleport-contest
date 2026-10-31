// The what-is-it commands: farlook, encyclopedia lookup, and the help menu.
// C refs: pager.c dowhatis()/doquickwhatis()/do_look()/checkfile()/dohelp().
import { In_hell, Is_rogue_level, Is_waterlevel, LOOK_ONCE, LOOK_QUICK, LOOK_VERBOSE } from './const.js';
import { glyphAt } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { clearCommandKeys, takeCommandKey } from './input.js';
import { getLine, promptYesNo } from './query.js';
import { visibleCommandKey } from './command_keys.js';
import { selectMapPosition, shouldShowGetposTip, showGetposTip } from './getpos.js';
import { showChoiceWindow, showDisclosureOverlay, showMultiSelectWindow } from './windows.js';
import { encyclopediaEntries, encyclopediaMatches, encyclopediaSupplementalName } from './encyclopedia.js';
import { monsterAtPosition } from './monster_location.js';
import { heroIsPolymorphed } from './polyself.js';
import { selectInventoryObject } from './invent.js';
import { typedSymbolDescription } from './look_symbols.js';
import { singularObjectName } from './objnam.js';
import { farlookDescribesHero, farlookLocationDescription, lookatDescription, screenDescription, } from './pager_description.js';
import { monsterSeenDescription, offerMonsterSupplement } from './pager_monsters.js';
import { showLookList } from './pager_lists.js';
import { contactHelp, displayHelpFile, menuControlsHelp, setOptionsCommand } from './pager_help.js';
import { showKeyBindings, whatDoesCommand } from './command_help.js';
import { showExtendedCommandList } from './extended_commands.js';
import { option_help } from './options.js';
import { doextversion } from './extversion.js';
// C refs: pager.c:do_look() (mode 0 for whatis, 1 for quick glance),
// getpos.c:getpos(), pager.c:do_screen_description().
// Farlook spends no game time. Ordinary look retains its cursor between
// selections; quick look returns after describing one selection.
export async function doFarlook(quick = true) {
    const savedVerbose = game.flags.verbose;
    game.flags.verbose = !!savedVerbose && !quick;
    let verbose = !!game.flags.verbose;
    let position = { x: game.u.ux, y: game.u.uy };
    try {
        for (;;) {
            await plineWithContinuation(verbose
                ? 'Please move the cursor to a monster, object or location.'
                : 'Pick a monster, object or location.');
            const firstUse = shouldShowGetposTip();
            if (firstUse)
                await showGetposTip();
            if (verbose) {
                const helpKey = game.commandBindings.specialKey('getpos.help');
                if (helpKey === undefined)
                    throw new Error('Map selection requires a getpos.help binding');
                await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
            }
            if (firstUse)
                await plineWithContinuation('Move cursor to a monster, object or location:');
            const cursor = await selectMapPosition({
                start: position, force: quick,
                prompt: game._pending_message || game._retained_message,
                goal: 'a monster, object or location',
            });
            if (!cursor || cursor.x < 0)
                break;
            position = { x: cursor.x, y: cursor.y };
            verbose = false;
            game.flags.verbose = false;
            // putmixed() returns the description to WIN_MESSAGE. A later
            // checkfile() question or the next picker acknowledges that prose.
            game._pending_message = '';
            game._retained_message = '';
            const basic = screenDescription(cursor.x, cursor.y, '');
            const description = basic.needsDetail ? await farlookLocationDescription(cursor.x, cursor.y) : '';
            const glyph = glyphAt(cursor.x, cursor.y);
            const monster = basic.needsDetail && glyph?.kind === 'monster' && game.level
                && !farlookDescribesHero(cursor.x, cursor.y)
                ? monsterAtPosition(game.level, cursor.x, cursor.y) : null;
            const seen = monster ? monsterSeenDescription(monster) : '';
            const screen = basic.needsDetail ? screenDescription(cursor.x, cursor.y, description) : basic;
            await plineWithContinuation(screen.count ? screen.text
                + (seen ? ` [seen: ${seen}]` : '') : "I've never heard of such things.");
            if (screen.count === 1 && cursor.pickType !== LOOK_QUICK && cursor.pickType !== LOOK_ONCE
                && (cursor.pickType === LOOK_VERBOSE || !quick && game.flags.help !== false)) {
                await offerFarlookInformation(screen.firstMatch, cursor.pickType === LOOK_VERBOSE);
                if (monster)
                    await offerMonsterSupplement(monster, encyclopediaSupplementalName(screen.firstMatch), cursor.pickType === LOOK_VERBOSE);
            }
            if (quick || cursor.pickType === LOOK_ONCE)
                break;
        }
    }
    finally {
        if (savedVerbose === undefined)
            delete game.flags.verbose;
        else
            game.flags.verbose = savedVerbose;
    }
    game.context.move = 0;
}
export async function offerFarlookInformation(description, withoutAsking) {
    // do_look() passes firstmatch with a null monster type. The selected
    // description retains given names for checkfile()'s alternate lookup.
    for (const match of encyclopediaMatches(description)) {
        if (withoutAsking || await promptYesNo(`More info about "${match.name}"?`, 'n') === 'y')
            await showDisclosureOverlay(match.entry.lines, { restoreUnderlay: true });
    }
}
// C pager.c:dowhatis(), i.e. do_look(0).  The initial menu is a true PICK_ONE
// overlay; choosing the map entry destroys it, restores the map, then hands
// input ownership to the shared getpos/farlook transaction above.
export async function dowhatis() {
    const choices = [
        { key: '/', alias: 'y', text: 'something on the map' },
        { key: 'i', alias: '', text: "something you're carrying" },
        { key: '?', alias: 'n', text: 'something else (by symbol or name)' },
    ];
    if (!game.u.uswallow && !heroIsHallucinating(game))
        choices.push({ key: 'm', alias: '', text: 'nearby monsters' }, { key: 'M', alias: '', text: 'all monsters shown on map' }, { key: 'o', alias: '', text: 'nearby objects' }, { key: 'O', alias: '', text: 'all objects shown on map' }, { key: 't', alias: '^', text: 'nearby traps' }, { key: 'T', alias: '"', text: 'all seen or remembered traps' }, { key: 'e', alias: '`', text: 'nearby engravings' }, { key: 'E', alias: '|', text: 'all seen or remembered engravings' });
    const queuedKey = takeCommandKey();
    let choice = queuedKey === undefined ? '' : String.fromCharCode(queuedKey);
    if (queuedKey === undefined) {
        const lootabc = !!game.flags.lootabc;
        const items = [];
        for (const [index, entry] of choices.entries()) {
            if (index === 3)
                items.push({ selectable: false, text: '' });
            items.push({ text: entry.text, value: entry.key,
                ...(lootabc ? {} : { key: entry.key }),
                groupAccelerator: lootabc ? ['i', 'e'].includes(entry.key) ? '' : entry.key : entry.alias });
        }
        const result = await showMultiSelectWindow({
            title: 'What do you want to look at:', omitHeadings: true,
            pickOne: true, pageLocalKeys: true,
            sections: [{ items }],
        });
        choice = result[0] ?? '';
    }
    if (choice === 'y')
        choice = '/';
    const listKind = 'mM'.includes(choice) && choice ? 'monsters'
        : 'oO'.includes(choice) && choice ? 'objects'
            : 'tT'.includes(choice) && choice ? 'traps'
                : 'eE'.includes(choice) && choice ? 'engravings' : null;
    if (listKind) {
        await showLookList(listKind, choice === choice.toLowerCase(), () => lookatDescription(game.u.ux, game.u.uy));
        game.context.move = 0;
        return;
    }
    if (choice === '/') {
        await doFarlook(false);
        return;
    }
    if (choice === 'i') {
        const queuedLetter = takeCommandKey();
        const letter = queuedLetter ?? (await selectInventoryObject()).key;
        const item = game.inventory.find(item => item.invlet === String.fromCharCode(letter));
        if (item)
            await showEncyclopediaInformation(singularObjectName(item));
        else if (queuedLetter !== undefined)
            clearCommandKeys();
    }
    else if (choice === '?') {
        const typed = await getLine('Specify what? (type the word)', ch => ch >= ' ');
        const name = typed === ' ' ? typed : typed?.trim().replace(/\s+/g, ' ');
        if (name && name.length > 1)
            await showEncyclopediaInformation(name);
        else if (name) {
            const result = typedSymbolDescription(name, {
                includeHero: !game.flags.showrace && !heroIsPolymorphed(game)
                    && !!game.urace && game.urace.name !== 'human' && game.urace.name !== 'elf',
                waterLevel: Is_waterlevel(game.u.uz),
                inHell: In_hell(game.u.uz),
                blind: heroIsBlind(game),
                clairvoyance: !!game.u.clairvoyanceDetection,
                // pager.c resolves the override by level, independently of
                // the symbols currently displayed by do_symset().
                boulderSymbol: (Is_rogue_level(game.u.uz)
                    ? game.rogueBoulderSym : game.boulderSym) || '`',
            });
            await plineWithContinuation(result.count
                ? `${name}        ${result.text}` : "I've never heard of such things.");
            if (result.count === 1 && game.flags.help !== false)
                await offerFarlookInformation(result.firstMatch, false);
        }
    }
    game.context.move = 0;
}
// C pager.c:checkfile() entry display.
export async function showEncyclopediaInformation(name) {
    const entries = encyclopediaEntries(name);
    // checkfile() fills an NHW_MENU with putstr(), so tty treats its rows
    // as prose and accepts only the --More-- responses, even across pages.
    for (const entry of entries)
        await showDisclosureOverlay(entry.lines, { restoreUnderlay: true });
    if (!entries.length)
        await pline("You don't have any information on those things.");
}
// C pager.c:dohelp().
export async function dohelp() {
    const entries = [
        { key: 'a', text: 'About NetHack (version information).' },
        { key: 'b', text: 'Long description of the game and commands.' },
        { key: 'c', text: 'List of game commands.' },
        { key: 'd', text: 'Concise history of NetHack.' },
        { key: 'e', text: 'Info on a character in the game display.' },
        { key: 'f', text: 'Info on what a given key does.' },
        { key: 'g', text: 'List of game options.' },
        { key: 'h', text: 'Longer explanation of game options.' },
        { key: 'i', text: `Using the ${setOptionsCommand()} command to set options.` },
        { key: 'j', text: 'Full list of keyboard commands.' },
        { key: 'k', text: 'List of extended commands.' },
        { key: 'l', text: 'List menu control keys.' },
        { key: 'm', text: "Description of NetHack's command line." },
        { key: 'n', text: 'The NetHack license.' },
        { key: 'o', text: 'Support information.' },
        ...(game.flags.debug ? [{ key: 'p', text: 'List of wizard-mode commands.' }] : []),
    ];
    const key = await showChoiceWindow({
        title: 'Select one item:',
        entries,
    });
    const choice = String.fromCharCode(key);
    if (choice === 'a')
        await doextversion();
    else if (choice === 'e')
        await dowhatis();
    else if (choice === 'f')
        await whatDoesCommand();
    else if (choice === 'g')
        await option_help();
    else if (choice === 'j')
        await showKeyBindings();
    else if (choice === 'k')
        await showExtendedCommandList();
    else if (choice === 'l')
        await menuControlsHelp();
    else if (choice === 'o')
        await contactHelp();
    else {
        const HELP_FILES = {
            b: 'help', c: 'hh', d: 'history', h: 'opthelp', i: 'optmenu',
            m: 'usagehlp', n: 'license', p: 'wizhelp',
        };
        const file = HELP_FILES[choice];
        if (file)
            await displayHelpFile(file);
    }
    game.context.move = 0;
}
//# sourceMappingURL=pager.js.map