// The what-is-it commands: farlook, encyclopedia lookup, and the help menu.
// C refs: pager.c dowhatis()/doquickwhatis()/do_look()/checkfile()/dohelp().

import {
    A_NONE, ALTAR, AM_SANCTUM, Amask2align, BEAR_TRAP, BOLT_LIM, BUFSZ, COLNO, CORR, D_BROKEN, D_TRAPPED,
    def_warnsyms, DOOR, GRAVE, HOLE, In_hell, Is_airlevel, Is_astralevel, Is_rogue_level, Is_waterlevel,
    is_hole, is_pit, LOOK_ONCE, LOOK_QUICK, LOOK_VERBOSE, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT,
    M_AP_TYPE, MONSEEN_DETECT, MONSEEN_INFRAVIS, MONSEEN_NORMAL, MONSEEN_SEEINVIS, MONSEEN_TELEPAT,
    MONSEEN_WARNMON, MONSEEN_XRAYVIS, PIT, ROCKTRAP, ROWNO, SCORR, STONE, STRAT_WAITMASK, TER_DETECT,
    TER_MAP, TER_MON, TER_OBJ, TREE, TRAP_EXPLANATIONS, TRAPPED_CHEST, TRAPPED_DOOR, TT_BURIEDBALL,
    TT_INFLOOR, TT_LAVA, Upolyd, VIBRATING_SQUARE, WEB,
} from './const.js';
import {
    canSpotHeroSelf, cmapSymbolAppearance, displayLiquidName, glyphAt, howMonsterSeen,
    monsterClassSymbol, objectClassSymbol, randomDisplayMonsterName, swallowSymbolAppearance,
    terrain_glyph, transientMonsterGlyph, transientTrapGlyph, unblindTelepathyRange,
} from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { game, requireGameLevel } from './gstate.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { objectAtMapDescription } from './map_object_description.js';
import {
    MONSTER_CLASS_EXPLAIN, MONSTER_CLASS_SYMBOLS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME,
    MONSTER_SYMBOL, monsterDigests, monsterTypeName,
} from './monster_data.js';
import { makePlural, withIndefiniteArticle } from './objnam.js';
import { OBJECT_CLASS_EXPLAIN, OBJECT_CLASS_SYMBOLS } from './display.js';

import { visibleRegionAt } from './regions.js';
import { isPoolAt } from './terrain_properties.js';
import { surfaceName, waterbodyName } from './terrain_name.js';
import { trapName } from './trap.js';
import { iceDescriptionAt } from './dungeon_feature.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GlyphMetadata } from './display.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { clearCommandKeys, takeCommandKey } from './input.js';
import { getLine, promptYesNo } from './query.js';
import {
    commandResultCancelled, describeCommandKey, keyText, rememberCommandKey, showKeyBindings, takeRepeatCommand,
    visibleCommandKey,
} from './cmd.js';
import { selectMapPosition, shouldShowGetposTip, showGetposTip } from './getpos.js';
import {
    decodeMixedLiteral, showChoiceWindow, showDisclosureOverlay, showMultiSelectWindow, showTextWindow,
    type PageLocalMultiSelectItem,
} from './windows.js';
import { encyclopediaEntries, encyclopediaMatches, encyclopediaSupplementalName } from './encyclopedia.js';
import { monsterAtPosition } from './steed.js';
import { heroIsPolymorphed } from './polyself.js';
import { selectInventoryObject } from './invent.js';
import { typedSymbolDescription } from './look_symbols.js';
import { singularObjectName } from './objnam.js';
import { warningSymbols } from './warning_symbols.js';
import { BOULDER } from './object_data.js';
import { okToQuest, onQuestStart } from './quest.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';

import { distantMonsterName, monsterName } from './do_name.js';
import { dist2 } from './hacklib.js';
import { heroIsPunished } from './ball.js';
import { propertyIsActive } from './properties.js';
import { cansee, couldsee } from './vision.js';
import { findDrawbridgeAt } from './dbridge.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { DEC_TO_UNICODE } from './terminal.js';
import { detectedTrapDisguise } from './detect.js';
import { promptDirection, promptKey, readDirectionKey, restoreCommandMap } from './tty_prompts.js';
import { clearMessageWindow, displayMessageWindow, flushPendingTopline } from './tty_topline.js';
import { KEY_HELP } from './keyhelp_data.js';
import { HELP_FILES } from './help_files.js';
import { showExtendedCommandList } from './extended_commands.js';
import { option_help } from './options.js';
import { doextversion } from './extversion.js';

// C refs: pager.c:do_look() (mode 0 for whatis, 1 for quick glance),
// getpos.c:getpos(), pager.c:do_screen_description().
// Farlook spends no game time. Ordinary look retains its cursor between
// selections; quick look returns after describing one selection.
export async function doFarlook(quick = true): Promise<void> {
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
            if (firstUse) await showGetposTip();
            if (verbose) {
                const helpKey = game.commandBindings.specialKey('getpos.help');
                if (helpKey === undefined) throw new Error('Map selection requires a getpos.help binding');
                await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
            }
            if (firstUse) await plineWithContinuation('Move cursor to a monster, object or location:');

            const cursor = await selectMapPosition({
                start: position, force: quick,
                prompt: game._pending_message || game._retained_message,
                goal: 'a monster, object or location',
            });
            if (!cursor || cursor.x < 0) break;
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
                if (monster) await offerMonsterSupplement(monster,
                    encyclopediaSupplementalName(screen.firstMatch), cursor.pickType === LOOK_VERBOSE);
            }
            if (quick || cursor.pickType === LOOK_ONCE) break;
        }
    } finally {
        if (savedVerbose === undefined) delete game.flags.verbose;
        else game.flags.verbose = savedVerbose;
    }
    game.context.move = 0;
}

export async function offerFarlookInformation(description: string, withoutAsking: boolean): Promise<void> {
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
export async function dowhatis(): Promise<void> {
    const choices = [
        { key: '/', alias: 'y', text: 'something on the map' },
        { key: 'i', alias: '', text: "something you're carrying" },
        { key: '?', alias: 'n', text: 'something else (by symbol or name)' },
    ];
    if (!game.u.uswallow && !heroIsHallucinating(game)) choices.push(
        { key: 'm', alias: '', text: 'nearby monsters' },
        { key: 'M', alias: '', text: 'all monsters shown on map' },
        { key: 'o', alias: '', text: 'nearby objects' },
        { key: 'O', alias: '', text: 'all objects shown on map' },
        { key: 't', alias: '^', text: 'nearby traps' },
        { key: 'T', alias: '"', text: 'all seen or remembered traps' },
        { key: 'e', alias: '`', text: 'nearby engravings' },
        { key: 'E', alias: '|', text: 'all seen or remembered engravings' },
    );
    const queuedKey = takeCommandKey();
    let choice = queuedKey === undefined ? '' : String.fromCharCode(queuedKey);
    if (queuedKey === undefined) {
        const lootabc = !!game.flags.lootabc;
        const items: PageLocalMultiSelectItem<string>[] = [];
        for (const [index, entry] of choices.entries()) {
            if (index === 3) items.push({ selectable: false, text: '' });
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
    if (choice === 'y') choice = '/';
    const listKind = 'mM'.includes(choice) && choice ? 'monsters'
        : 'oO'.includes(choice) && choice ? 'objects'
            : 'tT'.includes(choice) && choice ? 'traps'
                : 'eE'.includes(choice) && choice ? 'engravings' : null;
    if (listKind) {
        await showLookList(listKind, choice === choice.toLowerCase(),
            () => lookatDescription(game.u.ux, game.u.uy));
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
        if (item) await showEncyclopediaInformation(singularObjectName(item));
        else if (queuedLetter !== undefined) clearCommandKeys();
    } else if (choice === '?') {
        const typed = await getLine('Specify what? (type the word)', ch => ch >= ' ');
        const name = typed === ' ' ? typed : typed?.trim().replace(/\s+/g, ' ');
        if (name && name.length > 1) await showEncyclopediaInformation(name);
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
export async function showEncyclopediaInformation(name: string): Promise<void> {
    const entries = encyclopediaEntries(name);
    // checkfile() fills an NHW_MENU with putstr(), so tty treats its rows
    // as prose and accepts only the --More-- responses, even across pages.
    for (const entry of entries)
        await showDisclosureOverlay(entry.lines, { restoreUnderlay: true });
    if (!entries.length) await pline("You don't have any information on those things.");
}

// C pager.c:dohelp().
export async function dohelp(): Promise<void> {
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
    if (choice === 'a') await doextversion();
    else if (choice === 'e') await dowhatis();
    else if (choice === 'f') await whatDoesCommand();
    else if (choice === 'g') await option_help();
    else if (choice === 'j') await showKeyBindings();
    else if (choice === 'k') await showExtendedCommandList();
    else if (choice === 'l') await menuControlsHelp();
    else if (choice === 'o') await contactHelp();
    else {
        const HELP_FILES: Record<string, string> = {
            b: 'help', c: 'hh', d: 'history', h: 'opthelp', i: 'optmenu',
            m: 'usagehlp', n: 'license', p: 'wizhelp',
        };
        const file = HELP_FILES[choice];
        if (file) await displayHelpFile(file);
    }
    game.context.move = 0;
}

// ---------------------------------------------------------------------------
// C pager.c:mhidden_description(). Probing reveals an alternate monster
// identity; farlook only describes furniture, objects, hiding, and regions.
// ---------------------------------------------------------------------------

export async function monsterHiddenConditions(
    monster: Monster, state: GameState,
    { showAlternateMonster = true }: { showAlternateMonster?: boolean } = {},
): Promise<string[]> {
    const conditions: string[] = [];
    const appearance = M_AP_TYPE(monster);
    const x = monster.mx, y = monster.my;
    if (appearance === M_AP_FURNITURE) {
        const symbol = MAP_SYMBOLS[monster.mappearance ?? -1];
        if (!symbol) throw new Error(`Monster ${monster.m_id} has no furniture disguise`);
        conditions.push(`mimicking ${withIndefiniteArticle(symbol.name)}`);
    } else if (appearance === M_AP_OBJECT) {
        conditions.push(`mimicking ${await objectAtMonsterDescription(monster, state)}`);
    } else if (appearance === M_AP_MONSTER && showAlternateMonster) {
        if (monster.mappearance === undefined)
            throw new Error(`Monster ${monster.m_id} has no disguise species`);
        const form = monsterTypeName(monster.mappearance, monster.female);
        conditions.push(`masquerading as ${withIndefiniteArticle(form)}`);
    } else if (!appearance && monster.mundetected) {
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (flags & 0x80) {
            conditions.push(`hiding under ${await objectAtMonsterDescription(monster, state)}`);
        } else if (flags & 0x100) {
            const ceiling = (flags & 0x10) && MONSTER_SYMBOL[monster.mnum] !== 13
                || (flags & 1);
            conditions.push(`hiding on the ${ceiling ? 'ceiling' : surfaceName(x, y, state)}`);
        } else {
            const water = MONSTER_SYMBOL[monster.mnum] === 57 && isPoolAt(x, y, state);
            conditions.push(`hiding${water ? ' in murky water' : ''}`);
        }
    }
    const region = visibleRegionAt(state, x, y);
    if (region)
        conditions.push(`in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`);
    return conditions;
}

export async function objectAtMonsterDescription(
    monster: Monster, state: GameState = game,
    { glyph = null }: { glyph?: GlyphMetadata | null } = {},
): Promise<string> {
    const level = requireGameLevel(state);
    glyph ??= level.flags.hero_memory
        ? level.at(monster.mx, monster.my)?.remembered_glyph ?? null
        : glyphAt(monster.mx, monster.my, state);
    return objectAtMapDescription(monster.mx, monster.my, glyph, state, 'hidden');
}

// C pager.c:dowhatdoes().
export async function whatDoesCommand(): Promise<void> {
    if (!game._whatdoesShown) {
        await pline(`Ask about '&' or '?' to get more info.${game.iflags.altmeta ? '  (For ESC, type it twice.)' : ''}`);
        game._whatdoesShown = true;
    }
    const readKey = async (prompt: string) => {
        const queued = takeRepeatCommand();
        if (queued) return queued.kind === 'key' ? queued.key : 27;
        await flushPendingTopline();
        const key = await promptKey(prompt);
        rememberCommandKey(key);
        return key;
    };
    let key = await readKey('What command? ');
    if (key === 27 && game.iflags.altmeta) {
        key = await readKey('] ');
        if (key !== 27) key |= 128;
    }
    // Native key lookup, key text, and numeric diagnostics use unsigned char.
    key &= 255;
    const description = describeCommandKey(key);
    if (description === null)
        await pline(`No such command '${visibleCommandKey(key)}', char code ${key} (0${key.toString(8).padStart(3, '0')} or 0x${key.toString(16).padStart(2, '0')}).`);
    else {
        if (key === 38 || key === 63) {
            await showTextWindow(KEY_HELP);
            await restoreCommandMap();
        }
        const [first = '', second] = description.split('\n');
        await pline(`${keyText(key).padEnd(8)}${first}${second ? ',' : '.'}`);
        if (second) await plineWithContinuation(`${keyText(key).padEnd(8)}${second}.`);
    }
    game.context.move = 0;
}

// ---------------------------------------------------------------------------
// C pager.c:self_lookat(), look_at_monster(), monhealthdescr(). Native
// monhealthdescr() is disabled, so wounded creatures have no health prefix.
// ---------------------------------------------------------------------------

const COYOTE_NAMES = [
    'Carnivorous Vulgaris', 'Road-Runnerus Digestus', 'Eatibus Anythingus',
    'Famishus-Famishus', 'Eatibus Almost Anythingus', 'Eatius Birdius',
    'Famishius Fantasticus', 'Eternalii Famishiis', 'Famishus Vulgarus',
    'Famishius Vulgaris Ingeniusi', 'Eatius-Slobbius', 'Hardheadipus Oedipus',
    'Carnivorous Slobbius', 'Hard-Headipus Ravenus', 'Evereadii Eatibus',
    'Apetitius Giganticus', 'Hungrii Flea-Bagius', 'Overconfidentii Vulgaris',
    'Caninus Nervous Rex', 'Grotesques Appetitus', 'Nemesis Ridiculii',
];

export async function lookAtMonster(monster: Monster, x: number, y: number): Promise<string> {
    const accurate = !heroIsHallucinating();
    const coyote = accurate && MONSTER_NAME[monster.mnum] === 'coyote';
    const name = coyote ? `${monsterName(monster, { article: 'none', called: true, suppressSaddle: false })} - ${
        monster.mcan ? 'Canis latrans' : COYOTE_NAMES[monster.m_id % COYOTE_NAMES.length]}`
        : distantMonsterName(monster);
    const tail = monster.mx !== x || monster.my !== y;
    const prefix = tail ? monster.isshk && accurate ? 'tail of ' : 'tail of a ' : '';
    let description = prefix + (accurate && monster.mtame ? 'tame '
        : accurate && monster.mpeaceful ? 'peaceful ' : '') + name;
    if (game.u.ustuck === monster) {
        // C pager.c:445: monster detection browses with u.uswallow cleared
        // and iflags.save_uswallow set, so a detected engulfer still
        // reports ", swallowing you" or ", engulfing you".
        const swallowed = !!game.u.uswallow || !!game.iflags.save_uswallow;
        description += swallowed
            ? monsterDigests(monster) ? ', swallowing you' : ', engulfing you'
            : heroFormSticks() ? ', being held' : ', holding you';
    }
    if (monster.mfrozen) description += ", can't move (paralyzed or sleeping or busy)";
    else if (monster.msleeping) description += ', asleep';
    else if ((monster.mstrategy ?? 0) & STRAT_WAITMASK) description += ', meditating';
    if (monster.mleashed) description += ', leashed to you';
    const trap = game.level?.traps.find(t => t.tx === monster.mx && t.ty === monster.my);
    if (monster.mtrapped && cansee(monster.mx, monster.my) && trap
        && (trap.ttyp === BEAR_TRAP || is_pit(trap.ttyp) || trap.ttyp === WEB)) {
        description += `, trapped in ${withIndefiniteArticle(trapName(trap.ttyp))}`;
        trap.tseen = true;
    }
    if (monster.mundetected || monster.m_ap_type || visibleRegionAt(game, x, y)) {
        const hidden = await monsterHiddenConditions(monster, game, { showAlternateMonster: false });
        if (hidden.length) description += `, ${hidden.join(', ')}`;
    }
    return description;
}

export function monsterSeenDescription(monster: Monster): string {
    const seen = howMonsterSeen(monster);
    if (!seen || seen === MONSEEN_NORMAL) return '';
    const senses = [
        [MONSEEN_NORMAL, 'normal vision'], [MONSEEN_SEEINVIS, 'see invisible'],
        [MONSEEN_INFRAVIS, 'infravision'], [MONSEEN_TELEPAT, 'telepathy'],
        [MONSEEN_XRAYVIS, 'astral vision'], [MONSEEN_DETECT, 'monster detection'],
    ] as const;
    const descriptions = senses.filter(([bit]) => seen & bit).map(([, text]): string => text);
    if (seen & MONSEEN_WARNMON) {
        if (heroIsHallucinating()) descriptions.push('paranoid delusion');
        else {
            const mask = (game.context.warntype?.obj ?? 0) | (game.context.warntype?.polyd ?? 0);
            const speciesFlags = MONSTER_FLAGS2[monster.mnum] ?? 0;
            const category = [[0x08, 'human'], [0x10, 'elf'], [0x80, 'orc'], [0x100, 'demon']] as const;
            const name = category.find(([bit]) => mask & speciesFlags & bit)?.[1]
                ?? monsterTypeName(monster.mnum, monster.female);
            descriptions.push(`warned of ${makePlural(name)}`);
        }
    }
    return descriptions.join(', ');
}

export async function selfLookDetails(): Promise<string> {
    const hero = game.u;
    let result = hero.usteed ? `, mounted on ${monsterName(hero.usteed, { article: 'your', suppressSaddle: true })}` : '';
    const species = heroSpecies();
    const appearance = (hero.m_ap_type ?? 0) & 3;
    if (appearance === M_AP_FURNITURE) {
        const name = MAP_SYMBOLS[hero.mappearance ?? -1]?.name;
        if (name) result += `, mimicking ${withIndefiniteArticle(name)}`;
    } else if (appearance === M_AP_OBJECT) {
        result += `, mimicking ${await objectAtMapDescription(hero.ux, hero.uy, glyphAt(hero.ux, hero.uy), game, 'hidden')}`;
    } else if (!appearance && hero.uundetected) {
        const flags = MONSTER_FLAGS1[species] ?? 0;
        if (flags & 0x80) result += ', hiding under something';
        else if (flags & 0x100) {
            const ceiling = !!(flags & 0x10) && MONSTER_SYMBOL[species] !== 13 || !!(flags & 1);
            result += `, hiding on the ${ceiling ? 'ceiling' : surfaceName(hero.ux, hero.uy)}`;
        } else result += `, hiding${MONSTER_SYMBOL[species] === 57 && isPoolAt(hero.ux, hero.uy) ? ' in murky water' : ''}`;
    }
    const region = visibleRegionAt(game, hero.ux, hero.uy);
    if (region) result += `, in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`;
    return result;
}

export function selfTrapDescription(): string {
    const hero = game.u;
    if (!hero.utrap) return '';
    if (hero.utraptype === TT_BURIEDBALL) return ', tethered to something buried';
    if (hero.utraptype === TT_LAVA) return `, sinking into ${displayLiquidName('lava')}`;
    if (hero.utraptype === TT_INFLOOR) return `, stuck in the ${surfaceName(hero.ux, hero.uy)}`;
    const trap = game.level?.traps.find(t => t.tx === hero.ux && t.ty === hero.uy);
    return `, trapped${trap ? ` in ${withIndefiniteArticle(trapName(trap.ttyp))}` : ''}`;
}

// C pager.c:do_supplemental_info(). The native without-asking branch does
// not set yes_to_moreinfo, so verbose look does not open this extra window.
export async function offerMonsterSupplement(monster: Monster, name: string, withoutAsking: boolean): Promise<void> {
    if (withoutAsking || heroIsHallucinating() || !((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x80)) return;
    if (!name || name.length >= 255) return;
    const gangIndex = name.toLowerCase().indexOf(' of ');
    const fence = name.toLowerCase().includes(' the fence');
    if (gangIndex < 0 && !fence) return;
    if (await promptYesNo(`More info about "${name}"?`, 'n') !== 'y') return;
    const lines = gangIndex >= 0 ? [
        `${name} is a member of a marauding horde of orcs`,
        'rumored to have brutally attacked and plundered',
        'the ordinarily sheltered town that is located ',
        'deep within The Gnomish Mines.', '',
        'The members of that vicious horde proudly and ',
        'defiantly acclaim their allegiance to their',
        `leader ${name.slice(gangIndex + 4)} in their names.`,
    ] : [
        `"${name}" is the common dungeon name of`,
        'a nefarious orc who is known to acquire property',
        'from thieves and sell it off for profit.', '',
        'The perpetrator was last seen hanging around the',
        'stairs leading to the Gnomish Mines.',
    ];
    await showDisclosureOverlay(lines, { restoreUnderlay: true });
}

// ---------------------------------------------------------------------------
// C pager.c:lookat() and trap_description(). Describe the displayed glyph;
// the current square is consulted only where the native glyph needs context.
// ---------------------------------------------------------------------------

// Looking never reads an engraving: report its saved text, even when the
// live inscription has since been scuffed or replaced.
export function quotedEngraving(x: number, y: number, name: string, force = false): string {
    const engraving = game.level?.engravings?.find(e => e.x === x && e.y === y);
    const headstone = name === 'grave';
    if (!engraving || !force && name !== 'engraving' && !headstone) return '';
    return engraving.eread ? ` with ${headstone ? 'headstone reading' : 'remembered text'}: "${engraving.rememberedText}"`
        : ` ${headstone ? 'whose headstone' : 'that'} you haven't read`;
}

export function lookGlyphAt(x: number, y: number): GlyphMetadata | null {
    const glyph = glyphAt(x, y);
    const mode = game.iflags.terrainmode;
    if (!mode || !glyph) return glyph;
    const omitted = glyph.kind === 'monster' && !(mode & TER_MON)
        || glyph.kind === 'object' && !(mode & TER_OBJ);
    if (!omitted) return glyph;
    const location = game.level?.at(x, y);
    return location ? terrain_glyph(location, x, y) : null;
}

// C do_screen_description() uses alternate wording while clairvoyance's
// temporary monster detection is active, and whenever the hero is blind.
export function unseenCreatureDescription(): string {
    return heroIsBlind(game) || game.u.clairvoyanceDetection
        ? 'unseen creature' : 'remembered, unseen, creature';
}

export function mapFeatureDescription(x: number, y: number, glyph: GlyphMetadata): string {
    if (glyph.kind === 'trap') return displayedTrapDescription(glyph.trapType, x, y);
    if (glyph.kind === 'invisible') return unseenCreatureDescription();
    if (glyph.kind === 'engraving') return 'engraving';
    if (glyph.kind === 'effect' && glyph.glyph !== undefined) {
        if (glyph.glyph >= GlyphOffset.zap && glyph.glyph < GlyphOffset.cmapC) return '';
        if (glyph.glyph >= GlyphOffset.cmapC && glyph.glyph < GlyphOffset.swallow) {
            if (glyph.glyph === cmapToGlyph(CmapSymbol.poisoncloud)) return 'poison cloud';
            if (glyph.glyph === cmapToGlyph(CmapSymbol.goodpos)) return 'valid position';
            return '';
        }
    }
    if (glyph.kind !== 'terrain') return 'unexplored area';
    const location = game.level?.at(x, y);
    if (!location) return 'unexplored area';
    if (glyph.terrainName === 'altar') {
        // pray.c:altarmask_at() gives the disguise priority over terrain.
        const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
        const mask = monster && M_AP_TYPE(monster) === M_AP_FURNITURE
            && monster.mappearance === CmapSymbol.altar
            ? monster.mcorpsenm ?? monster.mextra?.mcorpsenm ?? 0
            : location.typ === ALTAR ? location.flags : 0;
        const alignment = Amask2align(mask);
        const distant = Is_astralevel(game.u.uz) && !adjacentToHero(x, y)
            && !!(mask & AM_SANCTUM);
        const name = distant ? 'aligned' : alignment === A_NONE ? 'unaligned'
            : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
        return `${name} ${mask & AM_SANCTUM ? 'high ' : ''}altar`;
    }
    if (glyph.glyph === cmapToGlyph(CmapSymbol.ndoor) || glyph.terrainName === 'doorway') {
        if (findDrawbridgeAt(x, y)) return 'open drawbridge portcullis';
        return (location.doormask & ~D_TRAPPED) === D_BROKEN ? 'broken door' : 'doorway';
    }
    if (glyph.glyph === cmapToGlyph(CmapSymbol.cloud))
        return Is_airlevel(game.u.uz) ? 'cloudy area' : 'fog/vapor cloud';
    if ([CmapSymbol.pool, CmapSymbol.water, CmapSymbol.lava, CmapSymbol.lavawall, CmapSymbol.ice]
        .some(symbol => glyph.glyph === cmapToGlyph(symbol)))
        return waterbodyName(x, y);
    if (glyph.glyph === cmapToGlyph(CmapSymbol.stone)) {
        if (!location.seenv) return 'unexplored';
        if ((game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz))
            return adjacentToHero(x, y) ? 'land' : 'unknown';
        if (location.typ === STONE || location.typ === SCORR) return 'stone';
    }
    return glyph.terrainName;
}

// C pager.c:trap_description().
export function displayedTrapDescription(type: number, x: number, y: number): string {
    return detectedTrapDisguise(type, x, y) ?? trapName(type);
}

function adjacentToHero(x: number, y: number): boolean {
    return Math.abs(x - game.u.ux) <= 1 && Math.abs(y - game.u.uy) <= 1;
}

// ---------------------------------------------------------------------------
// C pager.c:do_screen_description(), add_cmap_descr(), append_str().
// ---------------------------------------------------------------------------

// encglyph() occupies ten bytes in the native buffer, followed by eight spaces.
const ENCODED_LOOK_PREFIX_LENGTH = 10 + 8;

interface ScreenDescription { text: string; count: number; firstMatch: string; needsDetail: boolean }

export function screenDescription(x: number, y: number, description: string): ScreenDescription {
    const glyph = lookGlyphAt(x, y);
    const location = game.level?.at(x, y);
    const appearance = location?.disp_glyph
        ? { ch: location.disp_ch, dec: location.disp_decgfx }
        : location?.remembered_glyph;
    if (!glyph || !appearance) return { text: description, count: 0, firstMatch: '', needsDetail: false };
    const symbol = appearance.dec ? `\x0e${appearance.ch}\x0f` : appearance.ch;
    const prefix = `${symbol}        `;
    const submerged = (game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz);
    const distant = Math.abs(x - game.u.ux) > 1 || Math.abs(y - game.u.uy) > 1;
    const detectionOnly = ((game.iflags.terrainmode ?? 0) & (TER_DETECT | TER_MAP)) === TER_DETECT;
    if ((game.u.uswallow || submerged) && distant
        || detectionOnly && glyph.glyph === cmapToGlyph(CmapSymbol.stone))
        return { text: prefix + 'unreconnoitered', count: 1, firstMatch: 'unreconnoitered', needsDetail: false };

    const meanings: string[] = [];
    let count = 0, firstMatch = '', needLook = false, hitTrap = false, skippedVenom = false;
    const append = (text: string, name: string, counted = true): void => {
        if (meanings.join(' or ').toLowerCase().includes(text.toLowerCase())) return;
        if (!meanings.length) firstMatch = name;
        meanings.push(text);
        if (counted) count++;
    };
    const sameSymbol = (candidate: { ch: string; dec?: boolean }): boolean =>
        candidate.ch === appearance.ch && !!candidate.dec === !!appearance.dec;
    if (Array.from({ length: 8 }, (_, index) => swallowSymbolAppearance(index)).some(sameSymbol)) {
        append('the interior of a monster', 'the interior of a monster');
        needLook = true;
    }
    const terrainmode = game.iflags.terrainmode ?? 0;
    if (!terrainmode || terrainmode & TER_MON) {
        for (let index = 1; index < MONSTER_CLASS_SYMBOLS.length; index++) {
            const name = MONSTER_CLASS_EXPLAIN[index];
            if (!name || name === 'invisible monster' || !sameSymbol({ ch: monsterClassSymbol(index) })) continue;
            append(withIndefiniteArticle(name), name);
            needLook = true;
        }
        if (sameSymbol({ ch: monsterClassSymbol(MONSTER_CLASS_SYMBOLS.indexOf('@')) })
            && x === game.u.ux && y === game.u.uy
            && !Upolyd(game.u) && game.urace
            && !['human', 'elf'].includes(game.urace.name)) append('you', 'you');
    }
    if (!terrainmode || terrainmode & TER_OBJ) {
        // pager.c matches ROCK_CLASS against the BOULDER override when one
        // is set for this level's symset (ov_rogue_syms on the Rogue level),
        // else the default rock symbol.
        const boulderSymbol = (Is_rogue_level(game.u.uz)
            ? game.rogueBoulderSym : game.boulderSym) || OBJECT_CLASS_SYMBOLS[14] || '';
        for (let index = 1; index < OBJECT_CLASS_SYMBOLS.length; index++) {
            const statue = index === 14 && glyph.kind === 'object' && glyph.statueGlyph;
            const boulder = index === 14 && sameSymbol({ ch: boulderSymbol });
            if (index === 14 ? !statue && !boulder : !sameSymbol({ ch: objectClassSymbol(index) })) continue;
            const name = index === 14 ? boulder ? 'boulder' : 'statue'
                : OBJECT_CLASS_EXPLAIN[index];
            if (!name) continue;
            needLook = true;
            if (index === 17) { skippedVenom = true; continue; }
            append(withIndefiniteArticle(name), name);
        }
    }
    if (sameSymbol({ ch: 'I' })) {
        const name = unseenCreatureDescription();
        append(withIndefiniteArticle(name), name);
    }
    if (glyph.kind === 'nothing' || sameSymbol({ ch: ' ' })) append('the dark part of a room', 'the dark part of a room');
    if (glyph.kind === 'unexplored' || sameSymbol({ ch: ' ' })) append(submerged ? 'land' : 'unexplored', submerged ? 'land' : 'unexplored');
    for (let order = 0; order <= CmapSymbol.goodpos; order++) {
        const index = order === CmapSymbol.lava ? CmapSymbol.water
            : order === CmapSymbol.lavawall ? CmapSymbol.lava
                : order === CmapSymbol.water ? CmapSymbol.lavawall : order;
        const definition = MAP_SYMBOLS[index];
        const trapType = index - CmapSymbol.arrowTrap + 1;
        const trap = trapType > 0 && trapType < TRAP_EXPLANATIONS.length;
        let name = definition?.name ?? (trap ? TRAP_EXPLANATIONS[trapType]
            : index === CmapSymbol.poisoncloud ? 'poison cloud'
                : index === CmapSymbol.goodpos ? 'valid position' : '');
        if (!name) continue;
        const candidate = index === CmapSymbol.darkroom
            ? game.flags.dark_room !== false && game.flags.color !== false
                ? cmapSymbolAppearance(CmapSymbol.room) : { ch: ' ', dec: false }
            : definition ? cmapSymbolAppearance(index) : { ch: trap ? trapType === WEB ? '"'
            : trapType === VIBRATING_SQUARE ? '~' : '^' : index === CmapSymbol.poisoncloud ? '#' : '$', dec: false };
        if (!sameSymbol(candidate)) continue;
        if (index === CmapSymbol.darkroom && glyph.kind === 'nothing') continue;
        if (hitTrap && trap || count >= 3 && index >= CmapSymbol.vodbridge && index <= CmapSymbol.hcdbridge) continue;
        if (trapType === VIBRATING_SQUARE && count && !In_hell(game.u.uz)
            && !(glyph.kind === 'trap' && glyph.trapType === VIBRATING_SQUARE)) continue;
        if (index === CmapSymbol.pool) name = 'pool';
        else if (index === CmapSymbol.water) name = Is_waterlevel(game.u.uz) ? 'limitless water' : 'wall of water';
        else if (index === CmapSymbol.lava) name = 'lava';
        const liquid = [CmapSymbol.pool, CmapSymbol.water, CmapSymbol.lava, CmapSymbol.lavawall, CmapSymbol.ice].includes(index);
        const article = name.includes(' of a room') ? `the ${name}`
            : liquid || index === CmapSymbol.stone || name === 'air' ? name : withIndefiniteArticle(name);
        append(!count && trap && trapType !== VIBRATING_SQUARE ? 'a trap' : article, name);
        if (trap && trapType !== VIBRATING_SQUARE) hitTrap = true;
        if (index === CmapSymbol.pool) {
            const currentLevel = game.u.uz;
            const here = (level: { dnum: number; dlevel: number } | null | undefined) =>
                !!level && !!currentLevel && level.dnum === currentLevel.dnum && level.dlevel === currentLevel.dlevel;
            const moat = here(game.medusa_level) ? 'shallow sea' : here(game.juiblex_level) ? 'swamp'
                : game.urole?.key === 'samurai' && onQuestStart(game) ? 'pond' : 'moat';
            append(moat === 'pond' ? 'a pond' : moat, moat, false);
        }
        if (index === CmapSymbol.altar || trap || index === CmapSymbol.engroom || index === CmapSymbol.engrcorr
            || index === CmapSymbol.grave || liquid && heroIsHallucinating(game)) needLook = true;
    }
    for (const warning of warningSymbols().slice(1)) {
        if (!sameSymbol({ ch: warning.ch })) continue;
        append(warning.desc, warning.desc);
        if (game.level?.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
            meanings[meanings.length - 1] += ' co-located with a boulder';
        break;
    }
    if (skippedVenom && count < 2) append('a splash of venom', 'splash of venom');
    let text = count > 4 ? 'can be many things' : meanings.join(' or ');
    const needsDetail = count > 1 || needLook;
    if (needsDetail) {
        firstMatch = description || firstMatch;
        if (firstMatch) {
            text += ` (${firstMatch}${quotedEngraving(x, y, firstMatch)})`;
            count = 1;
        }
    }
    const literal = text.slice(0, BUFSZ - 1 - ENCODED_LOOK_PREFIX_LENGTH);
    return { text: prefix + decodeMixedLiteral(literal), count, firstMatch, needsDetail };
}

// C pager.c:lookat() gives the sensed hero priority over the map glyph.
// Terrain-only inspection deliberately omits that self description.
export function farlookDescribesHero(x: number, y: number): boolean {
    return x === game.u.ux && y === game.u.uy && canSpotHeroSelf()
        && (!game.iflags.terrainmode || !!(game.iflags.terrainmode & TER_MON));
}

// C pager.c:lookat(): the detailed description of the displayed glyph at
// (x, y), from do_screen_description()'s second pass and getpos describes.
export async function farlookLocationDescription(x: number, y: number): Promise<string> {
    // Detection temporarily removes swallowing. Native lookat() compares
    // the engulfer's glyph before deciding that this square describes us,
    // even when the terrain mode will subsequently omit monsters.
    const engulfer = x === game.u.ux && y === game.u.uy && canSpotHeroSelf()
        && game.iflags.save_uswallow ? game.u.ustuck : null;
    const describesEngulfer = engulfer
        && glyphAt(x, y)?.glyph === transientMonsterGlyph(engulfer).glyph;
    if (!describesEngulfer && farlookDescribesHero(x, y))
        return lookatDescription(x, y);
    if (game.u.uswallow && game.u.ustuck)
        return `interior of ${monsterName(game.u.ustuck)}`;
    const glyph = lookGlyphAt(x, y);
    if (!glyph || glyph.kind === 'unexplored') {
        if ((game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz))
            return dist2(x, y, game.u.ux, game.u.uy) <= 2 ? 'land' : 'unknown';
        return 'unexplored area';
    }
    if (glyph?.kind === 'warning') {
        const index = glyph.glyph === undefined ? -1 : glyph.glyph - GlyphOffset.warning;
        const warning = def_warnsyms[index];
        if (!warning) throw new RangeError(`Unknown warning glyph ${glyph.glyph}`);
        return warning.desc;
    }
    if (glyph?.kind === 'nothing' || glyph?.kind === 'terrain'
        && glyph.terrainName === 'dark part of a room') return 'dark part of a room';
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (monster && glyph?.kind === 'monster') {
        return lookAtMonster(monster, x, y);
    }
    if (glyph.kind === 'object') return objectAtMapDescription(x, y, glyph);
    // Hallucinated statues project monster glyphs without a live monster.
    if (glyph?.kind === 'monster' && heroIsHallucinating(game))
        return randomDisplayMonsterName();

    const description = mapFeatureDescription(x, y, glyph);
    if (description === 'ice') return iceDescriptionAt(x, y);
    if (description === 'staircase down' && onQuestStart(game) && !okToQuest(game))
        return 'blocked staircase down';
    return description;
}

// C pager.c:lookat() and self_lookat(): the hero's own square as getpos
// autodescribe, travel menus, and the look lists present it.
export async function lookatDescription(x: number, y: number): Promise<string> {
    if (x === game.u?.ux && y === game.u?.uy) {
        const species = game.u.umonnum;
        const polymorphName = heroIsPolymorphed(game) && species !== undefined
            ? monsterTypeName(species, !!game.u.mfemale) : '';
        const race = game.urace?.adj || game.urace?.name || 'human';
        const role = game.urole?.name;
        const roleName = game.flags.female && role?.f ? role.f : role?.m;
        const form = polymorphName
            || `${race} ${(roleName || 'adventurer').toLowerCase()}`;
        const punishment = heroIsPunished()
            ? ', chained to a heavy iron ball' : '';
        const blind = heroIsBlind(game);
        const telepathy = unblindTelepathyRange() >= 0;
        const detection = heroDetectsMonsters(game);
        const invisible = propertyIsActive('invisible', game);
        // self_lookat() includes invisibility while blind only when sensed.
        const prefix = invisible && (!blind || telepathy || detection)
            ? 'invisible ' : '';
        const description = `${prefix}${form} called ${game.plname || 'player'}${await selfLookDetails()}${punishment}${selfTrapDescription()}`;
        const unseen = invisible && !game.u.seeInvisible
            && (game.u.seeInvisibleTurns ?? 0) === 0;
        // lookat() treats touch while blind or swallowed as normal vision.
        if (blind || game.u.uswallow || !(unseen || game.u.uundetected))
            return description;
        const senses = [
            game.u.infravision ? 'infravision' : '',
            telepathy ? 'telepathy' : '',
            detection ? 'monster detection' : '',
        ].filter(sense => sense.length > 0);
        return senses.length > 0
            ? `${description} [seen: ${senses.join(', ')}]` : description;
    }
    const loc = game.level?.at(x, y);
    if (!loc) return 'unexplored area';
    const glyph = glyphAt(x, y);
    if (glyph?.kind === 'warning' || glyph?.kind === 'nothing' || glyph?.kind === 'monster')
        return farlookLocationDescription(x, y);
    if (loc.typ === TREE && loc.remembered_glyph) return 'tree';
    if (!loc.remembered_glyph && !cansee(x, y)) return 'unexplored area';
    // C pager.c:do_screen_description() describes the displayed glyph, not
    // the terrain below it.  A visible (or still remembered) pile therefore
    // owns farlook before the room/corridor fallback.
    return await farlookLocationDescription(x, y) || 'unexplored area';
}

// ---------------------------------------------------------------------------
// C pager.c:look_all(), look_traps(), look_engrs(), look_region_nearby().
// ---------------------------------------------------------------------------

export type LookListKind = 'monsters' | 'objects' | 'traps' | 'engravings';

export async function showLookList(kind: LookListKind, nearby: boolean,
    describeHero: () => Promise<string>): Promise<void> {
    if (!game.level) return;
    const mode = game.iflags.getpos_coords === 'n' ? 'm' : game.iflags.getpos_coords ?? 'm';
    const entries = lookListEntries(kind, nearby, mode, describeHero);
    const first = await entries.next();
    if (first.done) {
        if (kind === 'monsters' || kind === 'objects')
            await pline(`No ${kind} are currently shown ${nearby ? 'nearby' : 'on the map'}.`);
        else await pline(`No ${kind} seen or remembered${nearby ? ' nearby' : ''}.`);
        return;
    }
    const firstLine = first.value;
    async function* content(): AsyncGenerator<string> {
        yield listHeading(kind, nearby, mode);
        yield '    ';
        yield firstLine;
        yield* entries;
    }
    await displayPagerText(content());
}

async function* lookListEntries(kind: LookListKind, nearby: boolean, mode: string,
    describeHero: () => Promise<string>): AsyncGenerator<string> {
    const level = game.level;
    if (!level) return;
    const lowX = nearby ? Math.max(1, game.u.ux - BOLT_LIM) : 1;
    const highX = nearby ? Math.min(COLNO - 1, game.u.ux + BOLT_LIM) : COLNO - 1;
    const lowY = nearby ? Math.max(0, game.u.uy - BOLT_LIM) : 0;
    const highY = nearby ? Math.min(ROWNO - 1, game.u.uy + BOLT_LIM) : ROWNO - 1;
    for (let y = lowY; y <= highY; y++) {
        for (let x = lowX; x <= highX; x++) {
            const glyph = glyphAt(x, y);
            if (!glyph) continue;
            const covering = coveringSymbolAt(x, y);
            let symbol = mapSymbolAt(x, y), description = '';
            let obscured = false;
            if (kind === 'monsters') {
                if (glyph.kind === 'monster') {
                    if (x === game.u.ux && y === game.u.uy && canSpotHeroSelf()) description = (await describeHero()).split(' [seen: ')[0] ?? '';
                    else {
                        const monster = monsterAtPosition(level, x, y);
                        if (monster) description = await lookAtMonster(monster, x, y);
                    }
                } else if (glyph.kind === 'invisible') description = 'remembered, unseen, creature';
                else if (glyph.kind === 'warning') {
                    const warning = def_warnsyms[(glyph.glyph ?? -1) - GlyphOffset.warning];
                    if (warning) description = warning.desc;
                }
            } else if (kind === 'objects') {
                if (glyph.kind === 'object') description = await objectAtMapDescription(x, y, glyph);
            } else if (kind === 'traps') {
                if (glyph.kind === 'trap') description = displayedTrapDescription(glyph.trapType, x, y);
                else {
                    const trap = level.traps.find(t => t.tx === x && t.ty === y && t.tseen);
                    if (trap && (!(Is_waterlevel(game.u.uz) || Is_airlevel(game.u.uz)) || couldsee(x, y))) {
                        description = trapName(trap.ttyp);
                        obscured = true;
                        symbol = transientTrapGlyph(trap).ch;
                    }
                }
            } else {
                const location = level.at(x, y);
                const engraving = level.engravings?.find(e => e.x === x && e.y === y);
                if (!location?.seenv || !engraving) continue;
                const headstone = location.lastseentyp === GRAVE;
                const suffix = quotedEngraving(x, y, headstone ? 'grave' : 'engraving', true);
                description = ' ' + (headstone ? suffix.replace(/^ (with |whose )/, '')
                    : suffix.startsWith(' with ') ? suffix.slice(6) : `engraving${suffix}`);
                const shown = glyph.kind === 'engraving' || glyph.kind === 'terrain' && glyph.terrainName === 'grave';
                if (!shown) {
                    obscured = true;
                    symbol = headstone ? '|' : location.lastseentyp === CORR ? '#' : '`';
                }
            }
            if (!description) continue;
            let coordinates = coordinateDescription(x, y, mode);
            if (mode === 'm' && y < 10 && (kind === 'monsters' || kind === 'objects')) coordinates += ' ';
            const prefix = mode === 's' ? coordinates : coordinates.padStart(mode === 'm' ? 8 : 12);
            // Each encoded native glyph uses nine more bytes than its visible character.
            const limit = BUFSZ - 1 - 9 * (obscured ? 2 : 1);
            const rowPrefix = `${prefix}  ${symbol}${kind === 'engravings' ? ' ' : '  '}`;
            const literal = description + (obscured ? ', obscured by ' : '');
            const remaining = limit - rowPrefix.length;
            // Truncate the native buffer before decoding, and keep rendered
            // glyph symbols out of the literal backslash handling.
            yield rowPrefix + decodeMixedLiteral(literal.slice(0, remaining))
                + (obscured ? covering.slice(0, Math.max(0, remaining - literal.length)) : '');
        }
    }
}

function listHeading(kind: LookListKind, nearby: boolean, mode: string): string {
    if (kind === 'traps' || kind === 'engravings')
        return nearby ? `Nearby seen or remembered ${kind}:` : `Seen or remembered ${kind} on this level:`;
    if (!nearby) return `All ${kind} currently shown on the map:`;
    const name = kind.charAt(0).toUpperCase() + kind.slice(1);
    return `${name} currently shown near ${mode === 'c' ? canSpotHeroSelf() ? 'you' : 'your position' : coordinateDescription(game.u.ux, game.u.uy, mode)}:`;
}

export function coordinateDescription(x: number, y: number, mode: string): string {
    if (mode === 'n') return '';
    if (mode === 'm') return `<${x},${y}>`;
    if (mode === 's') return `[${String(y + 2).padStart(2, '0')},${String(x).padStart(2, '0')}]`;
    const dx = x - game.u.ux, dy = y - game.u.uy;
    if (!dx && !dy) return '(here)';
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)
        return `(${dy ? dy > 0 ? 'south' : 'north' : ''}${dx ? dx > 0 ? 'east' : 'west' : ''})`;
    const full = mode === 'f';
    const parts = [dy ? `${Math.abs(dy)}${dy > 0 ? full ? 'south' : 's' : full ? 'north' : 'n'}` : '',
        dx ? `${Math.abs(dx)}${dx > 0 ? full ? 'east' : 'e' : full ? 'west' : 'w'}` : ''].filter(Boolean);
    return `(${parts.join(',')})`;
}

function mapSymbolAt(x: number, y: number): string {
    const location = game.level?.at(x, y);
    if (!location) return ' ';
    return location.disp_decgfx ? DEC_TO_UNICODE[location.disp_ch] ?? location.disp_ch : location.disp_ch;
}

// The "obscured by" clause decodes the covering glyph into its raw native
// symbol byte (windows.c decode_mixed()) and prints it mid-line, outside
// the DECgraphics shift. A DEC symbol byte never survives the captured
// screen, so only plain ASCII symbols appear there.
function coveringSymbolAt(x: number, y: number): string {
    const location = game.level?.at(x, y);
    if (!location) return ' ';
    return location.disp_decgfx ? '' : location.disp_ch;
}

// ---------------------------------------------------------------------------
// C pager.c:doidtrap(). Identifying a known trap never spends a turn.
// ---------------------------------------------------------------------------

export async function identifyTrap(): Promise<void> {
    game.context.move = 0;
    const direction = await promptDirection(readDirectionKey, { ctrlCommandHint: true });
    if (!direction) {
        // pager.c:doidtrap() returns ECMD_CANCEL when getdir() is declined;
        // the rhack seam clears the queues after the command.
        commandResultCancelled();
        return;
    }
    const x = game.u.ux + direction.dx, y = game.u.uy + direction.dy;
    const glyph = glyphAt(x, y);
    if (glyph?.kind === 'trap' && [BEAR_TRAP, TRAPPED_CHEST, TRAPPED_DOOR].includes(glyph.trapType)) {
        const disguise = detectedTrapDisguise(glyph.trapType, x, y);
        if (disguise) { await pline(`That is a ${disguise}.`); return; }
    }
    const trap = game.level?.traps.find(t => t.tx === x && t.ty === y && t.tseen);
    if (trap && !(direction.dz && (direction.dz < 0 ? is_hole(trap.ttyp) : trap.ttyp === ROCKTRAP))) {
        const made = !trap.madeby_u ? '' : trap.ttyp === WEB ? ' woven'
            : trap.ttyp === HOLE || trap.ttyp === PIT ? ' dug' : ' set';
        await pline(`That is ${withIndefiniteArticle(trapName(trap.ttyp))}${made}${trap.madeby_u ? ' by you' : ''}.`);
    } else await pline("I can't see a trap there.");
}

// ---------------------------------------------------------------------------
// C pager.c:dispfile_*, docontact(), domenucontrols().
// ---------------------------------------------------------------------------

export async function displayHelpFile(name: string, keyHelp = false): Promise<void> {
    clearMessageWindow();
    const lines = HELP_FILES.get(name);
    if (!lines) {
        await pline(`Cannot open "${name}".`);
        return;
    }
    // tty_display_file expands tabs before putstr; whatdoes_help instead
    // discards comments and the leading indentation in KEYHELP.
    const content = keyHelp ? lines.filter(line => !line.startsWith('#')).map(line => line.replace(/^[ \t]+/, ''))
        : lines.map(expandTabs);
    if (content.length) await displayPagerText(content);
    game.context.move = 0;
}

// tty_display_nhwindow(NHW_TEXT) forces full width. Its final More prompt
// stays on the bottom row even when the text fits on a short last page.
export async function displayPagerText(lines: Iterable<string> | AsyncIterable<string>): Promise<void> {
    await displayMessageWindow();
    await showTextWindow(lines);
    await restoreCommandMap();
}

function expandTabs(line: string): string {
    let text = '';
    for (const ch of line) text += ch === '\t' ? ' '.repeat(8 - text.length % 8) : ch;
    return text;
}

export async function contactHelp(): Promise<void> {
    await displayPagerText([
        'To contact the NetHack development team directly,',
        "see the 'Contact' form on our website or email <devteam@nethack.org>.",
        '',
        'For more information on NetHack, or to report a bug,',
        'visit our website "https://www.nethack.org/".',
    ]);
}

// C pager.c:setopt_cmd().
export function setOptionsCommand(): string {
    const bindings = game.commandBindings;
    const full = bindings.keyForCommand('optionsfull');
    if (full) return `'${visibleCommandKey(full)}'`;
    const prefix = bindings.keyForCommand('reqmenu');
    const options = bindings.keyForCommand('options');
    return `'#optionsfull' or '${prefix ? visibleCommandKey(prefix) : '#reqmenu'} ${options ? visibleCommandKey(options) : '#options'}'`;
}

// C pager.c:domenucontrols().
export async function menuControlsHelp(): Promise<void> {
    const key = (command: string) => visibleCommandKey(game.commandBindings.menuKey(command));
    const wholeAndPage = (label: string, whole: string, page: string) =>
        `${label.padStart(8)}     ${whole.padEnd(6)} ${page}`;
    const goTo = (key: string, name: string) => wholeAndPage('', key, name);
    await displayPagerText([
        'Menu control keys:', '',
        '           Whole  Current', '            Menu   Page',
        wholeAndPage('Select', key('.'), key(',')), wholeAndPage('Invert', key('@'), key('~')),
        wholeAndPage('Deselect', key('-'), key('\\')), '',
        wholeAndPage('Go to', key('>'), 'Next page'), goTo(key('<'), 'Previous page'),
        goTo(key('^'), 'First page'), goTo(key('|'), 'Last page'), '',
        wholeAndPage('Search', key(':'), 'Exter a target string and invert all matching entries'), '',
        '   Other   Return   Accept current choice(s) and dismiss menu',
        '           Enter    Same as Return',
        '           Space    If not on last page, advance one page;',
        '                    when on last page, treat like Return',
        '           Escape   Cancel menu without making any choice(s)',
    ]);
}
