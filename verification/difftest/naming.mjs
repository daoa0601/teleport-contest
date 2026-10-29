// Call the emitted naming functions. This module only loads and projects state.
import { freshObjectRoom } from '../../test/support/object-room.js';
import { game } from '../../js/gstate.js';
import { initRng, enableRngLog, getRngLog } from '../../js/rng.js';
import { isaac64_next_uint64 } from '../../js/isaac64.js';
import { grantIntrinsicProperty } from '../../js/properties.js';
import { uninitializedObject } from '../../test/support/game-objects.js';
import { createMonsterAt } from '../../test/support/monsters.js';
import { makePlural, makeSingular, withIndefiniteArticle } from '../../js/object_grammar.js';
import { objectCombatName, objectAction, definiteName, observeObjectForNaming } from '../../js/objnam.js';
import { objectDescription } from '../../js/object_description.js';
import { monsterName, namelessMonsterName } from '../../js/monster_name.js';
import { oinit } from '../../js/mklev.js';
import { W_SADDLE, MM_ANGRY, NO_MINVENT } from '../../js/const.js';

const ROLES = ['archeologist', 'monk', 'priest', 'samurai'];
const SUPPRESS_IT = 0x01;
const SUPPRESS_INVISIBLE = 0x02;
const SUPPRESS_HALLUCINATION = 0x04;
const SUPPRESS_SADDLE = 0x08;
const EXACT_NAME = 0x1F;
const SUPPRESS_NAME = 0x20;
const AUGMENT_IT = 0x40;

export async function runNaming(input) {
    if (input.target < 15) {
        // Pure string functions; the empty fruit registry matches C's empty
        // ffruit list. The stream is measured like every other target, so an
        // accidental draw in the string grammar fails the comparison.
        game.fruits = [];
        initRng(input.seed);
        for (let i = 0; i < input.position; i++) isaac64_next_uint64(game.coreCtx);
        const before = [position(game.coreCtx), position(game.displayCtx)];
        enableRngLog();
        const result = input.target === 12 ? makePlural(input.text)
            : input.target === 13 ? makeSingular(input.text)
                : withIndefiniteArticle(input.text);
        return { result, ...(input.target === 14 ? { the: definiteName(input.text, game) } : {}),
            rng: namingRng(before) };
    }
    if (input.target === 17)
        return monsterNaming(input);
    return objectNaming(input);
}

async function loadNamingObject(description, contents = []) {
    const object = await uninitializedObject(description.otyp, {
        typeKnown: false,
        ...description,
        contents,
        blessed: !!description.blessed,
        cursed: !!description.cursed,
        globby: !!description.globby,
        known: !!description.known,
        dknown: !!description.dknown,
        bknown: !!description.bknown,
        rknown: !!description.rknown,
        lknown: !!description.lknown,
        cknown: !!description.cknown,
        tknown: !!description.tknown,
        oerodeproof: !!description.oerodeproof,
        greased: !!description.greased,
        otrapped: !!description.otrapped,
        obroken: !!description.obroken,
        olocked: !!description.olocked,
        odiluted: !!description.odiluted,
        opoisoned: !!description.opoisoned,
        lamplit: !!description.lamplit,
        oname: description.oname === '' ? undefined : description.oname,
        quan: description.quan,
        quantity: description.quan,
        spe: description.spe,
        owt: description.owt,
        oeaten: description.oeaten,
        corpsenm: description.corpsenm,
        oeroded: description.oeroded,
        oeroded2: description.oeroded2,
        owornmask: description.wornMask,
    });
    for (const content of contents) {
        content.where = 'contained';
        content.container = object;
    }
    return object;
}

async function namingObjectTree(description) {
    const contents = [];
    for (const child of description.contents)
        contents.push(await namingObjectTree(child));
    return await loadNamingObject(description, contents);
}

async function objectNaming(input) {
    const hero = input.hero;
    freshObjectRoom({ role: ROLES[hero.role], recalculateVision: false,
        hero: { uz: { dnum: 0, dlevel: 1 }, ulevel: 8, ualign: { type: 0, record: 10 } } });
    oinit();
    game.fruits = input.fruits.map((name, index) => ({ fid: index + 1, fname: name }));
    game.context.current_fruit = input.fruits.length ? 1 : 0;
    game.flags.implicit_uncursed = !!hero.implicitUncursed;
    game.iflags.partly_eaten_hack = !!hero.partlyEatenHack;
    if (hero.blind) game.u.blindTurns = 100;
    const object = await namingObjectTree(input.object);
    const discovery = input.discovery;
    game._knownObjectTypes = new Set(discovery.nameKnown ? [object.otyp] : []);
    if (discovery.callName !== undefined)
        game._objectCallNames = { [object.otyp]: discovery.callName };
    initRng(input.seed);
    for (let i = 0; i < input.position; i++) isaac64_next_uint64(game.coreCtx);
    const before = [position(game.coreCtx), position(game.displayCtx)];
    enableRngLog();
    // C xname() observes the object itself; the port splits observation out.
    observeObjectForNaming(object, { state: game });
    if (input.target === 15) {
        const base = objectCombatName(object, { state: game, includeCorpseSpecies: false });
        return { result: base, an: withIndefiniteArticle(base),
            the: definiteName(base, game), aobjnam: objectAction(object, null, game),
            state: namingState(object),
            rng: namingRng(before) };
    }
    const result = await objectDescription(object, { state: game });
    return { result, state: namingState(object), rng: namingRng(before) };
}

function namingState(object) {
    return { known: Number(!!object.known), dknown: Number(!!object.dknown),
        bknown: Number(!!object.bknown), corpsenm: object.corpsenm ?? -1 };
}

function namingRng(before) {
    return { core: position(game.coreCtx) - before[0],
        display: position(game.displayCtx) - before[1], log: [...getRngLog()] };
}

async function monsterNaming(input) {
    const hero = input.hero, monsterInput = input.monster;
    freshObjectRoom({ role: ROLES[hero.role], recalculateVision: false,
        hero: { uz: { dnum: 0, dlevel: 1 }, ulevel: 8, ualign: { type: 0, record: 10 } } });
    if (hero.blind) game.u.blindTurns = 100;
    if (hero.detect) grantIntrinsicProperty('detectMonsters', 'outside');
    if (hero.seeInvis) grantIntrinsicProperty('seeInvisible', 'outside');
    const monster = await createMonsterAt(monsterInput.mnum, 11, 10, MM_ANGRY | NO_MINVENT);
    // Some shapeshifter species arrive polymorphed; naming describes the
    // requested species, exactly like the C struct built from mons[mnum].
    monster.mnum = monsterInput.mnum;
    monster.female = !!monsterInput.female;
    monster.minvis = !!monsterInput.minvis;
    monster.mtame = !!monsterInput.mtame;
    monster.mpeaceful = !!monsterInput.mpeaceful;
    monster.m_lev = monsterInput.m_lev;
    monster.cham = -1;
    monster.misc_worn_check = monsterInput.saddle ? W_SADDLE : 0;
    // The naming layer owns every flag C's caller would have set: strip the
    // constructor's priest/minion/ghost-name state and apply the input's.
    monster.ispriest = false;
    monster.isminion = false;
    monster.mgivenname = '';
    if (monster.mextra) {
        delete monster.mextra.mgivenname;
        delete monster.mextra.emin;
        delete monster.mextra.epri;
    }
    if (monsterInput.mgivenname !== '')
        monster.mextra = { ...(monster.mextra ?? {}), mgivenname: monsterInput.mgivenname };
    if (monsterInput.isshk) {
        monster.isshk = true;
        monster.eshk = { ...(monster.eshk ?? {}), shknam: monsterInput.shkName };
    }
    if (monsterInput.ispriest) {
        monster.ispriest = true;
        monster.epri = { shralign: monsterInput.priestAlign };
    }
    initRng(input.seed);
    for (let i = 0; i < input.position; i++) isaac64_next_uint64(game.coreCtx);
    const before = [position(game.coreCtx), position(game.displayCtx)];
    enableRngLog();
    const article = ['none', 'the', 'a', 'your'][input.article];
    const suppress = input.suppress;
    const exact = (suppress & EXACT_NAME) === EXACT_NAME;
    const common = { suppressIt: !!(suppress & SUPPRESS_IT),
        suppressInvisible: !!(suppress & SUPPRESS_INVISIBLE),
        suppressHallucination: !!(suppress & SUPPRESS_HALLUCINATION),
        suppressSaddle: !!(suppress & SUPPRESS_SADDLE) };
    let result;
    if (suppress & SUPPRESS_NAME) {
        result = namelessMonsterName(monster, { state: game, article, ...common });
    } else {
        result = monsterName(monster, { state: game, article,
            adjective: input.adjective, called: !!input.called,
            augmentIt: !!(suppress & AUGMENT_IT), exact, ...common });
    }
    return { result, rng: namingRng(before) };
}

function position(context) {
    return Number(context.c) * 256 - context.n;
}
