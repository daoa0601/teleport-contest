// Object creation and species-dependent initialization.
// C ref: mkobj.c.
import { createObjectBase } from './object_constructor.js';
import { game, requireLiveGame } from './gstate.js';
import { novelTitle } from './novel_titles.js';
import { setTinVariety } from './tin.js';
import { relocateObjectRandomly } from './object_teleport.js';
import { nextIdent } from './ident.js';
import { erosionMatters, objectIsVulnerableToErosion } from './object_erosion.js';
import { eggSpeciesIsDead, hatchableEggSpecies } from './egg_species.js';
import { attachFigurineTimer } from './figurine_timer.js';
import { placeCreatedObject } from './floor_object.js';
import { rn2, rnd, rn1, rne, rnz } from './rng.js';
import { depth as depth_of_level } from './hacklib.js';
import { level_difficulty } from './dungeon.js';
import { In_quest, Is_rogue_level, isok, G_GONE, G_NOCORPSE, ROT_AGE, TROLL_REVIVE_CHANCE, RANDOM_TIN, MAX_OIL_IN_FLASK, CORPSTAT_FEMALE, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_INIT, CORPSTAT_SPE_VAL, } from './const.js';
import { getObjectClassBounds, getObjectDefinition, requireObjectData, OBJECT_COST, WORM_TOOTH, UNICORN_HORN, HELM_OF_OPPOSITE_ALIGNMENT, GAUNTLETS_OF_FUMBLING, FUMBLE_BOOTS, LEVITATION_BOOTS, AMULET_OF_STRANGULATION, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_CHANGE, AMULET_OF_YENDOR, LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING, BAG_OF_TRICKS, TALLOW_CANDLE, WAX_CANDLE, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP, EXPENSIVE_CAMERA, CRYSTAL_BALL, TINNING_KIT, CAN_OF_GREASE, FIGURINE, MAGIC_MARKER, MAGIC_FLUTE, FROST_HORN, FIRE_HORN, HORN_OF_PLENTY, MAGIC_HARP, DRUM_OF_EARTHQUAKE, CORPSE, EGG, MEAT_RING, GLOB_OF_GRAY_OOZE, GLOB_OF_BLACK_PUDDING, KELP_FROND, SLIME_MOLD, CANDY_BAR, TIN, GOLD_PIECE, SPE_NOVEL, DILITHIUM_CRYSTAL, LUCKSTONE, LOADSTONE, ROCK, STATUE, SPLINT_MAIL, WAN_CANCELLATION, WAN_LIGHT, WAN_LIGHTNING, objectDirection, POT_OIL, BELL_OF_OPENING, } from './object_data.js';
import { MONSTER_BODY_META, MONSTER_GENO, MONSTER_FLAGS2, MONSTER_SYMBOL, MONSTER_SIZE, MONSTER_NAME, SPECIAL_PM, requireMonsterData, } from './monster_data.js';
import { isReviver, isRider, zombieForm } from './corpse_species.js';
import { saveMonsterTraits } from './monster_traits.js';
import { artifactExistCount, createRandomArtifact } from './artifacts.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopAllObjectTimers, stopObjectTimer, } from './object_timers.js';
import { objectWeight } from './weight.js';
import { curseObjectState } from './object_state.js';
import { isMultiGeneratedWeapon, isPoisonableObject } from './object_properties.js';
import { rndmonstAdj } from './makemon.js';
import { addCreatedObjectToContainer } from './object_container.js';
import { objectProb } from './o_init.js';
import { nameObjectFromTopten } from './topten.js';
import { rndClass } from './objnam.js';
import { undeadToCorpse } from './mon.js';
import { attachEggHatchTimer } from './egg.js';
import { assignCandyWrapper } from './object_inscription.js';
const RANDOM_CLASS = 0;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const G_NOGEN = 0x0200;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const ROCK_CLASS = 14;
const SPBOOK_no_NOVEL = -SPBOOK_CLASS;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const M2_HUMAN = 0x00000008;
// C mkobj.c:blessorcurse().
function blessorcurse(otmp, chance = 10) {
    if (!otmp || otmp.blessed || otmp.cursed)
        return;
    if (!rn2(chance)) {
        if (!rn2(2))
            otmp.cursed = true;
        else
            otmp.blessed = true;
    }
}
// C ref: mkobj.c mksobj — create a specific object.
export async function mksobj(otyp, init, artif, { zombify = false } = {}) {
    const definition = getObjectDefinition(otyp);
    const otmp = createObjectBase(otyp, nextIdent(), game.moves ?? 0);
    if (init) {
        await mksobj_init(otmp, artif, definition);
    }
    // Fuel is intrinsic to an oil flask even when random initialization is skipped.
    if (otyp === POT_OIL)
        otmp.age = MAX_OIL_IN_FLASK;
    if (otyp === CORPSE || otyp === STATUE || otyp === FIGURINE) {
        if (otmp.corpsenm == null) {
            otmp.corpsenm = rndmonnum();
            if (otyp === CORPSE) {
                otmp.corpsenm = undeadToCorpse(otmp.corpsenm);
                if ((game.mvitals?.[otmp.corpsenm]?.mvflags ?? 0) & (G_NOCORPSE | G_GONE)) {
                    if (!game.urole)
                        throw new Error('Corpse fallback requires the hero role');
                    otmp.corpsenm = SPECIAL_PM + 1 + game.urole.mnum;
                }
            }
        }
        // mkobj.c:mksobj() stores corpse sex in spe. Stack admission and
        // later revival both read those bits, including for statues/figurines.
        const species = otmp.corpsenm;
        if (species === undefined)
            throw new Error('Body object requires a monster species');
        const genderFlags = MONSTER_FLAGS2[species] || 0;
        otmp.spe = genderFlags & 0x40000 ? CORPSTAT_NEUTER
            : genderFlags & 0x20000 ? CORPSTAT_FEMALE
                : genderFlags & 0x10000 ? CORPSTAT_MALE
                    : rn2(2) ? CORPSTAT_FEMALE : CORPSTAT_MALE;
        if (otyp === CORPSE)
            startCorpseTimeout(otmp, { zombify });
    }
    if (otyp === EGG && (otmp.corpsenm ?? -1) >= 0) {
        attachEggHatchTimer(otmp);
    }
    if (otyp === SPE_NOVEL) {
        // mkobj.c:mksobj() names every novel after class initialization.
        // The title index is persistent object identity even when only the
        // floor glyph is currently visible.
        otmp.novelidx = -1;
        const title = novelTitle(otmp);
        if (title === undefined)
            throw new Error('Novel title selection requires a title');
        otmp.oextra = { ...(otmp.oextra || {}), oname: title };
    }
    // C mkobj.c:mksobj() computes weight only after type-specific state,
    // quantities, corpse identity, timers, and generated contents are final.
    otmp.owt = objectWeight(otmp);
    return otmp;
}
// C mkobj.c:bcsign().
function bcsign(otmp) {
    return Number(!!otmp.blessed) - Number(!!otmp.cursed);
}
function mayGenerateEroded(otmp) {
    // C ref: mkobj.c:may_generate_eroded(): starting inventory is pristine, while
    // objects produced by mklev on move zero may still be damaged.
    if ((game.moves ?? 0) <= 1 && !game.in_mklev)
        return false;
    if (otmp.oerodeproof || otmp.oartifact || otmp.otyp === WORM_TOOTH || otmp.otyp === UNICORN_HORN)
        return false;
    if (!erosionMatters(otmp))
        return false;
    return objectIsVulnerableToErosion(otmp, 'rust')
        || objectIsVulnerableToErosion(otmp, 'burn')
        || objectIsVulnerableToErosion(otmp, 'rot')
        || objectIsVulnerableToErosion(otmp, 'corrosion')
        || objectIsVulnerableToErosion(otmp, 'crack');
}
// C mkobj.c:mkobj_erosions().
function mkobjErosions(otmp) {
    if (!mayGenerateEroded(otmp))
        return;
    if (!rn2(100)) {
        otmp.oerodeproof = true;
    }
    else {
        const primary = !rn2(80);
        if (primary && (objectIsVulnerableToErosion(otmp, 'burn')
            || objectIsVulnerableToErosion(otmp, 'rust')
            || objectIsVulnerableToErosion(otmp, 'crack'))) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9))
                erosion++;
            otmp.oeroded = erosion;
        }
        const secondary = !rn2(80);
        if (secondary && (objectIsVulnerableToErosion(otmp, 'rot')
            || objectIsVulnerableToErosion(otmp, 'corrosion'))) {
            let erosion = 1;
            while (erosion < 3 && !rn2(9))
                erosion++;
            otmp.oeroded2 = erosion;
        }
    }
    if (!rn2(1000))
        otmp.greased = true;
}
// C mkobj.c:mksobj_init().
async function mksobj_init(otmp, artif, definition) {
    const otyp = otmp.otyp;
    switch (otmp.oclass) {
        case WEAPON_CLASS:
            if (isMultiGeneratedWeapon(otmp))
                otmp.quan = rn1(6, 6);
            if (!rn2(11)) {
                otmp.spe = rne(3);
                otmp.blessed = !!rn2(2);
            }
            else if (!rn2(10)) {
                otmp.cursed = true;
                otmp.spe = -rne(3);
            }
            else {
                blessorcurse(otmp, 10);
            }
            if (isPoisonableObject(otmp))
                otmp.opoisoned = rn2(100) === 0;
            if (artif && !rn2(20 + 10 * artifactExistCount()))
                createRandomArtifact(otmp);
            break;
        case ARMOR_CLASS:
            if (rn2(10)
                && (otyp === FUMBLE_BOOTS || otyp === LEVITATION_BOOTS
                    || otyp === HELM_OF_OPPOSITE_ALIGNMENT
                    || otyp === GAUNTLETS_OF_FUMBLING || !rn2(11))) {
                otmp.cursed = true;
                otmp.spe = -rne(3);
            }
            else if (!rn2(10)) {
                otmp.blessed = !!rn2(2);
                otmp.spe = rne(3);
            }
            else {
                blessorcurse(otmp, 10);
            }
            if (artif && !rn2(40 + 10 * artifactExistCount()))
                createRandomArtifact(otmp);
            // Native lacquer protects Samurai armor created at startup or
            // anywhere in the hero's quest, including armor carried by monsters.
            if (game.urole?.key === 'samurai' && otmp.otyp === SPLINT_MAIL
                && (game.moves <= 1 || In_quest(game.u.uz))) {
                otmp.oerodeproof = true;
                otmp.rknown = true;
            }
            break;
        case RING_CLASS:
            if (definition.charged) {
                blessorcurse(otmp, 3);
                if (rn2(10)) {
                    if (rn2(10) && bcsign(otmp)) {
                        otmp.spe = bcsign(otmp) * rne(3);
                    }
                    else {
                        otmp.spe = (rn2(2) ? 1 : -1) * rne(3);
                    }
                }
                if (otmp.spe === 0)
                    otmp.spe = rn2(4) - rn2(3);
                if (otmp.spe < 0 && rn2(5))
                    curseObjectState(otmp);
            }
            else if (rn2(10)
                && (otyp === 194 || otyp === 196 || otyp === 185
                    || otyp === 184 || !rn2(9))) {
                otmp.cursed = true;
            }
            break;
        case AMULET_CLASS:
            if (otyp === AMULET_OF_YENDOR)
                game.context.made_amulet = true;
            if (rn2(10) && (otyp === AMULET_OF_STRANGULATION
                || otyp === AMULET_OF_CHANGE
                || otyp === AMULET_OF_RESTFUL_SLEEP))
                otmp.cursed = true;
            else
                blessorcurse(otmp, 10);
            break;
        case FOOD_CLASS:
            if (otyp === CORPSE) {
                let tries = 50;
                do {
                    otmp.corpsenm = undeadToCorpse(rndmonnum());
                } while (((MONSTER_GENO[otmp.corpsenm] ?? 0) & 0x0010)
                    && --tries > 0);
                if (!tries)
                    otmp.corpsenm = 260; // PM_HUMAN fallback
            }
            else if (otyp === EGG) {
                otmp.corpsenm = -1; // NON_PM: generic egg
                if (!rn2(3)) {
                    // C ref: mkobj.c EGG initialization. Try up to 200 random
                    // monsters. Every failed rndmonnum() call still advances the
                    // gameplay RNG.
                    for (let tries = 200; tries > 0; tries--) {
                        const mndx = hatchableEggSpecies(rndmonnum());
                        if (mndx !== -1 && !eggSpeciesIsDead(mndx)) {
                            otmp.corpsenm = mndx;
                            break;
                        }
                    }
                }
            }
            else if (otyp === TIN) {
                otmp.corpsenm = -1;
                if (rn2(6)) {
                    // mkobj.c retries up to 200 times until the selected corpse
                    // has nutrition and is allowed to leave a corpse.
                    for (let tries = 200; tries > 0; tries--) {
                        const mndx = undeadToCorpse(rndmonnum());
                        const nutrition = MONSTER_BODY_META[mndx]?.[1] ?? 0;
                        if (!nutrition || ((MONSTER_GENO[mndx] ?? 0) & 0x0010))
                            continue;
                        otmp.corpsenm = mndx;
                        setTinVariety(otmp, RANDOM_TIN);
                        break;
                    }
                }
                else
                    otmp.spe = 1;
                blessorcurse(otmp, 10);
            }
            else if (otyp >= GLOB_OF_GRAY_OOZE
                && otyp <= GLOB_OF_BLACK_PUDDING) {
                // mkobj.c:mksobj_init() constructs globs as one variable-weight
                // identity and immediately starts their first 23..27-turn timer.
                otmp.globby = true;
                otmp.quan = otmp.quantity = 1;
                otmp.owt = definition.weight;
                otmp.known = otmp.dknown = true;
                otmp.corpsenm = 206 + (otyp - GLOB_OF_GRAY_OOZE);
                scheduleObjectTimer(otmp, OBJECT_TIMER_KIND.SHRINK_GLOB, (game.moves ?? 0) + 23 + rn2(5), game);
            }
            else if (otyp === SLIME_MOLD) {
                const fruit = game.context.current_fruit;
                if (fruit === undefined)
                    throw new Error('Slime mold creation requires a current fruit');
                otmp.spe = fruit;
                game.flags.made_fruit = true;
            }
            else if (otyp === KELP_FROND) {
                otmp.quan = rnd(2);
            }
            else if (otyp === CANDY_BAR) {
                assignCandyWrapper(otmp);
            }
            if (otyp !== CORPSE && otyp !== MEAT_RING && otyp !== KELP_FROND
                && !(otyp >= GLOB_OF_GRAY_OOZE
                    && otyp <= GLOB_OF_BLACK_PUDDING))
                if (!rn2(6))
                    otmp.quan = 2;
            break;
        case GEM_CLASS:
            if (otyp === LOADSTONE)
                otmp.cursed = true;
            else if (otyp === ROCK)
                otmp.quan = rn1(6, 6);
            else if (otyp !== LUCKSTONE && !rn2(6))
                otmp.quan = 2;
            break;
        case TOOL_CLASS:
            await initTool(otmp);
            break;
        case POTION_CLASS:
        case SCROLL_CLASS:
            // MAIL_STRUCTURES: stamped scrolls of mail bypass ordinary random BUC
            // initialization; readobjnam() marks a wished one via spe afterward.
            if (otyp !== 364)
                blessorcurse(otmp, 4);
            break;
        case SPBOOK_CLASS:
            blessorcurse(otmp, 17);
            break;
        case WAND_CLASS:
            if (otyp === 414)
                otmp.spe = 1;
            else if (otyp === 415)
                otmp.spe = rn1(4, 3);
            else
                otmp.spe = rn1(5, objectDirection(otyp, game) === 1 ? 11 : 4);
            blessorcurse(otmp, 17);
            break;
        case ROCK_CLASS:
            if (otyp === STATUE) {
                otmp.corpsenm = rndmonnum();
                if ((MONSTER_SIZE[otmp.corpsenm] || 0) >= 1
                    && rn2(Math.trunc(level_difficulty() / 2) + 10) > 10) {
                    // Ordinary initialized statues can contain one non-novel
                    // spellbook.  A Lua `contents` field clears this object only
                    // after its complete constructor has consumed RNG.
                    await addCreatedObjectToContainer(otmp, await mkobj(SPBOOK_no_NOVEL, false));
                }
            }
            break;
    }
    mkobjErosions(otmp);
}
// C mkobj.c:mksobj_init(), TOOL_CLASS branch.
async function initTool(otmp) {
    const otyp = otmp.otyp;
    if (otyp === TALLOW_CANDLE || otyp === WAX_CANDLE) {
        otmp.spe = 1;
        otmp.age = 20 * requireObjectData(OBJECT_COST, otyp);
        otmp.lamplit = false;
        otmp.quan = 1 + (rn2(2) ? rn2(7) : 0);
        blessorcurse(otmp, 5);
    }
    else if (otyp === BRASS_LANTERN || otyp === OIL_LAMP) {
        otmp.spe = 1;
        otmp.age = rn1(500, 1000);
        otmp.lamplit = false;
        blessorcurse(otmp, 5);
    }
    else if (otyp === MAGIC_LAMP) {
        otmp.spe = 1;
        otmp.lamplit = false;
        blessorcurse(otmp, 2);
    }
    else if (otyp === CHEST || otyp === LARGE_BOX) {
        otmp.olocked = !!rn2(5);
        otmp.otrapped = !rn2(10);
        otmp.tknown = otmp.otrapped && !rn2(100);
        await mkboxCnts(otmp);
    }
    else if (otyp === ICE_BOX || otyp === SACK || otyp === OILSKIN_SACK
        || otyp === BAG_OF_HOLDING) {
        await mkboxCnts(otmp);
    }
    else if (otyp === EXPENSIVE_CAMERA || otyp === TINNING_KIT
        || otyp === MAGIC_MARKER) {
        otmp.spe = rn1(70, 30);
    }
    else if (otyp === CAN_OF_GREASE) {
        otmp.spe = rn1(21, 5);
        blessorcurse(otmp, 10);
    }
    else if (otyp === CRYSTAL_BALL) {
        otmp.spe = rn1(5, 3);
        blessorcurse(otmp, 2);
    }
    else if (otyp === HORN_OF_PLENTY || otyp === BAG_OF_TRICKS) {
        otmp.spe = rn1(18, 3);
    }
    else if (otyp === FIGURINE) {
        // C mkobj.c:mksobj_init(): figurines deliberately select from a
        // harder band than ordinary corpses/statues and reject human forms
        // through a bounded post-check retry.  Store the chosen identity so
        // mksobj()'s shared corpse/statue/figurine tail only assigns gender.
        let tryCount = 0;
        do {
            otmp.corpsenm = rndmonnumAdj(5, 10);
        } while (((MONSTER_FLAGS2[otmp.corpsenm] ?? 0) & M2_HUMAN)
            && tryCount++ < 30);
        blessorcurse(otmp, 4);
    }
    else if (otyp === BELL_OF_OPENING) {
        otmp.spe = 3;
    }
    else if (otyp === MAGIC_FLUTE || otyp === MAGIC_HARP
        || otyp === FROST_HORN || otyp === FIRE_HORN
        || otyp === DRUM_OF_EARTHQUAKE) {
        otmp.spe = rn1(5, 4);
    }
}
// C ref: mkobj.c mkbox_cnts().
async function mkboxCnts(box) {
    let maximum;
    if (box.otyp === ICE_BOX)
        maximum = 20;
    else if (box.otyp === CHEST)
        maximum = box.olocked ? 7 : 5;
    else if (box.otyp === LARGE_BOX)
        maximum = box.olocked ? 5 : 3;
    else if (box.otyp === SACK || box.otyp === OILSKIN_SACK) {
        maximum = ((game.moves ?? 0) <= 1 && !game.in_mklev) ? 0 : 1;
    }
    else if (box.otyp === BAG_OF_HOLDING)
        maximum = 1;
    else
        maximum = 0;
    box.contents = [];
    const classProbs = [[18, GEM_CLASS], [15, FOOD_CLASS], [18, POTION_CLASS],
        [18, SCROLL_CLASS], [12, SPBOOK_CLASS], [7, COIN_CLASS],
        [6, WAND_CLASS], [5, RING_CLASS], [1, AMULET_CLASS]];
    for (let count = rn2(maximum + 1); count > 0; count--) {
        let content;
        if (box.otyp === ICE_BOX) {
            content = await mksobj(CORPSE, true, false);
            content.age = 0;
            stopAllObjectTimers(content);
        }
        else {
            let roll = rnd(100);
            let objectClass = AMULET_CLASS;
            for (const [probability, candidate] of classProbs) {
                roll -= probability;
                if (roll <= 0) {
                    objectClass = candidate;
                    break;
                }
            }
            content = await mkobj(objectClass, false);
            if (content.oclass === COIN_CLASS) {
                content.quan = rnd(level_difficulty() + 2) * rnd(75);
                content.quantity = content.quan;
                content.owt = objectWeight(content);
            }
            else
                while (content.otyp === ROCK) {
                    content.otyp = rndClass(DILITHIUM_CRYSTAL, LOADSTONE);
                    if (content.quan > 2)
                        content.quan = 1;
                    content.quantity = content.quan;
                    content.owt = objectWeight(content);
                }
            if (box.otyp === BAG_OF_HOLDING) {
                if (content.otyp === BAG_OF_HOLDING
                    || content.otyp === BAG_OF_TRICKS) {
                    content.otyp = SACK;
                    content.spe = 0;
                    content.owt = objectWeight(content);
                }
                else {
                    while (content.otyp === WAN_CANCELLATION) {
                        content.otyp = rndClass(WAN_LIGHT, WAN_LIGHTNING);
                        content.owt = objectWeight(content);
                    }
                }
            }
        }
        await addCreatedObjectToContainer(box, content);
    }
}
// C mkobj.c:mksobj_at().
export async function mksobj_at(otyp, x, y, init, artif) {
    return placeCreatedObject(await mksobj(otyp, init, artif), x, y);
}
// C mkobj.c:mkobj().
export async function mkobj(oclass, artif) {
    if (oclass === RANDOM_CLASS) {
        // mkobj.c:mkobj() switches the RANDOM_CLASS reservoir in Gehennom.
        // Keep that shared constructor policy here; hellfill.lua merely asks
        // for des.object() and does not own the resulting class weights.
        const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
        const classProbs = Is_rogue_level(game.u.uz)
            ? [[12, WEAPON_CLASS], [12, ARMOR_CLASS], [22, FOOD_CLASS],
                [22, POTION_CLASS], [22, SCROLL_CLASS], [5, WAND_CLASS],
                [5, RING_CLASS]]
            : inHell ? [[20, WEAPON_CLASS], [20, ARMOR_CLASS],
                [16, FOOD_CLASS], [12, TOOL_CLASS], [10, GEM_CLASS],
                [1, POTION_CLASS], [1, SCROLL_CLASS], [8, WAND_CLASS],
                [8, RING_CLASS], [4, AMULET_CLASS]]
                : [[10, WEAPON_CLASS], [11, ARMOR_CLASS],
                    [20, FOOD_CLASS], [8, TOOL_CLASS], [7, GEM_CLASS],
                    [16, POTION_CLASS], [16, SCROLL_CLASS], [4, SPBOOK_CLASS],
                    [4, WAND_CLASS], [3, RING_CLASS], [1, AMULET_CLASS]];
        let roll = rnd(100);
        for (const [probability, cls] of classProbs) {
            roll -= probability;
            if (roll <= 0) {
                oclass = cls;
                break;
            }
        }
    }
    const excludeNovel = oclass === SPBOOK_no_NOVEL;
    const { first, last: classLast } = getObjectClassBounds(excludeNovel ? SPBOOK_CLASS : oclass);
    const last = excludeNovel ? 407 : classLast; // SPE_BLANK_PAPER
    let total = 0;
    for (let i = first; i <= last; i++)
        total += requireObjectData(objectProb, i);
    let roll = rnd(total);
    let otyp = first;
    while ((roll -= requireObjectData(objectProb, otyp)) > 0)
        otyp++;
    return await mksobj(otyp, true, artif);
}
// C mkobj.c:mkobj_at().
export async function mkobj_at(oclass, x, y, artif) {
    return placeCreatedObject(await mkobj(oclass, artif), x, y);
}
function coinStackWeight(quantity) {
    return Math.max(1, Math.trunc((quantity + 50) / 100));
}
export async function mkgold(amount, x, y, state = game) {
    // C ref: mkobj.c mkgold()
    if (amount <= 0) {
        // C ref: mkobj.c:2008-2010
        const depthVal = depth_of_level(game.u?.uz);
        const mul = rnd(Math.trunc(30 / Math.max(12 - depthVal, 2)));
        amount = 1 + rnd(level_difficulty() + 2) * mul;
    }
    const existing = state.level?.objects?.[x]?.[y]
        ?.find(object => object.otyp === GOLD_PIECE);
    if (existing) {
        existing.quan += amount;
        existing.quantity = existing.quan;
        existing.owt = coinStackWeight(existing.quan);
        return existing;
    }
    const gold = await mksobj(GOLD_PIECE, true, false);
    gold.quan = gold.quantity = amount;
    gold.owt = coinStackWeight(amount);
    return placeCreatedObject(gold, x, y, state);
}
const PM_LICHEN = 158;
const PM_LIZARD = 326;
function corpseHasNoTimer(mndx) {
    return mndx === PM_LICHEN || mndx === PM_LIZARD;
}
function corpseHasSpecialTiming(mndx) {
    return corpseHasNoTimer(mndx) || isReviver(mndx);
}
// C mkobj.c:rider_revival_time().
export function riderRevivalTime(body, retry = false) {
    const firstTurn = retry ? 3 : body.corpsenm === PM_DEATH ? 6 : 12;
    let turn = firstTurn;
    while (turn < 67 && rn2(3))
        turn++;
    return turn;
}
// C mkobj.c:start_corpse_timeout(). Troll and Rider corpses can revive;
// other corpses rot unless their creator requested zombification.
export function startCorpseTimeout(body, { zombify = false } = {}) {
    if (!body || corpseHasNoTimer(body.corpsenm))
        return;
    const species = body.corpsenm;
    if (species === undefined)
        throw new Error('Corpse timer requires a monster species');
    const rotAdjust = game.in_mklev ? 25 : 10;
    const currentMove = Math.max(game.moves ?? 1, 1);
    if (body.age == null)
        body.age = currentMove;
    const age = currentMove - body.age;
    const baseDelay = age > ROT_AGE ? rotAdjust : ROT_AGE - age;
    let kind = OBJECT_TIMER_KIND.ROT_CORPSE;
    let delay = baseDelay + rnz(rotAdjust) - rotAdjust;
    if (species >= PM_DEATH && species <= PM_FAMINE) {
        kind = OBJECT_TIMER_KIND.REVIVE_MON;
        delay = riderRevivalTime(body);
    }
    else if (MONSTER_SYMBOL[species] === 46) { // S_TROLL
        for (let turn = 2; turn <= 50; turn++) {
            if (rn2(TROLL_REVIVE_CHANCE))
                continue;
            kind = OBJECT_TIMER_KIND.REVIVE_MON;
            delay = turn;
            break;
        }
    }
    else if (zombify && zombieForm(species) !== null
        && !body.norevive) {
        kind = OBJECT_TIMER_KIND.ZOMBIFY_MON;
        delay = rn1(15, 5);
    }
    // start_timer() counts from svm.moves itself, which is still 0 while
    // the first level is built; only the age above uses max(moves, 1).
    scheduleObjectTimer(body, kind, (game.moves ?? 0) + delay, game);
}
// C mkobj.c:set_corpsenm().
export function set_corpsenm(otmp, pm) {
    if (!otmp)
        return;
    const existingEggTimer = otmp.otyp === EGG
        ? objectTimers(otmp).find(timer => timer.kind === OBJECT_TIMER_KIND.HATCH_EGG)
        : null;
    const remainingEggTime = existingEggTimer
        ? Math.max(0, existingEggTimer.deadline - (game.moves ?? 0))
        : 0;
    // set_corpsenm() replaces timers which depend on the object's species.
    if (otmp.otyp === EGG)
        stopObjectTimer(otmp, OBJECT_TIMER_KIND.HATCH_EGG);
    else
        stopAllObjectTimers(otmp);
    if (otmp.otyp === CORPSE && otmp.oeaten) {
        const previous = otmp.corpsenm;
        const oldNutrition = previous === undefined ? 0 : MONSTER_BODY_META[previous]?.[1] ?? 0;
        const newNutrition = MONSTER_BODY_META[pm]?.[1] ?? 0;
        if (oldNutrition <= 0)
            throw new Error('Partly eaten corpse requires its original nutrition');
        if (oldNutrition !== newNutrition)
            otmp.oeaten = Math.trunc(otmp.oeaten * newNutrition / oldNutrition);
    }
    otmp.corpsenm = pm;
    if (otmp.otyp === CORPSE) {
        startCorpseTimeout(otmp);
        otmp.owt = objectWeight(otmp);
    }
    else if (otmp.otyp === EGG) {
        if (pm >= 0 && !eggSpeciesIsDead(pm))
            attachEggHatchTimer(otmp, remainingEggTime);
    }
    else {
        if (otmp.otyp === FIGURINE
            && (otmp.where === 'inventory' || otmp.where === 'minvent'))
            attachFigurineTimer(otmp);
        otmp.owt = objectWeight(otmp);
    }
}
// C mkobj.c:mkcorpstat(). Generation uses an explicit square; live callers
// may request <0,0>, whose relocation can run floor effects and show messages.
export async function createCorpstatAt(objtyp, mtmp, pm, x, y, flags, { zombify = false, noRevive = false } = {}) {
    if (!isok(x, y))
        throw new RangeError('Corpstat creation needs an explicit map square');
    const object = await mksobj(objtyp, !!(flags & CORPSTAT_INIT), false, { zombify });
    placeCreatedObject(object, x, y);
    return finishCorpstat(object, mtmp, pm, flags, zombify, noRevive);
}
// C mkobj.c:mkcorpstat().
export async function mkcorpstat(objtyp, mtmp, pm, x, y, flags, { state = game, zombify = false, noRevive = false } = {}) {
    requireLiveGame(state);
    if (x !== 0 || y !== 0)
        return await createCorpstatAt(objtyp, mtmp, pm, x, y, flags, { zombify, noRevive });
    const object = await mksobj(objtyp, !!(flags & CORPSTAT_INIT), false, { zombify });
    await relocateObjectRandomly(object, { state });
    return finishCorpstat(object, mtmp, pm, flags, zombify, noRevive);
}
// C mkobj.c:mkcorpstat(), after placement.
function finishCorpstat(otmp, mtmp, pm, flags, zombify, noRevive) {
    // Placement sees mksobj's temporary identity, not the caller's override.
    otmp.spe = flags & CORPSTAT_SPE_VAL;
    if (noRevive)
        otmp.norevive = true;
    if (mtmp) {
        otmp.oextra = {
            ...(otmp.oextra || {}),
            omonst: saveMonsterTraits(mtmp),
        };
        if (pm == null)
            pm = mtmp.mnum;
        if (mtmp.mcan && !isRider(pm))
            otmp.norevive = true;
    }
    if (pm != null) {
        const oldCorpsenm = otmp.corpsenm;
        otmp.corpsenm = pm;
        otmp.owt = objectWeight(otmp);
        if (otmp.otyp === CORPSE
            && (zombify
                || corpseHasSpecialTiming(oldCorpsenm)
                || corpseHasSpecialTiming(pm))) {
            stopAllObjectTimers(otmp);
            startCorpseTimeout(otmp, { zombify });
        }
    }
    return otmp;
}
// C mkobj.c:rndmonnum().
export function rndmonnum() {
    return rndmonnumAdj(0, 0);
}
// C mkobj.c:rndmonnum_adj(). Object identities still need a species when
// no level-appropriate living monster can be generated. Its fallback
// deliberately ignores extinction and genocide, as well as difficulty.
export function rndmonnumAdj(minAdjustment = 0, maxAdjustment = 0) {
    const selected = rndmonstAdj(minAdjustment, maxAdjustment);
    if (selected != null)
        return selected;
    const G_UNIQ = 0x1000;
    const G_HELL = 0x0400;
    const G_NOHELL = 0x0800;
    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const excluded = G_UNIQ | G_NOGEN | (inHell ? G_NOHELL : G_HELL);
    let species;
    do {
        species = rn2(SPECIAL_PM);
    } while (requireMonsterData(MONSTER_GENO, species) & excluded);
    return species;
}
// C mkobj.c:mk_tt_object(). Statues have no initial books; a missing score
// entry falls back to a real player role without supplying a name or gender.
export async function createToptenObject(type, x, y) {
    const object = await mksobj_at(type, x, y, type !== STATUE, false);
    if (!await nameObjectFromTopten(object)) {
        const firstRole = MONSTER_NAME.indexOf('archeologist');
        const lastRole = MONSTER_NAME.indexOf('wizard');
        set_corpsenm(object, rn1(lastRole - firstRole + 1, firstRole));
        object.owt = objectWeight(object);
    }
    return object;
}
//# sourceMappingURL=mkobj.js.map