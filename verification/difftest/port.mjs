// Read the emitted modules through the same frozen overlays as scoring.
import '../../scripts/lib/frozen-adapters.mjs';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const changes = {
    create_object: ['mklev.js', 'const otmp = createObjectBase(otyp, nextIdent(), game.moves ?? 0);',
        'const otmp = createObjectBase(otyp, nextIdent(), game.moves ?? 0); otmp.spe = 100;'],
    creation_log: ['mklev.js', 'const otmp = createObjectBase(otyp, nextIdent(), game.moves ?? 0);',
        'const otmp = createObjectBase(otyp, nextIdent(), game.moves ?? 0); d(0, 1);'],
    create_class: ['mklev.js', 'const excludeNovel = oclass === SPBOOK_no_NOVEL;',
        'oclass = WEAPON_CLASS; const excludeNovel = oclass === SPBOOK_no_NOVEL;'],
    random_range: ['mklev.js', 'return first === last ? first : 0;',
        'return first === last ? first + 1 : 0;'],
    random_monster: ['mklev.js', 'return selected >= 0 ? selected : null;',
        'return selected >= 0 ? selected + 1 : null;'],
    monster_class: ['mklev.js', 'if ((choice -= weight) <= 0)\n            return mndx;',
        'if ((choice -= weight) <= 0)\n            return mndx + 1;'],
    monster_weapons: ['mklev.js', 'if (!initializeMonsterEquipment) {',
        'if (true) {'],
    monster_inventory: ['mklev.js', 'if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 12) {',
        'if (false) {'],
    stasis: ['teleport_rules.js', '&& stasisUntil >= (state?.moves ?? 1);',
        '&& stasisUntil > (state?.moves ?? 1);'],
    weight: ['weight.js', 'return base * quantity(object);', 'return base * quantity(object) + 1;'],
    capacity: ['weight.js', 'return inventoryWeight(state) - weightCapacity(state);',
        'return inventoryWeight(state) - weightCapacity(state) + 1;'],
    damage: ['weapon.js', 'return applyErosion(object, damage);',
        'return applyErosion(object, damage) + 1;'],
    accuracy: ['hero_attack_accuracy.js', 'threshold += 2;', 'threshold += 3;'],
    state: ['weapon.js', 'return applyErosion(object, damage);',
        'object.spe += 1; return applyErosion(object, damage);'],
    rng: ['weapon.js', 'return applyErosion(object, damage);',
        'rnd(1); return applyErosion(object, damage);'],
    log: ['weapon.js', 'return applyErosion(object, damage);',
        'd(0, 4); return applyErosion(object, damage);'],
    naming_plural: ['objnam.js', "return replacePluralSuffix(stem, '', 's') + excess;",
        "return replacePluralSuffix(stem, '', 'es') + excess;"],
    naming_singular: ['objnam.js', "return finish(replacePluralSuffix(stem, 'ies', 'y'));",
        "return finish(replacePluralSuffix(stem, 'ies', 'ye'));"],
    naming_an: ['objnam.js', "return 'aefhilmnosx'.includes(word.charAt(0)) ? 'an ' : 'a ';",
        "return 'aefhilmnos'.includes(word.charAt(0)) ? 'an ' : 'a ';"],
    naming_the: ['objnam.js', "if (!/^[A-Z]/u.test(name) || capitalizedMonsterTitle(name))\n        return `the ${name}`;",
        "if (!/^[A-Z]/u.test(name) || capitalizedMonsterTitle(name))\n        return `the  ${name}`;"],
    naming_bogus_titles: ['objnam.js', '...BOGUS_MONSTERS.flatMap(name => {',
        '...[].flatMap(name => {'],
    naming_xname: ['objnam.js', "noun = `pair of ${noun}`;", "noun = `two ${noun}`;"],
    naming_doname: ['objnam.js', "if (object.greased)\n        prefix.push('greased');",
        "if (object.greased)\n        prefix.push('sleazy');"],
    naming_monnam: ['do_name.js', "if (invisible)\n        adjectives += 'invisible ';",
        "if (invisible)\n        adjectives += 'unseen ';"],
    naming_string_draw: ['objnam.js', 'export function makePlural(value) {',
        "export function makePlural(value) {\n    rnd(1);"],
    naming_observe: ['objnam.js', 'observeObjectForNaming(object, { state });',
        ';'],
};
const mutation = process.env.DIFFTEST_MUTANT;
if (mutation) {
    const change = changes[mutation];
    if (!change) throw new Error(`Unknown difftest mutant: ${mutation}`);
    const [file, before, after] = change;
    const target = new URL(`../../js/${file}`, import.meta.url).href;
    registerHooks({ load(url, context, nextLoad) {
        if (url !== target) return nextLoad(url, context);
        const source = readFileSync(new URL(url), 'utf8');
        if (!source.includes(before)) throw new Error(`Mutant no longer applies: ${mutation}`);
        return { format: 'module', source: source.replaceAll(before, after), shortCircuit: true };
    } });
}

const data = await import('../../js/object_data.js');
const monsters = await import('../../js/monster_data.js');
const constants = await import('../../js/const.js');
const methods = await import('../../js/monster_attack_types.js');
const { objectClassForType } = await import('../../js/o_init.js');
const { armorSlotFor } = await import('../../js/armor.js');
const { BOGUS_MONSTERS } = await import('../../js/random_text_data.js');
if (process.argv.includes('--metadata')) {
    console.log(JSON.stringify({
        objects: {
            ...Object.fromEntries(data.OBJECT_NAMES.flatMap((name, index) =>
                name ? [[name.toUpperCase().replaceAll(' ', '_').replaceAll('-', '_'), index]] : [])),
            ...Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'number')),
        },
        weights: data.OBJECT_WEIGHT, nutrition: data.OBJECT_NUTRITION, merge: data.OBJECT_MERGE,
        initialKnown: data.OBJECT_INITIAL_KNOWN,
        wornSlots: Object.fromEntries([
            'W_ARM', 'W_WEP', 'W_QUIVER', 'W_SWAPWEP', 'W_AMUL',
            'W_RINGL', 'W_RINGR', 'W_TOOL', 'W_BALL', 'W_CHAIN',
        ].map(name => [name, constants[name]])),
        armorSlots: data.OBJECT_NAMES.map((_, index) => armorSlotFor(index)),
        classes: data.OBJECT_NAMES.map((_, index) => objectClassForType(index)), names: data.OBJECT_NAMES,
        monsterClasses: monsters.MONSTER_SYMBOL, specialPM: monsters.SPECIAL_PM,
        monsters: monsters.MONSTER_NAME, bodies: monsters.MONSTER_BODY_META,
        // do_name.c:bogusmon removes the optional classification prefix.
        bogusMonsters: BOGUS_MONSTERS.map(name =>
            '-_+|='.includes(name.charAt(0)) ? name.slice(1) : name),
        ironBallIncrement: constants.WT_IRON_BALL_INCR,
        methods: { weapon: methods.AT_WEAP, kick: methods.AT_KICK, bite: methods.AT_BITE },
    }));
    process.exit(0);
}

const { freshObjectRoom } = await import('../../test/support/object-room.js');
const { uninitializedObject } = await import('../../test/support/game-objects.js');
const { createMonsterAt } = await import('../../test/support/monsters.js');
const { installHeroWeaponSkills } = await import('../../test/support/hero-state.js');
const { setHeroSpecies } = await import('../../js/hero_species.js');
const stateModule = await import('../../js/gstate.js');
const { initRng, enableRngLog, getRngLog } = await import('../../js/rng.js');
const { isaac64_next_uint64 } = await import('../../js/isaac64.js');
const weight = await import('../../js/weight.js');
const { rollPhysicalWeaponDamage } = await import('../../js/weapon.js');
const { findHeroMeleeHitThreshold } = await import('../../js/hero_attack_accuracy.js');
const { wearHeroAccessory } = await import('../../js/accessory.js');
const { grantIntrinsicProperty } = await import('../../js/properties.js');
const accuracyRing = data.OBJECT_NAMES.indexOf('increase accuracy');

async function loadObject(description) {
    const contents = [];
    for (const content of description.contents) contents.push(await loadObject(content));
    const object = await uninitializedObject(description.otyp, {
        ...description, contents, blessed: !!description.blessed,
        cursed: !!description.cursed, globby: !!description.globby,
        quan: description.quan, quantity: description.quan,
    });
    for (const content of contents) {
        content.where = 'contained';
        content.container = object;
    }
    return object;
}

function saveObject(object) {
    return {
        otyp: object.otyp, quan: object.quan, owt: object.owt,
        corpsenm: object.corpsenm, oeaten: object.oeaten, spe: object.spe,
        blessed: Number(object.blessed), cursed: Number(object.cursed),
        globby: Number(object.globby), oeroded: object.oeroded, oeroded2: object.oeroded2,
        wornMask: object.owornmask ?? 0,
        where: object.where, containerType: object.container?.otyp ?? -1,
        contents: (object.contents ?? []).map(saveObject),
    };
}

function saveMonster(monster) {
    return Object.fromEntries(['mnum', 'mcanmove', 'msleeping', 'mstun', 'mflee']
        .map(key => [key, Number(monster[key])]));
}

function saveHero(game) {
    const hero = game.u;
    return { str: hero.acurr.a[0], dex: hero.acurr.a[3], con: hero.acurr.a[4],
        level: hero.ulevel, luck: hero.uluck, moreluck: hero.moreluck, hitinc: hero.uhitinc,
        trapped: hero.utrap, form: hero.mtimedone ? hero.umonnum : -1,
        levitating: Number(hero.levitating), flying: Number(hero.flying),
        legs: [undefined, 'left', 'right', 'both'].indexOf(hero._woundedLegSide),
        role: Number(game.urole.key === 'monk'),
        leftRing: game.uleft?.spe ?? -21, rightRing: game.uright?.spe ?? -21,
    };
}

// ISAAC64 produces 256 words per refill. Its generation counter and remaining
// word count give an absolute position, including calls hidden inside d().
function position(context) {
    return Number(context.c) * 256 - context.n;
}

async function runCase(input) {
    if (input.target >= 12) {
        const { runNaming } = await import('./naming.mjs');
        return runNaming(input);
    }
    if (input.target >= 6) {
        const { runCreation } = await import('./creation.mjs');
        return runCreation(input);
    }
    const hero = input.hero;
    const attributes = [hero.str, 12, 12, hero.dex, hero.con, 12];
    freshObjectRoom({ role: hero.role ? 'monk' : 'archeologist',
        recalculateVision: false,
        hero: { acurr: { a: attributes }, amax: { a: [...attributes] },
            uz: { dnum: 0, dlevel: 1 },
            ulevel: hero.level, uluck: hero.luck, moreluck: hero.moreluck,
            uhitinc: hero.hitinc, utrap: hero.trapped,
            ualign: { type: 0, record: 10 },
            _woundedLegSide: [undefined, 'left', 'right', 'both'][hero.legs],
        },
    });
    const { game } = stateModule;
    if (hero.form >= 0) {
        game.u.mtimedone = 100;
        game.u.mh = game.u.mhmax = 40;
        setHeroSpecies(hero.form, game);
    }
    // The serialized bits add outside sources. Form intrinsics and trap/float
    // blocks are established by the real initialization helpers on both sides.
    if (hero.levitating) grantIntrinsicProperty('levitation', 'outside');
    if (hero.flying) grantIntrinsicProperty('flying', 'outside');
    installHeroWeaponSkills(Object.fromEntries(
        Array.from({ length: constants.P_NUM_SKILLS }, (_, skill) => [skill, constants.P_BASIC])));
    game.inventory = [];
    for (const item of input.inventory) {
        const object = await loadObject(item);
        object.where = 'inventory';
        game.inventory.push(object);
    }
    const object = await loadObject(input.object);
    if (input.target === 5 && input.armed) {
        game.uwep = game.u.uwep = object;
        object.where = 'inventory'; object.owornmask = constants.W_WEP;
        game.inventory.push(object);
    }
    for (const [key, slot] of [['leftRing', 'uleft'], ['rightRing', 'uright']]) {
        if (hero[key] === -21) continue;
        const ring = await loadObject({ otyp: accuracyRing, quan: 1,
            owt: data.OBJECT_WEIGHT[accuracyRing], corpsenm: -1,
            oeaten: 0, spe: hero[key], blessed: 0, cursed: 0, globby: 0,
            oeroded: 0, oeroded2: 0, contents: [] });
        ring.where = 'inventory'; game.inventory.push(ring);
        await wearHeroAccessory(ring, slot);
    }
    const monster = await createMonsterAt(input.monster.mnum, 11, 10,
        constants.MM_NOGRP | constants.NO_MINVENT | constants.MM_ANGRY);
    for (const key of ['mnum', 'mcanmove', 'msleeping', 'mstun', 'mflee']) monster[key] = input.monster[key];
    monster.cham = -1; // Domain excludes shapechanger-specific silver handling.
    initRng(input.seed);
    for (let i = 0; i < input.position; i++) isaac64_next_uint64(game.coreCtx);
    const before = [position(game.coreCtx), position(game.displayCtx)];
    enableRngLog();
    let result, armorPenalty = 0;
    switch (input.target) {
    case 0: result = weight.objectWeight(object); break;
    case 1: result = weight.invWeight(game); break;
    case 2: result = weight.calcCapacity(game, input.extra); break;
    case 3: result = weight.nearCapacity(game); break;
    case 4: result = rollPhysicalWeaponDamage(object, monster); break;
    case 5: {
        const hit = await findHeroMeleeHitThreshold(monster, input.method,
            input.armed ? object : null, { firstAttack: input.attacks === 0 });
        result = hit.threshold; armorPenalty = hit.armorPenalty;
        break;
    }
    default: throw new Error(`Unknown target ${input.target}`);
    }
    return { result, armorPenalty, state: {
        object: [saveObject(object)], inventory: game.inventory.map(saveObject),
        hero: saveHero(game),
        alignment: game.u.ualign.record, monster: saveMonster(monster),
    }, rng: { core: position(game.coreCtx) - before[0],
        display: position(game.displayCtx) - before[1], log: [...getRngLog()] } };
}

// The Python entry point validates and fills the shared schema before either
// child sees it. A failed constructor/function is a harness error, never a pass.
for await (const line of createInterface({ input: process.stdin })) {
    try { console.log(JSON.stringify(await runCase(JSON.parse(line)))); }
    catch (error) { console.error(error); process.exit(2); }
}
