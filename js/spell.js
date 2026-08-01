// spell.js — Spell menus and the first live spell-casting path.
// C refs: spell.c dovspell(), docast(), spelleffects_check().

import { game } from './gstate.js';
import {
    flush_screen, pline, plineWithContinuation,
} from './display.js';
import { nhgetch } from './input.js';
import { NO_COLOR, ATR_INVERSE } from './terminal.js';
import { rnd, rn2, d } from './rng.js';
import { STRAT_APPEARMSG, STRAT_WAITFORU } from './const.js';
import {
    OBJECT_DELAY, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SPELL_CATEGORY,
    OBJECT_SPELL_LEVEL, OBJECT_WEIGHT, QUARTERSTAFF, ROBE, SMALL_SHIELD,
} from './object_data.js';
import { recordObjectKnowledge } from './object_knowledge.js';

const HEALING_SPELLS = new Set([
    'healing', 'extra healing', 'cure blindness', 'cure sickness',
    'restore ability', 'remove curse',
]);

const SPELL_SKILL = {
    restricted: 1,
    unskilled: 1,
    basic: 2,
    skilled: 3,
    expert: 4,
};

function isMetallic(object) {
    const material = object ? OBJECT_MATERIAL[object.otyp] : 0;
    return material >= 11 && material <= 17;
}

function castingStat(config) {
    // The live JS status vector uses display order: Str, Dex, Con, Int, Wis,
    // Cha.  Role metadata names the C casting statistic so this conversion
    // remains explicit at the boundary.
    const index = config.stat === 'wisdom' ? 4 : 3;
    return game.u?.acurr?.a?.[index] ?? 10;
}

function exerciseWisdom(improving = true, g = game) {
    const index = 4;
    const current = g.u?.acurr?.a?.[index] ?? 10;
    const amount = improving ? (rn2(19) > current ? 1 : 0) : -rn2(2);
    if (!Array.isArray(g.u._exercise)) g.u._exercise = Array(6).fill(0);
    g.u._exercise[index] += amount;
}

function spellbookDetails(book) {
    if (!book || book.oclass !== 10) return null;
    const name = book.spellName || OBJECT_NAMES[book.otyp];
    const level = book.spellLevel ?? OBJECT_SPELL_LEVEL[book.otyp];
    const category = book.spellCategory
        ?? OBJECT_SPELL_CATEGORY[book.otyp];
    if (!name || !Number.isInteger(level) || level < 1 || !category)
        return null;
    return { name, level, category, otyp: book.otyp };
}

function spellbookDelay({ level, otyp }) {
    const delay = OBJECT_DELAY[otyp] || 1;
    if (level <= 2) return -delay;
    if (level <= 4) return -(level - 1) * delay;
    if (level <= 6) return -level * delay;
    return -8 * delay;
}

function aggravateMonsters(g = game) {
    // C wizard.c:aggravate().  Failed spellbook comprehension owns this
    // common wake-up boundary; later monster movement must consume the
    // resulting live state rather than a replay-specific actor patch.
    for (const monster of g.level?.monsters || []) {
        if (!monster || (monster.mhp ?? 1) <= 0) continue;
        monster.mstrategy = (monster.mstrategy ?? 0)
            & ~(STRAT_WAITFORU | STRAT_APPEARMSG);
        monster.msleeping = 0;
        if (monster.mcanmove === 0 && rn2(5) === 0) {
            monster.mfrozen = 0;
            monster.mcanmove = 1;
        }
    }
}

function consumeSpellbook(book, g = game) {
    const quantity = book.quan ?? book.quantity ?? 1;
    if (quantity > 1) {
        book.quan = book.quantity = quantity - 1;
        return;
    }
    const index = (g.inventory || []).indexOf(book);
    if (index >= 0) g.inventory.splice(index, 1);
    book.where = 'gone';
}

function spellSkill(category, g = game) {
    return (g.urole?.key === 'wizard'
            && ['attack', 'enchantment'].includes(category))
        || ['healer', 'monk'].includes(g.urole?.key)
        || (g.urole?.key === 'priest' && category === 'clerical')
        ? 'basic' : 'unskilled';
}

function currentSpellKnowledge(spell, g = game) {
    if (!Number.isInteger(spell?.know)) return 0;
    return Math.max(0, spell.know - Math.max(0, (g.moves || 1) - 1));
}

async function askRefreshKnownSpell(details, g = game) {
    const known = `You know "${details.name}" quite well already.--More--`;
    await pline(known);
    await flush_screen(1);
    g.nhDisplay?.setCursor(known.length, 0);
    let dismissal;
    do dismissal = await nhgetch();
    while (dismissal !== 10 && dismissal !== 13);

    const prompt = 'Refresh your memory anyway? [yn] (n) ';
    await pline(prompt);
    await flush_screen(1);
    g.nhDisplay?.setCursor(prompt.length, 0);
    let answer;
    do answer = await nhgetch();
    while (![27, 10, 13, 89, 78, 121, 110].includes(answer));
    return answer === 89 || answer === 121;
}

// C refs: spell.c study_book() and learn().  Starting the study is one timed
// command; learn() then owns its negative delay through set_occupation().
// Monster movement and once-per-turn maintenance remain in allmain.js.
export async function studyBook(book, g = game) {
    const details = spellbookDetails(book);
    if (!details) {
        g.context.move = 0;
        return false;
    }
    Object.assign(book, {
        spellName: details.name,
        spellLevel: details.level,
        spellCategory: details.category,
    });

    const knownSpell = (g.spells || []).find(spell =>
        spell.otyp === details.otyp);
    if (knownSpell && currentSpellKnowledge(knownSpell, g) > 2000
        && !await askRefreshKnownSpell(details, g)) {
        g.context.move = 0;
        return false;
    }

    book.in_use = true;
    let tooHard = !!book.cursed;
    if (!book.blessed && !book.cursed) {
        const intelligence = g.u?.acurr?.a?.[3] ?? 10;
        const readAbility = intelligence + 4
            + Math.trunc((g.u?.ulevel ?? 1) / 2)
            - 2 * details.level;
        tooHard = rnd(20) > readAbility;
    }
    if (tooHard) {
        // C spell.c:cursed_book().  The name describes the bad-effect
        // transaction; an ordinary book which fails its comprehension roll
        // reaches it too.  Case one is the bounded live witness.
        const badEffect = rn2(details.level);
        if (badEffect === 1) {
            await pline('You feel threatened.');
            aggravateMonsters(g);
        }

        g._helplessTurns = Math.max(1, -spellbookDelay(details));
        g._helplessReason = 'reading a book';
        g._helplessDoneMessage = 'You can move again.';
        if (rn2(3) === 0) {
            await plineWithContinuation('The spellbook crumbles to dust!');
            consumeSpellbook(book, g);
        } else {
            book.in_use = false;
        }
        g.context.move = 1;
        return true;
    }

    book.in_use = false;
    await pline('You begin to memorize the runes.');
    g._occupation = {
        key: 'study-book',
        delay: spellbookDelay(details),
        book,
        details,
    };
    g.context.move = 1;
    return true;
}

// Returns the same truth value as C spell.c:learn(): true while the
// occupation remains installed, false after its completion.  The surrounding
// command scheduler owns the timed action for every invocation, including
// the completion invocation.
export async function continueSpellbookStudy(occupation, g = game) {
    if (occupation.delay) {
        occupation.delay++;
        g.context.move = 1;
        return true;
    }

    const { book, details } = occupation;
    exerciseWisdom(true, g);
    const spells = g.spells || (g.spells = []);
    let spell = spells.find(candidate => candidate.otyp === details.otyp);
    const typeKnown = g._knownObjectTypes?.has(details.otyp);
    const quotedName = typeKnown
        ? `"${details.name}"` : `the "${details.name}" spell`;

    if (spell) {
        spell.know = 20001 + Math.max(0, (g.moves || 1) - 1);
        book.spestudied = (book.spestudied || 0) + 1;
        exerciseWisdom(true, g);
        await plineWithContinuation(
            `Your knowledge of ${quotedName} is keener.`,
        );
    } else {
        spell = {
            name: details.name,
            level: details.level,
            category: details.category,
            skill: spellSkill(details.category, g),
            // JS keeps an absolute expiry anchor so spell-menu retention can
            // be derived from game.moves without duplicating age_spells().
            know: 20001 + Math.max(0, (g.moves || 1) - 1),
            retention: 100,
            fail: 0,
            otyp: details.otyp,
        };
        const index = spells.length;
        spells.push(spell);
        book.spestudied = (book.spestudied || 0) + 1;
        if (index === 0) {
            await plineWithContinuation(`You learn ${quotedName}.`);
        } else {
            await plineWithContinuation(
                `You add ${quotedName} to your repertoire, as '${
                    String.fromCharCode(97 + index)
                }'.`,
            );
        }
    }

    if (!typeKnown) {
        // makeknown() follows the learning message and credits Wisdom only on
        // the first discovery of this concrete spellbook type.
        exerciseWisdom(true, g);
        recordObjectKnowledge(details.otyp);
    }
    g.context.move = 1;
    return false;
}

export function percentSuccess(spell) {
    const config = game.urole?.spellcasting;
    if (!config) return 100 - (spell.fail ?? 0);

    const paladinBonus = game.urole?.key === 'knight'
        && spell.category === 'clerical';
    let splcaster = config.base;

    if (game.uarm && isMetallic(game.uarm) && !paladinBonus) {
        splcaster += game.uarmc?.otyp === ROBE
            ? Math.trunc(config.armor / 2) : config.armor;
    } else if (game.uarmc?.otyp === ROBE) {
        splcaster -= config.armor;
    }
    if (game.uarms) splcaster += config.shield;
    if (game.uwep?.otyp === QUARTERSTAFF) splcaster -= 3;

    if (!paladinBonus) {
        if (isMetallic(game.uarmh)) splcaster += 4;
        if (isMetallic(game.uarmg)) splcaster += 6;
        if (isMetallic(game.uarmf)) splcaster += 2;
    }

    if (spell.name === config.special) splcaster += config.specialBonus;
    if (HEALING_SPELLS.has(spell.name)) splcaster += config.healing;
    splcaster = Math.min(20, splcaster);

    let chance = Math.trunc(11 * castingStat(config) / 2);
    const skill = Math.max(SPELL_SKILL[spell.skill] ?? 1, 1) - 1;
    const level = Math.max(1, spell.level ?? 1);
    const heroLevel = game.u?.ulevel ?? 1;
    const difficulty = (level - 1) * 4
        - (skill * 6 + Math.trunc(heroLevel / 3) + 1);

    if (difficulty > 0) {
        chance -= Math.floor(Math.sqrt(900 * difficulty + 2000));
    } else {
        const learning = Math.trunc(15 * -difficulty / level);
        chance += Math.min(20, learning);
    }
    chance = Math.max(0, Math.min(120, chance));

    const shieldWeight = game.uarms
        ? (OBJECT_WEIGHT[game.uarms.otyp] ?? game.uarms.owt ?? 0) : 0;
    if (game.uarms && shieldWeight > OBJECT_WEIGHT[SMALL_SHIELD]) {
        chance = Math.trunc(chance
            / (spell.name === config.special ? 2 : 4));
    }

    chance = Math.trunc(chance * (20 - splcaster) / 15) - splcaster;
    return Math.max(0, Math.min(100, chance));
}

function putLine(col, row, text, attr = 0) {
    const display = game.nhDisplay;
    for (let i = 0; i < text.length && col + i < display.cols; i++)
        display.setCell(col + i, row, text[i], NO_COLOR, attr);
}

function clearMenu(left, bottom) {
    const display = game.nhDisplay;
    for (let row = 0; row <= bottom; row++)
        for (let col = row === 0 ? 0 : Math.max(0, left - 1);
            col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
}

function spellTurns(spell) {
    if (!Number.isInteger(spell.know)) return null;
    return Math.max(0, spell.know - Math.max(0, (game.moves || 1) - 1));
}

function spellRetention(spell) {
    const turns = spellTurns(spell);
    if (turns === null) return `${spell.retention ?? 100}%-100%`;
    if (turns >= 20000) return '100%';
    if (turns < 1) return '(gone)';
    const accuracy = spell.skill === 'expert' ? 2
        : spell.skill === 'skilled' ? 5
        : spell.skill === 'basic' ? 10 : 25;
    const percent = Math.ceil(turns / 200);
    const high = accuracy * Math.ceil(percent / accuracy);
    return `${high - accuracy + 1}%-${high}%`;
}

function spellLine(letter, spell, casting) {
    const name = spell.name.padEnd(23);
    const level = String(spell.level).padEnd(4);
    const category = spell.category.padEnd(13);
    const fail = `${100 - percentSuccess(spell)}%`.padStart(4);
    // spell.c uses "%9s" for retention, preceded by the format's one
    // separator space.  The padding matters for short "100%" values.
    const retention = ` ${spellRetention(spell).padStart(9)}`;
    const turns = game.flags?.debug && spellTurns(spell) !== null
        ? ` ${String(spellTurns(spell)).padStart(6)}` : '';
    return `${letter} - ${name}${level}${category}${fail}${retention}${turns}`;
}

async function spellMenu(casting) {
    const spells = game.spells || [];
    const sortable = !casting && game.urole?.key !== 'monk';
    const endRow = spells.length + (sortable ? 4 : 3);
    const menuLines = spells.map((spell, index) =>
        spellLine(String.fromCharCode(97 + index), spell, casting));
    const heading = `    Name                 Level Category     Fail Retention${
        game.flags?.debug ? '  turns' : ''}`;
    // tty menus reserve two columns after a non-selectable heading, while a
    // selectable row already owns one column of that gutter via its selector.
    // A three-digit failure rate can therefore grow a row by one without
    // shifting the whole window left.
    const windowWidth = Math.max(
        heading.length + 2,
        ...menuLines.map(line => line.length + 1),
    );
    const left = Math.max(0, game.nhDisplay.cols - windowWidth);
    clearMenu(left, endRow);
    putLine(left, 0, casting ? 'Choose which spell to cast' : 'Currently known spells', ATR_INVERSE);
    putLine(left, 2, heading);
    putLine(left, 2, '    Name', ATR_INVERSE);
    putLine(left + 25, 2, 'Level Category', ATR_INVERSE);
    putLine(left + 44, 2,
        `Fail Retention${game.flags?.debug ? '  turns' : ''}`, ATR_INVERSE);
    menuLines.forEach((line, index) => putLine(left, index + 3, line));
    if (sortable) putLine(left, spells.length + 3, '+ - [sort spells]');
    putLine(left, endRow, '(end)');
    game.nhDisplay.setCursor(left + 6, endRow);
    game._preserveLeadingStyledBlanks = true;
    try {
        return await nhgetch();
    } finally {
        game._preserveLeadingStyledBlanks = false;
    }
}

export async function docast() {
    if (!(game.spells || []).length) {
        await pline("You don't know any spells right now.");
        game.context.move = 0;
        return;
    }
    const selection = await spellMenu(true);
    const index = String.fromCharCode(selection).toLowerCase().charCodeAt(0) - 97;
    const spell = game.spells[index];
    if (!spell) {
        game.context.move = 0;
        return;
    }

    // spell.c:spelleffects_check().  Failure occurs before Wisdom exercise,
    // temporary spell-object construction, and direction input, but it still
    // spends one action and half the spell's normal energy.
    const energy = Math.max(5, (spell.level || 1) * 5);
    if (spell.name !== 'detect food') {
        const hungerCost = Math.min(
            energy * 2, Math.max(0, (game.u?.uhunger ?? 900) - 3),
        );
        game.u.uhunger = Math.max(3,
            (game.u?.uhunger ?? 900) - hungerCost);
    }
    const confused = !!(game.u?.confused
        || (game.u?.confusionTurns ?? 0) > 0);
    if (confused || rnd(100) > percentSuccess(spell)) {
        game.u.uen = Math.max(0,
            (game.u.uen || 0) - Math.trunc(energy / 2));
        await pline('You fail to cast the spell correctly.');
        game.context.move = 1;
        return;
    }

    // Successful spelleffects(): full energy, Wisdom exercise, then the
    // temporary pseudo-object used by directional wand-equivalent effects.
    game.u.uen = Math.max(0, (game.u.uen || 0) - energy);
    exerciseWisdom(true);
    rnd(2);
    await pline('In what direction? ');
    await flush_screen(1);
    game.nhDisplay.setCursor(19, 0);
    const direction = await nhgetch();
    if (direction === 27) {
        game.context.move = 0;
        return;
    }

    if (spell.name === 'healing') {
        d(6, 4);
        if (game.urole?.key === 'priest') {
            for (const known of game.spells) known.retention = 76;
        } else {
            spell.retention = 76;
        }
        await pline('You feel better.');
        game.context.move = 1;
        return;
    }
    game.context.move = 0;
}

export async function dovspell() {
    if (!(game.spells || []).length) {
        await pline("You don't know any spells right now.");
        game.context.move = 0;
        return;
    }
    // C tty select_menu(PICK_NONE) retains ownership after an invalid byte or
    // numeric prefix.  Re-rendering preserves the same overlay and cursor at
    // the next input boundary; only an explicit dismissal returns to rhack().
    let key;
    do {
        key = await spellMenu(false);
    } while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
    game._pending_message = '';
    game.context.move = 0;
}
