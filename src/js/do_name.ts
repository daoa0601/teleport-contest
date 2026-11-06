// do_name.js — the do_name.c owner: the #call/#name command, monster and
// object naming, player-given names, hallucination naming, novel titles.
// C ref: do_name.c:docallcmd(), name_ok(), call_ok(), do_mgivenname(),
// do_oname(), name_from_player(), alreadynamed(), christen_monst(),
// rndghostname(), roguename(), mon_nam(), distant_monnam(), l_monnam(),
// noname_monnam(), x_monnam(), Monnam(), monverbself(), objtyp_is_callable(),
// docall(), docall_xname(), namefloorobj(), bogusmon(), rndmonnam(),
// hcolor(), rndcolor(), hliquid(), rndorcname(), christen_orc(),
// obj_pmname(), noveltitle(), lookup_novel().  The category menu is
// naming_categories.ts.

import {
    WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS,
    FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS,
    COIN_CLASS, GEM_CLASS, VENOM_CLASS,
} from './objclass.js';
import {
    objectClassForType, objectBaseWeight, objectUnique, objectMagic, SPE_NOVEL, AMULET_OF_YENDOR,
    FAKE_AMULET_OF_YENDOR, FIGURINE, HEAVY_IRON_BALL, STATUE, TIN, TOWEL,
    CLOAK_OF_DISPLACEMENT, CLOAK_OF_PROTECTION, HELMET, LEATHER_GLOVES, LEVITATION_BOOTS,
    OBJECT_BASES, OBJECT_NAMES, POT_WATER, SPEED_BOOTS,
} from './object_data.js';
import {
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, In_endgame, Is_astralevel, M_AP_FURNITURE, M_AP_MONSTER,
    M_AP_OBJECT, M_AP_TYPE, MGIVENNAME, PL_PSIZ, QBUFSZ, Upolyd, W_SADDLE, CMDQ_KEY, CQ_CANNED, HAND,
    LL_ARTIFACT, LL_CONDUCT, CORPSTAT_FEMALE, MD_PAD_BOGONS,
} from './const.js';
import { cmdq_clear, cmdq_pop, takeQueuedAdjacentPosition, visibleCommandKey } from './cmd.js';
import { OBJ_DESCR } from './o_init.js';
import { chooseNamingCategory } from './naming_categories.js';
import { renameDiscoveredType, recordObjectEncounter, rememberType, objectTypeKnown } from './o_init.js';
import { queryLevelAnnotation } from './dungeon.js';
import { chooseInventoryObject } from './invent.js';
import {
    canSenseMonster, canSpotMonster, flush_screen, glyphAt, monsterVisible,
    seeMonsterWithInfrared,
} from './display.js';
import { getRndLine } from './rumors.js';
import { BOGUS_MONSTERS } from './random_text_data.js';
import { repriceDiscoveredGems, objectOwnershipPrefix, updateUnpaidObjectPrice } from './shk.js';
import {
    definiteName, makePlural, objectName, objectNameIsPlural, observeObjectForNaming,
    pluralizeObjectNoun, simpleObjectName, simpleObjectNameWithArticle, verbForSubject,
    withIndefiniteArticle, type CorpseNameView,
} from './objnam.js';
import { impossible } from './diagnostics.js';
import type { GameObject } from './object_types.js';
import { pline, plineWithContinuation, recordGameLogEvent } from './pline.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { glyphIsSwallow } from './glyph_numbers.js';
import { selectMapPosition } from './getpos.js';
import { heroBeautyDescription } from './apply.js';
import { MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, SPECIAL_PM, monsterTypeName } from './monster_data.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { cansee } from './vision.js';
import { priestName } from './priest.js';
import { shopkeeperName } from './shknam.js';
import { rankOf, roleSwitch } from './botl.js';
import { possessiveName, upstart } from './hacklib.js';
import {
    monsterPossessive, monsterPronounGender, monsterSubjectPronoun, monsterHasProperName, monsterIsAnimal,
    monsterIsHumanoid, monsterIsMindless, monsterIsPlayerMonster, monsterIsRider,
} from './mondata.js';
import { getLine } from './query.js';

import { displayMessageWindow } from './topl.js';
import { wipeoutText } from './engrave.js';
import { setTwoWeaponCombat } from './wield.js';
import { artifactByName, nameArtifact, setWieldedArtifactProperties } from './artifact.js';
import type { Artifact } from './artifact.js';
import { withMapObject } from './map_object_description.js';
import { heroFormHidesUnderObjects, body_part } from './polyself.js';
import { rn2, rn2Display } from './rng.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import { monsterAtPosition } from './steed.js';
import { showGetposTip } from './hack.js';

// C do_name.c:docallcmd().
// C do_name.c:name_ok().
// C do_name.c:call_ok().
export async function doname() {
    // C do_name.c:docallcmd(): one cmdq_pop() (do_name.c:511-518) chooses
    // the naming category. Only a CMDQ_KEY selects one; every other
    // popped entry clears CQ_CANNED and leaves ch 0, whose switch case
    // does nothing (do_name.c:558-560). An empty queue asks the category
    // menu.
    let queuedChoice: number | undefined;
    const cmdq = cmdq_pop();
    if (cmdq) {
        if (cmdq.typ === CMDQ_KEY) queuedChoice = cmdq.key;
        else {
            cmdq_clear(CQ_CANNED);
            queuedChoice = 0;
        }
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
            candidate.oclass === COIN_CLASS ? GETOBJ_EXCLUDE
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

// C do_name.c:name_from_player(). Empty input cancels; spaces erase a name.
export async function playerName(prompt: string): Promise<string | null> {
    const input = await getLine(prompt, (_ch, key) => key <= 255);
    if (input === null || input === '') return null;
    // mungspaces() changes ASCII spaces and tabs, leaving high bytes intact.
    return input.replace(/^[ \t]+|[ \t]+$/g, '').replace(/[ \t]+/g, ' ')
        .slice(0, PL_PSIZ - 1);
}

// C do_name.c:christen_monst()
// Given-name storage shared by monster creation, revival, and bones.
// No presentation imports: these setters also
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

// C do_name.c:rndghostname().
export function randomGhostName(state: GameState = game): string {
    if (!rn2(7)) return state.plname;
    const name = GHOST_NAMES[rn2(GHOST_NAMES.length)];
    if (name === undefined) throw new RangeError('Ghost name selection is outside the name table.');
    return name;
}

const G_NOGEN = 0x0200;
const BOGUSMONSIZE = 100;

// C do_name.c:obj_pmname(): object gender describes the depicted creature,
// independently of any saved traits used when a corpse revives.
export function objectMonsterName(object: CorpseNameView): string {
    let species = object.corpsenm;
    if (species === undefined) return 'thing';
    const gender = (object.spe || 0) & 3;
    if (MONSTER_NAME[species] === 'aligned cleric' && gender === 0)
        species = MONSTER_NAME.indexOf('cleric');
    return gender === 1 || gender === 2
        ? monsterTypeName(species, gender === CORPSTAT_FEMALE)
        : MONSTER_NAME[species] || 'thing';
}

export interface MonsterIdentity { name: string; personal: boolean }

// C do_name.c:bogusmon(). get_rnd_line() goes to rumors.ts, which imports
// this module for mon_nam() the way C's do_name.c and rumors.c call each
// other; the cycle is function-body-only.
// Also C do_name.c:bogon_is_pname() (inlined): a leading code character is
// stripped and reported, and '-', '+', and '=' suppress ARTICLE_THE. Empty
// strings are considered substrings in JavaScript, so retain the source's
// explicit "has a control prefix" gate.
export function randomBogusMonsterIdentity(): MonsterIdentity {
    const selected = getRndLine(BOGUS_MONSTERS, MD_PAD_BOGONS, rn2Display) || 'bogon';
    const first = selected.charAt(0);
    const code = '-_+|='.includes(first) ? first : '';
    return {
        name: code ? selected.slice(1) : selected,
        personal: !!code && '-+='.includes(code),
    };
}

// Part of C do_name.c:bogusmon(): name-only callers (C passes a null code).
// Name-only view of bogusmon() above for descriptions that require a
// fictitious species.
export function randomBogusMonsterName(): string {
    return randomBogusMonsterIdentity().name;
}

// C do_name.c:rndmonnam().  This is presentation-only and therefore consumes
// the display stream even when called while resolving a core combat action.
export function randomDisplayMonsterIdentity(): MonsterIdentity {
    let mnum;
    do {
        mnum = rn2Display(SPECIAL_PM + BOGUSMONSIZE);
    } while (mnum < SPECIAL_PM
        && (monsterHasProperName(mnum)
            || ((MONSTER_GENO[mnum] ?? 0) & G_NOGEN)));
    if (mnum >= SPECIAL_PM) return randomBogusMonsterIdentity();
    const female = rn2Display(2) !== 0; // pmname(..., random gender)
    const name = monsterTypeName(mnum, female);
    if (name === undefined) throw new RangeError(`Missing display monster name ${mnum}`);
    return { name, personal: false };
}

// Part of C do_name.c:rndmonnam(): name-only view of the identity pair.
export function randomDisplayMonsterName() {
    return randomDisplayMonsterIdentity().name;
}

// C do_name.c:roguename().
export function roguePlayerName(): string {
    const options = typeof process === 'undefined' ? undefined : process.env.ROGUEOPTS;
    const start = options?.indexOf('name=') ?? -1;
    if (options !== undefined && start >= 0)
        return options.slice(start + 5).split(',', 1)[0] ?? '';
    return rn2(3) ? (rn2(2) ? 'Michael Toy' : 'Kenneth Arnold') : 'Glenn Wichman';
}

const HALLUCINATED_COLORS = [
    'ultraviolet', 'infrared', 'bluish-orange', 'reddish-green', 'dark white',
    'light black', 'sky blue-pink', 'pinkish-cyan', 'indigo-chartreuse',
    'salty', 'sweet', 'sour', 'bitter', 'umami',
    'striped', 'spiral', 'swirly', 'plaid', 'checkered', 'argyle', 'paisley',
    'blotchy', 'guernsey-spotted', 'polka-dotted', 'square', 'round',
    'triangular', 'cabernet', 'sangria', 'fuchsia', 'wisteria', 'lemon-lime',
    'strawberry-banana', 'peppermint', 'romantic', 'incandescent', 'octarine',
    'excitingly dull', 'mauve', 'electric', 'neon', 'fluorescent',
    'phosphorescent', 'translucent', 'opaque', 'psychedelic', 'iridescent',
    'rainbow-colored', 'polychromatic', 'colorless', 'colorless green',
    'dancing', 'singing', 'loving', 'loudy', 'noisy', 'clattery', 'silent',
    'apocyan', 'infra-pink', 'opalescent', 'violant', 'tuneless',
    'viridian', 'aureolin', 'cinnabar', 'purpurin', 'gamboge', 'madder',
    'bistre', 'ecru', 'fulvous', 'tekhelet', 'selective yellow',
];

// C do_name.c:hcolor(). Hallucinated color names use the display RNG.
export function displayColorName(preferred: string | null | undefined, state: GameState = game): string {
    if (preferred != null && !heroIsHallucinating(state)) return preferred;
    const color = HALLUCINATED_COLORS[rn2Display(HALLUCINATED_COLORS.length)];
    if (color === undefined) throw new Error('Display RNG returned an invalid color index');
    return color;
}

const OBJECT_COLOR_NAMES = [
    'black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'gray',
    'colorless', 'orange', 'bright green', 'yellow', 'bright blue',
    'bright magenta', 'bright cyan', 'white',
];

// C do_name.c:rndcolor() draws an ordinary color even when hcolor() will
// replace it with a hallucinated color from the display stream.
export function randomColorName(state: GameState = game, random = rn2): string {
    const color = OBJECT_COLOR_NAMES[random(OBJECT_COLOR_NAMES.length)];
    if (color === undefined) throw new RangeError('Random color selection is outside the color table');
    return displayColorName(color, state);
}

const HALLUCINATED_LIQUIDS = [
    'yoghurt', 'oobleck', 'clotted blood', 'diluted water',
    'purified water', 'instant coffee', 'tea', 'herbal infusion',
    'liquid rainbow', 'creamy foam', 'mulled wine', 'bouillon', 'nectar',
    'grog', 'flubber', 'ketchup', 'slow light', 'oil', 'vinaigrette',
    'liquid crystal', 'honey', 'caramel sauce', 'ink', 'aqueous humour',
    'milk substitute', 'fruit juice', 'glowing lava', 'gastric acid',
    'mineral water', 'cough syrup', 'quicksilver', 'sweet vitriol',
    'grey goo', 'pink slime', 'cosmic latte', 'bone oil', 'custard', 'lard',
    'vinegar', 'creosote',
];

// C do_name.c:hliquid(): the hallucinated liquid name.
export function displayLiquidName(fallback: string, state: GameState = game) {
    if ((!heroIsHallucinating(state) || state.program_state.gameover) && fallback)
        return fallback;
    // do_name.c:hliquid() includes a nonempty fallback as one additional slot.
    const index = rn2Display(HALLUCINATED_LIQUIDS.length + (fallback ? 1 : 0));
    return HALLUCINATED_LIQUIDS[index] ?? fallback;
}

// C do_name.c:rndorcname().
export function randomOrcName(): string {
    const vowels = ['a', 'ai', 'og', 'u'];
    const consonants = ['gor', 'gris', 'un', 'bane', 'ruk', 'oth', 'ul', 'z', 'thos', 'akh', 'hai'];
    const count = rn2(2) + 3;
    let vowelFirst = rn2(2);
    let name = '';
    for (let index = 0; index < count; index++) {
        vowelFirst = 1 - vowelFirst;
        if (index > 0 && rn2(30) === 0) name += '-';
        const syllables = vowelFirst ? vowels : consonants;
        const syllable = syllables[rn2(syllables.length)];
        if (syllable === undefined) throw new Error('Orc name selection exceeded its syllables.');
        name += syllable;
    }
    return name;
}

// C do_name.c:christen_orc()
// The gang name is composed into the orc's given
// name.  Shared by stolen_booty() and the booty delivery below.
export function nameOrc(monster: Monster, gang: string | null, suffix = ''): void {
    const name = upstart(randomOrcName());
    setMonsterGivenName(monster, gang === null ? name + suffix : `${name} of ${upstart(gang)}`);
}

export const NOVEL_TITLES: readonly string[] = [
    "The Colour of Magic",
    "The Light Fantastic",
    "Equal Rites",
    "Mort",
    "Sourcery",
    "Wyrd Sisters",
    "Pyramids",
    "Guards! Guards!",
    "Eric",
    "Moving Pictures",
    "Reaper Man",
    "Witches Abroad",
    "Small Gods",
    "Lords and Ladies",
    "Men at Arms",
    "Soul Music",
    "Interesting Times",
    "Maskerade",
    "Feet of Clay",
    "Hogfather",
    "Jingo",
    "The Last Continent",
    "Carpe Jugulum",
    "The Fifth Elephant",
    "The Truth",
    "Thief of Time",
    "The Last Hero",
    "The Amazing Maurice and His Educated Rodents",
    "Night Watch",
    "The Wee Free Men",
    "Monstrous Regiment",
    "A Hat Full of Sky",
    "Going Postal",
    "Thud!",
    "Wintersmith",
    "Making Money",
    "Unseen Academicals",
    "I Shall Wear Midnight",
    "Snuff",
    "Raising Steam",
    "The Shepherd's Crown"
];

// C do_name.c:noveltitle(). Title indices are persistent object identity.
export function novelTitle(book: GameObject): string {
    const selected = rn2(NOVEL_TITLES.length);
    if (book.novelidx === -1 || book.novelidx === undefined)
        book.novelidx = selected;
    const index = book.novelidx >= 0 && book.novelidx < NOVEL_TITLES.length
        ? book.novelidx : selected;
    const title = NOVEL_TITLES[index];
    if (title === undefined) throw new RangeError(`Unknown novel title index ${index}`);
    return title;
}

// C do_name.c:lookup_novel(). An unrecognized label keeps a novel's existing
// title index; recognized spellings replace both its title and index.
export function lookupNovelTitle(name: string, book: GameObject): string | null {
    const aliases: ReadonlyMap<string, string> = new Map([
        ['the color of magic', 'The Colour of Magic'], ['sorcery', 'Sourcery'],
        ['masquerade', 'Maskerade'],
        ['the amazing maurice', 'The Amazing Maurice and His Educated Rodents'],
        ['thud', 'Thud!'],
    ]);
    const requested = aliases.get(name.toLowerCase()) ?? aliases.get(definiteName(name).toLowerCase()) ?? name;
    const fullName = definiteName(requested).toLowerCase();
    const index = NOVEL_TITLES.findIndex(title => title.toLowerCase() === requested.toLowerCase()
        || title.toLowerCase() === fullName);
    if (index >= 0) {
        book.novelidx = index;
        return NOVEL_TITLES[index] ?? null;
    }
    return book.novelidx === undefined ? null : NOVEL_TITLES[book.novelidx] ?? null;
}

// C do_name.c:do_mgivenname().
export async function nameChosenMonster(): Promise<void> {
    requirePlayingGame(game);
    if (heroIsHallucinating(game)) {
        await plineWithContinuation('You would never recognize it anyway.');
        return;
    }
    const queued = takeQueuedAdjacentPosition();
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
        if (glyph !== undefined && glyphIsSwallow(glyph)) {
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
        const personal = MGIVENNAME(monster) || monsterHasProperName(monster.mnum) || monster.isshk;
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

// C do_name.c:l_monnam(): keeps the species with "called", so leash
// messages retain the species of a named creature.
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

    const givenName = !suppressName || monsterHasProperName(monster.mnum)
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
            personal = monsterHasProperName(monster.mnum);
        } else if (monsterIsPlayerMonster(monster.mnum)
            && / the /i.test(givenName)) {
            // A player monster's adjectives belong after its own "the".
            return givenName.replace(/ the /i, match => match + adjectives);
        } else {
            name = givenName;
        }
    } else if (monsterIsPlayerMonster(monster.mnum) && !In_endgame(state.u.uz)) {
        name = rankOf(monster.m_lev, monster.mnum, !!monster.female, state).toLowerCase();
        personal = false;
    } else {
        name = typeName;
        personal = monsterHasProperName(monster.mnum);
    }
    if (personal && (article === 'your' || !adjectives))
        article = monster.mnum === PM_WIZARD_OF_YENDOR ? 'the' : 'none';
    else if (((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) && article === 'a')
        article = 'the';
    const description = adjectives + name;
    if (article === 'a') return withIndefiniteArticle(description);
    return (article === 'none' ? '' : `${article} `) + description;
}

// C do_name.c:Monnam(): mon_nam() with the first letter upper-cased for use
// at the start of a sentence.  Hallucinated subjects (rndmonnam(); personal
// bogus-monster names suppress the article) are chosen inside mon_nam()'s
// port, so callers must not branch on hallucination before calling this.
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

// C do_name.c:do_oname()
// Player inscriptions and artifact naming.
export async function nameIndividualObject(object: GameObject): Promise<void> {
    if (object.otyp === SPE_NOVEL) {
        await plineWithContinuation(`${objectOwnershipPrefix(object)}${simpleObjectName(object)} already has a published name.`);
        return;
    }
    observeObjectForNaming(object);
    const prefix = `What do you want to name ${objectNameIsPlural(object) ? 'these' : 'this'} `;
    const suffix = '?';
    const description = individualNamingDescription(object, QBUFSZ - 1 - prefix.length - suffix.length);
    const name = await playerName(`${prefix}${description}${suffix}`);
    if (name === null) return;
    if (object.oartifact) {
        await plineWithContinuation(`${object.oextra?.oname || object.oname || 'The artifact'} resists the attempt.`);
        return;
    }

    const artifact = artifactByName(name);
    let inscription = name;
    if (artifact && (restrictedArtifactName(object, artifact)
        || artifact.baseType === object.otyp && game._artifactExists?.has(artifact.id))) {
        inscription = artifact.name;
        const start = /^the /i.test(inscription) ? inscription.slice(0, 4) : '';
        do {
            inscription = start + wipeoutText(artifact.name.slice(start.length), rn2Display(2) + 1);
        } while (inscription === artifact.name);
        await plineWithContinuation(`While engraving, your ${body_part(HAND, game)} slips.`);
        await displayMessageWindow();
        await plineWithContinuation(`You engrave: "${inscription}".`);
        const conduct = (game.u.uconduct ??= {});
        conduct.literate = (conduct.literate ?? 0) + 1;
    } else if (artifact?.baseType === object.otyp) {
        inscription = artifact.name;
    }

    delete object.oname;
    if (inscription) {
        object.oextra = { ...object.oextra, oname: inscription };
    } else if (object.oextra) {
        delete object.oextra.oname;
    }
    if (!artifact || artifact.baseType !== object.otyp || inscription !== artifact.name) return;
    if (!nameArtifact(object, artifact, { origin: 'named', knownOrigin: true })) return;
    if (object === (game.uswapwep || game.u.uswapwep)) {
        if (game.u.twoweap) await plineWithContinuation('You can no longer wield two weapons at once.');
        setTwoWeaponCombat(false);
    }
    if (object === (game.uwep || game.u.uwep))
        await setWieldedArtifactProperties(object, true, game);
    if (object.unpaid) updateUnpaidObjectPrice(object);
    const conduct = (game.u.uconduct ??= {});
    const first = !conduct.literate;
    conduct.literate = (conduct.literate ?? 0) + 1;
    const bareName = artifact.name.replace(/^the /i, '');
    recordGameLogEvent(first ? `became literate by naming ${bareName}`
        : `chose ${simpleObjectNameWithArticle(object)} to be named "${bareName}"`, {
        flags: first ? LL_CONDUCT | LL_ARTIFACT : LL_ARTIFACT,
    });
}

// Part of C objnam.c:safe_qbuf(): the do_oname() prompt's shortening ladder
// (xname, short_oname, simpleonames, "item").
// C safe_qbuf()/short_oname(xname, simpleonames): keep as much of each
// existing name as fits, without changing the names the player can edit.
function individualNamingDescription(object: GameObject, limit: number): string {
    const describe = (item: GameObject, state = game): string => {
        const name = objectName(item, state);
        return item.quan === 1 ? name : pluralizeObjectNoun(item, name);
    };
    let name = describe(object);
    if (name.length <= limit) return name;

    const callName = game._objectCallNames?.[object.otyp];
    const personalName = object.oextra?.oname || object.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...game, _objectCallNames: {
            ...game._objectCallNames, [object.otyp]: `${callName.slice(0, 8)}...`,
        } } : game;
    const shortNamedObject = personalName && personalName.length >= 12
        ? { ...object, oextra: { ...object.oextra, oname: `${personalName.slice(0, 8)}...` } }
        : object;
    if (shortCallState !== game) {
        name = describe(object, shortCallState);
        if (name.length <= limit) return name;
    }
    if (shortNamedObject !== object) {
        name = describe(shortNamedObject);
        if (name.length <= limit) return name;
    }
    const shortenBoth = shortCallState !== game && shortNamedObject !== object;
    if (shortenBoth) {
        name = describe(shortNamedObject, shortCallState);
        if (name.length <= limit) return name;
    }

    // Only the combined attempt leaves both names abbreviated when native
    // removes attributes. Erosion aliases share the cleared C fields.
    const state = shortenBoth ? shortCallState : game;
    const plainObject = { ...(shortenBoth ? shortNamedObject : object),
        bknown: game.urole?.key === 'priest', rknown: false, greased: false,
        oeroded: 0, oeroded2: 0, orotten: false, odiluted: false, norevive: false,
    };
    name = describe(plainObject, state);
    if (name.length > limit) name = simpleObjectName(plainObject, state);
    return name.length <= limit ? name : 'item';
}

// Part of C artifact.c:restrict_name(): canonical spelling is artifact.ts.
function restrictedArtifactName(object: GameObject, artifact: Artifact): boolean {
    if (!(artifact.restricted || artifact.noGeneration || object.quan > 1)) return false;
    if (object.otyp === artifact.baseType) return true;
    if (objectTypeKnown(object) || objectTypeKnown({ otyp: artifact.baseType })) return false;
    if (object.oclass !== objectClassForType(artifact.baseType)) return false;
    const description = OBJ_DESCR(object.otyp);
    const other = OBJ_DESCR(artifact.baseType);
    if (!description || !other) return false;
    const [low, high] = appearanceRange(object);
    return description === other || artifact.baseType >= low && artifact.baseType <= high;
}

// C o_init.c:obj_shuffle_range()
// Includes the fixed-description exceptions.
function appearanceRange(object: GameObject): readonly [number, number] {
    const type = object.otyp;
    const armorRanges = [
        [HELMET, OBJECT_NAMES.indexOf('helm of telepathy')],
        [LEATHER_GLOVES, OBJECT_NAMES.indexOf('gauntlets of dexterity')],
        [CLOAK_OF_PROTECTION, CLOAK_OF_DISPLACEMENT], [SPEED_BOOTS, LEVITATION_BOOTS],
    ];
    if (object.oclass === ARMOR_CLASS) {
        for (const [low, high] of armorRanges)
            if (low !== undefined && high !== undefined && type >= low && type <= high)
                return [low, high];
    }
    let low = OBJECT_BASES[object.oclass] ?? type;
    let high = (OBJECT_BASES[object.oclass + 1] ?? type + 1) - 1;
    if (object.oclass === POTION_CLASS) high = POT_WATER - 1;
    else if ([AMULET_CLASS, SCROLL_CLASS, SPBOOK_CLASS].includes(object.oclass)) {
        high = low;
        while (objectClassForType(high) === object.oclass
            && !objectUnique(high) && objectMagic(high)) high++;
        high--;
    } else if (![RING_CLASS, WAND_CLASS, VENOM_CLASS].includes(object.oclass)) {
        low = high = type;
    }
    return type >= low && type <= high ? [low, high] : [type, type];
}

// ---------------------------------------------------------------------------
// Object type calls. C refs: do_name.c objtyp_is_callable(), docall(),
// docall_xname().
// ---------------------------------------------------------------------------

// C do_name.c:objtyp_is_callable().
export function objectTypeIsCallable(object: Pick<GameObject, 'otyp' | 'oclass'>,
    state: GameState = game): boolean {
    if (state._objectCallNames?.[object.otyp]) return true;
    if (object.otyp === AMULET_OF_YENDOR || object.otyp === FAKE_AMULET_OF_YENDOR) return false;
    return [ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS, POTION_CLASS,
        SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, GEM_CLASS, VENOM_CLASS].includes(object.oclass)
        && !!OBJ_DESCR(object.otyp);
}

// Part of C do_name.c:docall(): stores the call name on the shared type.
export function recordObjectCall(otyp: number, name: string, state: GameState = game): void {
    if (!Number.isInteger(otyp) || otyp < 1 || !name) return;
    rememberType(otyp, state);
    if (!state._objectCallNames) state._objectCallNames = {};
    state._objectCallNames[otyp] = name;
}

// trycall() is intentionally narrower than the explicit #call command: it
// prompts only for a seen type which is neither formally known nor already
// called.  The consumed object can already be free; the call name belongs to
// its global type and remains after that identity is destroyed.
export type ObjectCallResult =
    | { prompted: boolean; named: false; callName: null }
    | { prompted: true; named: true; callName: string };

// C do_name.c:docall_xname().
// Also C o_init.c:undiscover_object(): inlined here when the call name is cleared.
export async function callObjectType(object: GameObject, state: GameState = game): Promise<ObjectCallResult> {
    if (!object.dknown) return { prompted: false, named: false, callName: null };
    // C docall() publishes buffered status before getlin() disables bot().
    await flush_screen(1);

    const sample = { ...object, quan: 1, quantity: 1, blessed: false, cursed: false };
    delete sample.oextra;
    delete sample.oname;
    delete sample.buc;
    if (sample.oclass === WEAPON_CLASS) sample.opoisoned = 0;
    else if (sample.oclass === POTION_CLASS) sample.odiluted = false;
    else if (sample.otyp === TOWEL || sample.otyp === STATUE) sample.spe = 0;
    else if (sample.otyp === TIN) sample.known = false;
    else if (sample.otyp === FIGURINE) sample.corpsenm = -1;
    else if (sample.otyp === HEAVY_IRON_BALL) sample.owt = objectBaseWeight(HEAVY_IRON_BALL) ?? sample.owt;
    else if (sample.oclass === FOOD_CLASS && sample.globby) sample.owt = 120;
    let prompt: string;
    if (object.oclass === POTION_CLASS && object.fromsink) {
        const appearance = OBJ_DESCR(object.otyp, state);
        prompt = `Call a stream of ${appearance} fluid:`;
    } else {
        // C docall_xname() observes the prompt's sample before player input.
        observeObjectForNaming(sample, { state });
        prompt = `Call ${withIndefiniteArticle(objectName(sample, state))}:`;
    }
    const callName = await playerName(prompt);
    if (callName === null)
        return { prompted: true, named: false, callName: null };
    if (!callName) {
        if (state._objectCallNames?.[object.otyp]) {
            delete state._objectCallNames[object.otyp];
            if (!objectTypeKnown(object, state) && !state._encounteredObjectTypes?.has(object.otyp)) {
                if (state._objectDiscoveryOrder?.includes(object.otyp))
                    state._objectDiscoveryOrder = state._objectDiscoveryOrder.filter(type => type !== object.otyp);
                else await impossible('named object not in disco', { state });
                if (object.oclass === GEM_CLASS) repriceDiscoveredGems(object.otyp, state);
            }
        }
        return { prompted: true, named: false, callName: null };
    }

    recordObjectCall(object.otyp, callName, state);
    recordObjectEncounter(object.otyp, state);
    return { prompted: true, named: true, callName };
}

// C do_name.c:namefloorobj().
export async function nameFloorObject(): Promise<void> {
    requirePlayingGame(game);
    const goal = `object on map (or '.' for one ${game.u.uundetected && heroFormHidesUnderObjects(game) ? 'over' : 'under'} you)`;
    const tip = await showGetposTip();
    if (game.flags.verbose) {
        const helpKey = game.commandBindings.specialKey('getpos.help');
        if (helpKey === undefined) throw new Error('Floor naming requires a getpos.help binding');
        await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
    }
    if (tip) await plineWithContinuation(`Move cursor to ${goal}:`);
    const selected = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy }, goal, force: false,
        prompt: game._pending_message,
    });
    if (!selected || selected.x < 0) return;
    const here = selected.x === game.u.ux && selected.y === game.u.uy;
    if (here) {
        const object = game.level.objects[selected.x]?.[selected.y]?.[0];
        if (object) await nameFloorType(object);
        else await plineWithContinuation("There doesn't seem to be any object under you.");
    } else {
        const result = await withMapObject(selected.x, selected.y,
            glyphAt(selected.x, selected.y), async object => {
                await nameFloorType(object);
                return true;
            });
        if (!result) await plineWithContinuation("There doesn't seem to be any object there.");
    }
}

// Part of C do_name.c:namefloorobj(): the hallucination / callable / dknown
// dispatch after the object is selected.
async function nameFloorType(object: GameObject): Promise<void> {
    const name = object.otyp === 0 ? 'strange object' : simpleObjectName(object);
    const plural = object.quan > 1;
    if (heroIsHallucinating(game)) {
        const female = Upolyd(game.u) ? game.u.mfemale : game.flags.female;
        const role = female && game.urole?.name.f || game.urole?.name.m || 'Player';
        const rank = rankOf(rn2Display(30) + 1, roleSwitch(game), !!game.flags.female, game);
        const bogus = randomBogusMonsterName();
        const choices = [role, rank, bogus, bogus, roguePlayerName(), 'Wibbly Wobbly'];
        const chosen = choices[rn2Display(choices.length)];
        if (chosen === undefined) throw new Error('Hallucinated floor naming selected a missing name');
        const subject = definiteName(name);
        await plineWithContinuation(`${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${plural ? 'decide' : 'decides'} to call you "${chosen}."`);
    } else if (!objectTypeIsCallable(object)) {
        await plineWithContinuation(`${plural ? 'Those' : 'That'} ${name} can't be assigned a type name.`);
    } else if (!object.dknown) {
        await plineWithContinuation(`You don't know ${plural ? 'those' : 'that'} ${name} well enough to name ${plural ? 'them' : 'it'}.`);
    } else {
        await callObjectType(object);
    }
}
