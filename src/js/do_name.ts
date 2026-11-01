// do_name.js — The #call/#name command and monster naming.
// C ref: do_name.c:docallcmd(), name_ok(), call_ok(), do_mgivenname(),
// alreadynamed(), christen_monst(), rndghostname(), roguename(), mon_nam(),
// distant_monnam(), l_monnam(), noname_monnam(), monverbself().  The
// remaining individual owners are naming_categories.ts (the category menu),
// individual_naming.ts (do_oname), object_call.ts (docall) and
// floor_naming.ts (namefloorobj).

import {
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, In_endgame, Is_astralevel, M_AP_FURNITURE, M_AP_MONSTER,
    M_AP_OBJECT, M_AP_TYPE, MGIVENNAME, PL_PSIZ, W_SADDLE,
} from './const.js';
import { clearCannedCommands } from './cmd.js';
import { takeCommandKey, takeCommandPosition } from './input.js';
import { takeRepeatCommand } from './cmd.js';
import { chooseNamingCategory } from './naming_categories.js';
import { nameFloorObject } from './floor_naming.js';
import { renameDiscoveredType } from './o_init.js';
import { queryLevelAnnotation } from './dungeon.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { SPE_NOVEL } from './object_data.js';
import { nameIndividualObject } from './individual_naming.js';
import {
    canSenseMonster, canSpotMonster, flush_screen, glyphAt, monsterVisible, randomDisplayMonsterIdentity,
    seeMonsterWithInfrared,
} from './display.js';
import { callObjectType, objectTypeIsCallable } from './object_call.js';
import { objectTypeKnown } from './shk.js';
import { observeObjectForNaming } from './objnam.js';
import { pline, plineWithContinuation } from './pline.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { GlyphOffset } from './glyph_numbers.js';
import { selectMapPosition, showGetposTip } from './getpos.js';
import { playerName } from './player_name.js';
import { heroBeautyDescription } from './mirror.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, monsterIsAnimal, monsterIsHumanoid,
    monsterIsMindless, monsterIsPlayerMonster, monsterIsRider, monsterTypeName,
} from './monster_data.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { cansee } from './vision.js';
import { visibleCommandKey } from './cmd.js';
import { priestName } from './priest.js';
import { shopkeeperName } from './shknam.js';
import { monsterRank } from './botl.js';
import { possessiveName } from './hacklib.js';
import { monsterPossessive, monsterPronounGender, monsterSubjectPronoun } from './mondata.js';
import { makePlural, verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { rn2 } from './rng.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import { monsterAtPosition } from './steed.js';

// C do_name.c:docallcmd().
// C do_name.c:name_ok().
// C do_name.c:call_ok().
export async function doname() {
    // do_name.c:docallcmd() uses a queued key as the naming category.
    // Any other queued entry selects nothing and clears the canned queue.
    let queuedChoice: number | undefined;
    if (game._inDoAgain) {
        const queued = takeRepeatCommand();
        if (queued && queued.kind === 'key') queuedChoice = queued.key;
        else if (queued) {
            queuedChoice = 0;
            clearCannedCommands();
        }
    } else {
        queuedChoice = takeCommandKey();
    }
    const choice = queuedChoice === undefined ? await chooseNamingCategory()
        : String.fromCharCode(queuedChoice);
    // C docallcmd() erases the category menu via its own dismissal
    // (erase_menu_or_text() -> docorner for a corner menu, docrt() for a
    // full-width one); no extra full redraw runs afterwards.

    // C refs: do_name.c:docallcmd()/do_oname() and
    // dungeon.c:donamelevel()/query_annotation().  The menu owns only the
    // category choice; level annotations live with mapseen, while an
    // individual object's name must stay on that same object identity.
    if (choice === 'm') {
        await nameChosenMonster();
    } else if (choice === 'f') {
        await nameFloorObject();
    } else if (choice === 'd') {
        await renameDiscoveredType();
    } else if (choice === 'a') {
        // donamelevel() is a getlin() prompt on the message row; it redraws
        // nothing, so no full-screen refresh follows it either.
        await queryLevelAnnotation();
        game._pending_message = '';
    } else if (choice === 'i') {
        // C do_name.c:name_ok() marks unseen, artifact and novel objects as
        // GETOBJ_DOWNPLAY.  getobj() omits those letters from the suggested
        // prompt while still accepting a directly typed inventory letter.
        const object = await chooseInventoryObject('name', candidate =>
            candidate.oclass === 12 ? GETOBJ_EXCLUDE
                : candidate.dknown === false || candidate.oartifact || candidate.otyp === SPE_NOVEL
                    ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST, { forcePrompt: true });
        if (object) {
            await nameIndividualObject(object);
            await flush_screen(1);
        }
    } else if (choice === 'o') {
        const object = await chooseInventoryObject('call', candidate =>
            !objectTypeIsCallable(candidate) ? GETOBJ_EXCLUDE
                : !candidate.dknown || objectTypeKnown(candidate) && !game._objectCallNames?.[candidate.otyp]
                    ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST);
        if (object) {
            observeObjectForNaming(object);
            if (!object.dknown) {
                await pline('You would never recognize another one.');
            } else {
                await callObjectType(object);
            }
            await flush_screen(1);
        }
    }
    game.context.move = 0;
}

// Given-name storage shared by monster creation, revival, and bones.
// C do_name.c:christen_monst(). No presentation imports: these setters also
// run while a new monster is still being constructed.
export function setMonsterGivenName<T extends Pick<Monster, 'name' | 'mgivenname' | 'mextra'>>(
    monster: T, value: string | null | undefined,
): T {
    // Names supplied by level files retain their whitespace. Only player
    // input goes through name_from_player()'s normalization.
    const name = String(value ?? '').split('\0', 1)[0]?.slice(0, PL_PSIZ - 1) || '';
    if (!name) {
        delete monster.name;
        delete monster.mgivenname;
        if (monster.mextra) delete monster.mextra.mgivenname;
    } else {
        monster.name = name;
        monster.mgivenname = name;
        monster.mextra ||= {};
        monster.mextra.mgivenname = name;
    }
    return monster;
}

// C do_name.c:rndghostname().
const GHOST_NAMES = [
    'Adri', 'Andries', 'Andreas', 'Bert', 'David', 'Dirk',
    'Emile', 'Frans', 'Fred', 'Greg', 'Hether', 'Jay',
    'John', 'Jon', 'Karnov', 'Kay', 'Kenny', 'Kevin',
    'Maud', 'Michiel', 'Mike', 'Peter', 'Robert', 'Ron',
    'Tom', 'Wilmar', 'Nick Danger', 'Phoenix', 'Jiro', 'Mizue',
    'Stephan', 'Lance Braccus', 'Shadowhawk', 'Murphy',
];

export function randomGhostName(state: GameState = game): string {
    if (!rn2(7)) return state.plname;
    const name = GHOST_NAMES[rn2(GHOST_NAMES.length)];
    if (name === undefined) throw new RangeError('Ghost name selection is outside the name table.');
    return name;
}

// C do_name.c:roguename().
export function roguePlayerName(): string {
    const options = typeof process === 'undefined' ? undefined : process.env.ROGUEOPTS;
    const start = options?.indexOf('name=') ?? -1;
    if (options !== undefined && start >= 0)
        return options.slice(start + 5).split(',', 1)[0] ?? '';
    return rn2(3) ? (rn2(2) ? 'Michael Toy' : 'Kenneth Arnold') : 'Glenn Wichman';
}

// C do_name.c:do_mgivenname().
export async function nameChosenMonster(): Promise<void> {
    requirePlayingGame(game);
    if (heroIsHallucinating(game)) {
        await plineWithContinuation('You would never recognize it anyway.');
        return;
    }
    const queued = game._inDoAgain ? undefined : takeCommandPosition();
    const goal = 'the monster you want to name';
    const tip = queued === undefined && await showGetposTip();
    if (queued === undefined && game.flags.verbose) {
        const helpKey = game.commandBindings.specialKey('getpos.help');
        if (helpKey === undefined) throw new Error('Monster naming requires a getpos.help binding');
        await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
    }
    if (tip) await plineWithContinuation(`Move cursor to ${goal}:`);
    const selected = queued === undefined ? await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy }, goal, force: false,
        prompt: game._pending_message,
    }) : queued;
    if (!selected || selected.x < 0) return;
    let monster: Monster | null;
    if (selected.x === game.u.ux && selected.y === game.u.uy) {
        const steed = game.u.usteed;
        if (steed && canSpotMonster(steed)) {
            monster = steed;
        } else {
            await plineWithContinuation(
                `This ${heroBeautyDescription()} creature is called ${game.plname} and cannot be renamed.`);
            return;
        }
    } else {
        monster = monsterAtPosition(game.level, selected.x, selected.y);
    }
    let swallowed = false;
    if (!monster && game.u.uswallow) {
        const glyph = glyphAt(selected.x, selected.y)?.glyph;
        if (glyph !== undefined && glyph >= GlyphOffset.swallow && glyph < GlyphOffset.explodeDark) {
            monster = game.u.ustuck ?? null;
            swallowed = true;
        }
    }
    // Seeing another part of a worm does not reveal the selected square.
    if (!monster || !swallowed && !canSenseMonster(monster)
        && (!(cansee(selected.x, selected.y) || seeMonsterWithInfrared(monster))
            || !monsterVisible(monster)
            || [M_AP_FURNITURE, M_AP_OBJECT].includes(M_AP_TYPE(monster)))) {
        await plineWithContinuation('I see no monster there.');
        return;
    }
    const oldName = distantMonsterName(monster, { article: 'the' });
    const name = await playerName(`What do you want to call ${oldName}?`);
    if (name === null) return;
    const subject = oldName.charAt(0).toUpperCase() + oldName.slice(1);
    if (((MONSTER_GENO[monster.mnum] ?? 0) & 0x1000) && !monster.ispriest) {
        if (!await rejectExistingName(monster, oldName, name))
            await plineWithContinuation(`${subject} doesn't like being called names!`);
    } else if (monster.isshk && !heroIsDeaf(game) && !monster.msleeping && monster.mcanmove
        && (MONSTER_SOUND[monster.mnum] ?? 0) > 17) {
        if (!await rejectExistingName(monster, oldName, name))
            await plineWithContinuation(`"I'm ${shopkeeperName(monster)}, not ${name}."`);
    } else if (monster.ispriest || monster.isminion || monster.isshk
        || MONSTER_NAME[monster.mnum] === 'ghost' || monster.mextra?.ebones) {
        if (!await rejectExistingName(monster, oldName, name))
            await plineWithContinuation(`${subject} will not accept the name ${name}.`);
    } else {
        setMonsterGivenName(monster, name);
    }
}

// C do_name.c:alreadynamed().
async function rejectExistingName(monster: Monster, oldName: string, proposed: string): Promise<boolean> {
    const subject = oldName.charAt(0).toUpperCase() + oldName.slice(1);
    const rider = monsterIsRider(monster);
    if (!proposed) {
        const personal = MGIVENNAME(monster) || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x80000) || monster.isshk;
        await plineWithContinuation(
            `${subject} would rather keep ${rider ? 'its' : monsterPossessive(monster)} existing ${personal ? 'name' : 'title'}.`);
        return true;
    }
    const fuzzy = (name: string): string => name.replace(/[ _-]/g, '').toLowerCase();
    const candidates = [oldName, oldName.replace(/^the /i, '')];
    for (const prefix of ['invisible ', ' of ']) {
        const index = oldName.toLowerCase().indexOf(prefix);
        if (index >= 0) candidates.push(oldName.slice(index + prefix.length));
    }
    if (candidates.some(candidate => fuzzy(candidate) === fuzzy(proposed))) {
        if (rider) await plineWithContinuation(`${subject} is already called that.`);
        else {
            const pronoun = monsterSubjectPronoun(monster);
            await plineWithContinuation(
                `${pronoun.charAt(0).toUpperCase()}${pronoun.slice(1)} is already called ${oldName}.`);
        }
        return true;
    }
    if (MONSTER_NAME[monster.mnum] === 'Juiblex' && /Juiblex/i.test(oldName)
        && proposed.toLowerCase() === 'jubilex') {
        await plineWithContinuation(`${subject} doesn't like being called ${proposed}.`);
        return true;
    }
    return false;
}

export type MonsterArticle = 'none' | 'the' | 'a' | 'your';

export interface MonsterNameOptions {
    capitalized?: boolean;
    state?: GameState;
    article?: MonsterArticle;
    adjective?: string;
    called?: boolean;
    suppressIt?: boolean;
    suppressSaddle?: boolean;
    augmentIt?: boolean;
    suppressInvisible?: boolean;
    suppressHallucination?: boolean;
    exact?: boolean;
}

interface NameFormatOptions extends Omit<MonsterNameOptions, 'state' | 'capitalized' | 'exact'> {
    exact?: boolean;
    suppressName?: boolean;
    suppressShopkeeper?: boolean;
    suppressAppearance?: boolean;
}

const G_UNIQ = 0x1000;
const M2_NEUTER = 0x00040000;
const M2_PNAME = 0x00080000;
const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_SHOPKEEPER = MONSTER_NAME.indexOf('shopkeeper');
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_WIZARD_OF_YENDOR = MONSTER_NAME.indexOf('Wizard of Yendor');
// C do_name.c:mon_nam()/Monnam().
export function monsterName(monster: Monster, {
    capitalized = false, state = game, article = 'the', adjective = '',
    called = false,
    suppressIt = false, suppressSaddle = !!MGIVENNAME(monster)
        || article === 'your' && !suppressIt && monster === state.u.usteed,
    augmentIt = false,
    suppressInvisible = false, suppressHallucination = false, exact = false,
}: MonsterNameOptions = {}): string {
    requireLiveGame(state);
    const name = formatMonsterName(monster, state, {
        article, adjective, called, suppressIt: suppressIt || exact,
        suppressSaddle: suppressSaddle || exact, augmentIt,
        suppressInvisible: suppressInvisible || exact,
        suppressHallucination: suppressHallucination || exact, suppressAppearance: exact, exact,
    });
    return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// C do_name.c:distant_monnam(). Conceal the Astral altar's identity until
// the hero is adjacent, including adjectives on the attending high priest.
export function distantMonsterName(monster: Monster, {
    state = game, article = 'none',
}: { state?: GameState; article?: 'none' | 'the' } = {}): string {
    requireLiveGame(state);
    const nearby = Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1;
    if (monster.mnum === PM_HIGH_CLERIC && !heroIsHallucinating(state)
        && Is_astralevel(state.u.uz) && !nearby) {
        const title = monster.female ? 'high priestess' : 'high priest';
        return article === 'the' ? `the ${title}` : title;
    }
    return formatMonsterName(monster, state, {
        article, called: true, suppressSaddle: false,
    });
}

// C do_name.c:noname_monnam(monster, ARTICLE_NONE).
// C do_name.c:l_monnam(): leash messages retain the species of a named creature.
export function monsterLeashName(monster: Monster, state: GameState = game): string {
    requireLiveGame(state);
    return formatMonsterName(monster, state, {
        article: 'none', called: true, suppressSaddle: !!MGIVENNAME(monster),
    });
}

// C do_name.c:noname_monnam(monster, ARTICLE_NONE).
export function namelessMonsterName(monster: Monster, {
    state = game, article = 'none', suppressIt = false, suppressInvisible = false,
    suppressHallucination = false, suppressSaddle = false,
}: Pick<MonsterNameOptions, 'state' | 'article' | 'suppressIt' | 'suppressInvisible'
    | 'suppressHallucination' | 'suppressSaddle'> = {}): string {
    requireLiveGame(state);
    return formatMonsterName(monster, state, {
        article, suppressName: true, suppressSaddle, suppressIt, suppressInvisible, suppressHallucination,
    });
}

// C do_name.c:x_monnam().
export function formatMonsterName(monster: Monster, state: GameState, {
    adjective = '', article = 'the', called = false, suppressName = false,
    suppressSaddle = !!MGIVENNAME(monster), suppressIt = false,
    suppressShopkeeper = false, augmentIt = false, suppressInvisible = false,
    suppressHallucination = false, suppressAppearance = false,
    exact = false,
}: NameFormatOptions = {}): string {
    const gameover = !!state.program_state?.gameover;
    const engulfing = state.u.uswallow && state.u.ustuck === monster;
    if (article === 'your' && !monster.mtame) article = 'the';
    if (engulfing) article = 'the';
    const hallucinating = !suppressHallucination && heroIsHallucinating(state) && !gameover;
    if (!suppressIt && !canSpotMonster(monster) && article !== 'your' && !gameover
        && monster !== state.u.usteed && !engulfing) {
        if (!augmentIt) return 'it';
        const someone = hallucinating ? !rn2(2)
            : monsterIsHumanoid(monster.mnum) && !monsterIsAnimal(monster)
                && !monsterIsMindless(monster.mnum);
        return someone ? 'someone' : 'something';
    }

    const invisible = !!monster.minvis && !engulfing && !suppressInvisible;
    const mimicking = !suppressAppearance && M_AP_TYPE(monster) === M_AP_MONSTER;
    if ((monster.ispriest || monster.isminion) && !mimicking) {
        const name = priestName(monster, { article, hallucinating, invisible, state, exact });
        return article === 'none' ? name.replace(/^the /, '') : name;
    }

    let displayedSpecies = monster.mnum;
    if (mimicking) {
        if (monster.mappearance === undefined)
            throw new Error(`Monster ${monster.m_id} has no species for its monster disguise.`);
        displayedSpecies = monster.mappearance;
    }
    const typeName = monsterTypeName(displayedSpecies, monster.female);
    if (monster.isshk && !suppressShopkeeper && !hallucinating && !mimicking) {
        const name = shopkeeperName(monster, { state });
        if (adjective && article === 'the') return `the ${adjective} ${name}`;
        return monster.mnum === PM_SHOPKEEPER && !invisible ? name
            : `${name} the ${invisible ? 'invisible ' : ''}${typeName}`;
    }

    const givenName = !suppressName || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME)
        ? MGIVENNAME(monster) : null;
    let adjectives = adjective ? `${adjective} ` : '';
    if (invisible) adjectives += 'invisible ';
    if (!suppressSaddle && ((monster.misc_worn_check ?? 0) & W_SADDLE)
        && !heroIsBlind(state) && !heroIsHallucinating(state))
        adjectives += 'saddled ';

    let name;
    let personal;
    if (hallucinating) {
        const identity = randomDisplayMonsterIdentity();
        name = identity.name;
        personal = identity.personal;
    } else if (givenName) {
        personal = true;
        if (monster.mnum === PM_GHOST) {
            name = `${possessiveName(givenName)} ghost`;
        } else if (called) {
            name = `${typeName} called ${givenName}`;
            personal = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME);
        } else if (monsterIsPlayerMonster(monster.mnum)
            && / the /i.test(givenName)) {
            // A player monster's adjectives belong after its own "the".
            return givenName.replace(/ the /i, match => match + adjectives);
        } else {
            name = givenName;
        }
    } else if (monsterIsPlayerMonster(monster.mnum) && !In_endgame(state.u.uz)) {
        name = monsterRank(monster, state).toLowerCase();
        personal = false;
    } else {
        name = typeName;
        personal = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME);
    }
    if (personal && (article === 'your' || !adjectives))
        article = monster.mnum === PM_WIZARD_OF_YENDOR ? 'the' : 'none';
    else if (((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) && article === 'a')
        article = 'the';
    const description = adjectives + name;
    if (article === 'a') return withIndefiniteArticle(description);
    return (article === 'none' ? '' : `${article} `) + description;
}

// C do_name.c:Monnam().
export function visibleMonsterSubject(monster: Monster): string {
    return monsterName(monster, { capitalized: true });
}

const REFLEXIVE_PRONOUNS: readonly [string, string, string, string] = ['himself', 'herself', 'itself', 'themselves'];

// C do_name.c:monverbself(). Obtain the displayed name before choosing a
// hallucinated pronoun, since the two use distinct random streams.
export function monsterReflexiveAction(monster: Monster, name: string, verb: string, otherText = '', { state = game }: { state?: GameState } = {}): string {
    const reflexive = REFLEXIVE_PRONOUNS[monsterPronounGender(monster, { state })];
    const action = verbForSubject(reflexive, verb);
    if (action === verb) {
        name = makePlural(name);
        if (name.toLowerCase() === 'they') name = name[0] === 'T' ? 'Them' : 'them';
    }
    return `${name} ${action}${otherText ? ` ${otherText}` : ''} ${reflexive}`;
}
