// Native read.c: doread(), seffects() with its seffect_*() scroll and spell
// effects, learnscrolltyp()/learnscroll(), can_center_cloud(), forget(), and
// do_stinking_cloud(). Effects own their exceptions to scroll disposal.
import { exerciseAttribute, exerciseWisdom } from './attrib.js';
import { adjustArmorAttributeBonus, armorSlotFor, destroyWornArmor, disintegrateWornArmor, erodeWornArmor, someHeroArmor, wearHeroArmor, wornArmorInDestroyOrder, } from './armor.js';
import { explode } from './explosion.js';
import { heroIsPunished } from './ball.js';
import { heroHandName, heroHeadName, heroLegName } from './body_parts.js';
import { A_CON, A_STR, A_WIS, ACCESSIBLE, COLNO, D_CLOSED, D_LOCKED, DOOR, EXPL_FIERY, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, In_endgame, In_quest, IS_AIR, IS_OBSTRUCTED, Is_earthlevel, Is_rogue_level, M_SEEN_FIRE, PLNMSG_TOWER_OF_FLAME, ROWNO, SDOOR, SPE_LIM, TT_BURIEDBALL, W_ART, W_ARTI, W_BALL, isok, } from './const.js';
import { canSpotMonster, displayColorName, displayLiquidName, shieldeff } from './display.js';
import { pline as syncPline, plineWithContinuation } from './pline.js';
import { plineWithContinuation as pline } from './pline.js';
import { revealSecretDoor } from './detect.js';
import { impossible } from './diagnostics.js';
import { doClassGenocide, doGenocide } from './genocide.js';
import { applyLightScrollEffect } from './light.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { makeConfused } from './hero_mental_status.js';
import { heroSpecies } from './hero_species.js';
import { formatFeltMessage, formatHeardMessage, heroCanChant } from './hero_speech.js';
import { freeHeroFromBuriedBall } from './hero_traps.js';
import { consumeInventoryItem, identifyPack } from './invent.js';
import { createCritters } from './makemon.js';
import { withMonsterNoticesBlocked } from './hack.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { makeMonsterFlee } from './monmove.js';
import { monsterAtPosition } from './steed.js';
import { makePlural } from './object_grammar.js';
import { BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES, CORNUTHAUM, ELVEN_BOOTS, ELVEN_CLOAK, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, LEASH, LOADSTONE, OBJECT_INITIAL_KNOWN, OBJECT_MAGIC, OBJECT_MERGE, OBJECT_NAMES, POT_WATER, SCR_AMNESIA, SCR_BLANK_PAPER, SCR_CREATE_MONSTER, SCR_DESTROY_ARMOR, SCR_EARTH, SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SCR_FIRE, SCR_GENOCIDE, SCR_IDENTIFY, SCR_LIGHT, SCR_MAGIC_MAPPING, SCR_PUNISHMENT, SCR_REMOVE_CURSE, SCR_SCARE_MONSTER, SCR_STINKING_CLOUD, SCR_TELEPORTATION, SHIELD_OF_REFLECTION, SILVER_DRAGON_SCALE_MAIL, SILVER_DRAGON_SCALES, SLING, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_CAUSE_FEAR, SPE_CHARM_MONSTER, SPE_CONFUSE_MONSTER, SPE_CREATE_MONSTER, SPE_DETECT_FOOD, SPE_IDENTIFY, SPE_MAGIC_MAPPING, SPE_NOVEL, SPE_REMOVE_CURSE, YELLOW_DRAGON_SCALES, requireObjectData, } from './object_data.js';
import { blessObjectState, curseObject, curseObjectState, uncurseObjectState } from './mkobj.js';
import { ownedObjectAction } from './objnam.js';
import { punishHero, unpunishHero } from './punishment.js';
import { chooseObjectToCharge, rechargeObject } from './recharge.js';
import { finishStrangeFeeling, strangeFeeling } from './potion.js';
import { askTeleportDestination, teleportHero } from './teleport.js';
import { levelTeleport } from './level_teleport.js';
import { detectFood, detectGold, detectTraps, mapMagicLevel } from './detect.js';
import { d, rn2, rn1, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject, updateUnpaidObjectPrice } from './shk.js';
import { monsterSaddle } from './steed.js';
import { dropCursedSecondaryWeapon } from './two_weapon.js';
import { cansee } from './vision.js';
import { dropBoulderOnHero, dropBoulderOnMonster } from './falling_boulder.js';
import { prepareMapPositionHighlights, selectMapPosition, showGetposInstructions, showGetposTip, } from './getpos.js';
import { finishHeroDeath as defaultHeroDeath } from './end.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { loseHeroHp } from './hero_damage.js';
import { objectLightRadius } from './light.js';
import { propertyIsActive } from './properties.js';
import { createPoisonGasCloud } from './regions.js';
import { sokobanGuilt } from './rock_breakage.js';
import { drainHeroWeaponSkills } from './skills.js';
import { burnAwayHeroSlime } from './slime.js';
import { loseHeroSpellMemory } from './spell.js';
import { ceilingName } from './terrain_name.js';
import { isLavaAt, isPoolAt, levelHasCeiling } from './terrain_properties.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './mondata.js';
import { addExperience } from './exper.js';
import { learnObjectType } from './object_knowledge.js';
import { enchantWeapon } from './enchant_weapon.js';
import { makeStunned } from './hero_mental_status.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { gotoLevel as changeLevel, scheduleLevelChange } from './level_change.js';
import { recordLiteracy } from './literacy.js';
import { tryCallObjectType } from './object_call.js';
import { promptYesNo } from './query.js';
import { readOrdinaryObject } from './readable_objects.js';
import { angerMonster } from './mon.js';
import { monsterResistsEffect } from './zap.js';
import { tameMonster } from './dog.js';
import { exerciseAttribute as exerciseAttributeNamed } from './attrib.js';
import { studyBook } from './spellbook_study.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';
const WEAPON_CLASS = 2;
const SCROLL_CLASS = 9, SPBOOK_CLASS = 10;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const S_HUMAN = 53;
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
const SCR_CONFUSE_MONSTER = OBJECT_NAMES.indexOf('confuse monster');
const SCR_TAMING = OBJECT_NAMES.indexOf('taming');
const SCR_GOLD_DETECTION = OBJECT_NAMES.indexOf('gold detection');
const SCR_FOOD_DETECTION = OBJECT_NAMES.indexOf('food detection');
const SCR_CHARGING = OBJECT_NAMES.indexOf('charging');
export async function doread(options = {}) {
    const { gotoLevel = (...args) => { scheduleLevelChange(args); }, ...hooks } = options;
    requirePlayingGame(game);
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        return finishRead(false);
    }
    const source = await chooseInventoryObject('read', classifyReadableObject, { forcePrompt: true });
    if (!source)
        return finishRead(false, true);
    source.pickup_prev = false;
    const type = source.otyp;
    const ordinary = await readOrdinaryObject(source);
    if (ordinary.handled)
        return finishRead(ordinary.spentTime);
    if (heroIsBlind() && type !== SPE_BOOK_OF_THE_DEAD) {
        const unreadable = type === SPE_NOVEL ? 'words'
            : source.oclass === SPBOOK_CLASS ? 'mystic runes'
                : !source.dknown ? 'formula on the scroll' : null;
        if (unreadable) {
            await pline(`Being blind, you cannot read the ${unreadable}.`);
            return finishRead(false);
        }
    }
    const confused = type !== SCR_MAIL && (game.u.confusionTurns ?? 0) > 0;
    if (type === SCR_MAIL && !game.u.uconduct?.literate && !source.spe) {
        const answer = await promptYesNo('Reading mail will violate "illiterate" conduct.  Read anyway?', 'n');
        if (answer !== 'y')
            return finishRead(false);
    }
    if (![SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, SPE_BLANK_PAPER, SCR_BLANK_PAPER].includes(type))
        recordLiteracy(`became literate by reading ${source.oclass === SPBOOK_CLASS ? 'a book' : 'a scroll'}`);
    if (source.oclass === SPBOOK_CLASS) {
        const result = await studyBook(source);
        return finishRead(result.spentTime);
    }
    source.in_use = true;
    if (type !== SCR_BLANK_PAPER)
        await announceScroll(source, confused);
    // C schedule_goto() leaves the source level only after doread finishes
    // discovery and useup, so consumed unpaid scrolls still reach that bill.
    const deferred = { destination: null };
    const effect = await applyScrollEffects(source, {
        ...hooks,
        gotoLevel: async (...args) => { deferred.destination = args; },
    });
    if (effect.heroDied || game.program_state.gameover)
        return finishRead(false);
    if (!effect.consumed) {
        if (!OBJECT_INITIAL_KNOWN[type] && !game._knownObjectTypes?.has(type)) {
            if (effect.known)
                learnScrollType(type);
            else
                await tryCallObjectType(source);
        }
        source.in_use = false;
        if (type !== SCR_BLANK_PAPER)
            await consumeInventoryItem(source);
    }
    if (deferred.destination)
        await gotoLevel(...deferred.destination);
    return finishRead(true);
}
// C read.c:read_ok().
function classifyReadableObject(object) {
    if (!object)
        return GETOBJ_EXCLUDE;
    return [SCROLL_CLASS, SPBOOK_CLASS].includes(object.oclass) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
}
async function announceScroll(source, confused) {
    const silently = !heroCanChant();
    const staysVisible = source.otyp === SCR_FIRE || (source.otyp === SCR_REMOVE_CURSE && source.cursed);
    if (heroIsBlind()) {
        const verb = silently ? 'cogitate' : 'pronounce';
        await pline(staysVisible ? `You ${verb} the formula on the scroll.`
            : `As you ${verb} the formula on it, the scroll disappears.`);
    }
    else {
        await pline(staysVisible ? 'You read the scroll.' : 'As you read the scroll, it disappears.');
    }
    if (confused)
        await pline(heroIsHallucinating() ? 'Being so trippy, you screw up...'
            : `Being confused, you ${silently ? 'misunderstand' : 'mispronounce'} the magic words...`);
}
function finishRead(spentTime, cancelled = false) {
    const heroDied = !!game.program_state.gameover;
    game.context.move = Number(spentTime && !heroDied);
    return { spentTime, heroDied, cancelled };
}
// C read.c:learnscrolltyp(). Discovering a scroll awards score experience in
// addition to the Wisdom exercise owned by makeknown().
export function learnScrollType(otyp, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (OBJECT_INITIAL_KNOWN[otyp] || state._knownObjectTypes?.has(otyp))
        return false;
    learnObjectType(otyp, state);
    addExperience(0, 10, state);
    return true;
}
// C read.c:learnscroll().
export function learnScroll(source, { state = game, } = {}) {
    return source.oclass === SPBOOK_CLASS ? false : learnScrollType(source.otyp, { state });
}
// Armor and weapon scroll effects. C read.c:seffect_enchant_armor(),
// seffect_destroy_armor(), and seffect_enchant_weapon().
// Initial reading prose, Wisdom exercise, normal disposal, and discovery
// remain with seffects()/doread(). Strange feelings consume their own source.
export async function applyArmorScrollEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let result;
    switch (source.otyp) {
        case SCR_ENCHANT_ARMOR:
            result = await enchantArmor(source, state);
            break;
        case SCR_DESTROY_ARMOR:
            result = await destroyArmor(source, state);
            break;
        case SCR_ENCHANT_WEAPON:
            result = { known: false, consumed: await enchantWeapon(source, state) };
            break;
        default:
            throw new RangeError(`Not an armor or weapon scroll: ${source.otyp}`);
    }
    // C read.c never calls find_ac(): moveloop_core() recomputes u.uac once
    // per player input, after the monsters have moved.
    state._armorClassDirty = true;
    return { known: false, consumed: false, ...result,
        heroDied: !!state.program_state?.gameover };
}
// C read.c:seffect_enchant_armor().
async function enchantArmor(source, state) {
    const armor = someHeroArmor(state);
    if (!armor) {
        const result = await strangeFeeling(source, heroIsBlind(state)
            ? 'Your skin feels warm for a moment.' : 'Your skin glows then fades.', { state });
        await exerciseAttribute(A_CON, !source.cursed, state);
        await exerciseAttribute(A_STR, !source.cursed, state);
        return result;
    }
    if (isConfused(state)) {
        await proofArmor(armor, source.cursed, state);
        return {};
    }
    const special = isSpecialArmor(armor, state);
    const safeLimit = special ? 5 : 3;
    const sameColor = !heroIsBlind(state) && (source.cursed
        ? [BLACK_DRAGON_SCALES, BLACK_DRAGON_SCALE_MAIL].includes(armor.otyp)
        : [SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL, SHIELD_OF_REFLECTION]
            .includes(armor.otyp));
    let power = armor.spe * (source.cursed ? -1 : 1);
    if (power > safeLimit && rn2(power)) {
        armor.in_use = true;
        await pline(`${armorGlow(armor, source.cursed, sameColor, true, state)} for a while, `
            + `then ${armorVerb(armor, 'evaporate')}.`);
        await destroyWornArmor(armor, state);
        return {};
    }
    power = Math.trunc((4 - Math.max(power, -100)) / 2)
        + Number(special) + Number(!OBJECT_MAGIC[armor.otyp]) + Number(!!source.blessed);
    let amount = power <= 0
        ? (armor.spe > 0 && rn2(armor.spe) === 0 ? 1 : 0)
        : rnd(power);
    amount = Math.min(amount, 11) * (source.cursed ? -1 : 1);
    if (amount >= 0 && armor.otyp >= GRAY_DRAGON_SCALES
        && armor.otyp <= YELLOW_DRAGON_SCALES) {
        await hardenDragonScales(armor, source, state);
        return {};
    }
    await pline(`${armorGlow(armor, source.cursed, sameColor, !amount, state)} `
        + `for a ${amount * amount > 1 ? 'while' : 'moment'}.`);
    if (amount < 0)
        await chargeAlteredUnpaidObject(armor, 'disenchant', state);
    const oldLight = objectLightRadius(armor, state);
    if (source.cursed && !armor.cursed)
        curseObjectState(armor);
    else if (source.blessed && !armor.blessed)
        blessObjectState(armor);
    else if (!source.cursed && armor.cursed)
        uncurseObjectState(armor);
    await adjustArmorLight(armor, oldLight, state);
    let known = false;
    if (amount) {
        const old = armor.spe ?? 0;
        setEnchantment(armor, old + amount);
        amount = armor.spe - old;
        if (amount)
            adjustArmorAttributeBonus(armor, amount, state);
        known = !!armor.known;
        if (amount > 0 && armor.unpaid)
            updateUnpaidObjectPrice(armor, state);
    }
    if (armor.spe > safeLimit && (special || rn2(7) === 0)) {
        await pline(`${ownedObjectAction(armor, 'suddenly vibrate', state)} `
            + `${heroIsBlind(state) ? 'again' : 'unexpectedly'}.`);
    }
    return { known };
}
async function proofArmor(armor, cursed, state) {
    const oldProof = !!armor.oerodeproof;
    armor.oerodeproof = false;
    if (heroIsBlind(state)) {
        armor.rknown = false;
        await pline(`${ownedObjectAction(armor, 'feel', state)} warm for a moment.`);
    }
    else {
        armor.rknown = true;
        const color = displayColorName(cursed ? 'black' : 'golden', state);
        const protection = cursed ? 'glow' : armorSlotFor(armor.otyp) === 'uarms' ? 'layer' : 'shield';
        await pline(`${ownedObjectAction(armor, 'are', state)} covered by a `
            + `${cursed ? 'mottled' : 'shimmering'} ${color} ${protection}!`);
    }
    if (!cursed && (armor.oeroded || armor.oeroded2)) {
        armor.oeroded = armor.oeroded2 = 0;
        await pline(`${ownedObjectAction(armor, heroIsBlind(state) ? 'feel' : 'look', state)} as good as new!`);
    }
    await replaceProofing(armor, oldProof, !cursed, state);
}
async function hardenDragonScales(armor, source, state) {
    await pline(`${ownedObjectAction(armor, null, state)} merges and hardens!`);
    const wasLit = armor.lamplit;
    const oldLight = objectLightRadius(armor, state);
    armor.otyp += GRAY_DRAGON_SCALE_MAIL - GRAY_DRAGON_SCALES;
    armor.lamplit = false;
    if (source.blessed) {
        setEnchantment(armor, armor.spe + 1);
        if (!armor.blessed)
            blessObjectState(armor);
    }
    else if (armor.cursed)
        uncurseObjectState(armor);
    armor.known = true;
    const name = requireObjectData(OBJECT_NAMES, armor.otyp);
    if (name === null)
        throw new Error('Hardened dragon scales require a native armor name.');
    if (armor.name !== undefined)
        armor.name = name;
    if (armor.plural !== undefined)
        armor.plural = makePlural(name);
    armor.owt = objectWeight(armor);
    wearHeroArmor(armor, state);
    if (armor.unpaid)
        updateUnpaidObjectPrice(armor, state);
    if (wasLit === undefined)
        delete armor.lamplit;
    else
        armor.lamplit = wasLit;
    await adjustArmorLight(armor, oldLight, state);
}
// C read.c:seffect_destroy_armor().
// C read.c:disintegrate_cursed_armor().
// C do_wear.c:count_worn_armor().
// C do_wear.c:any_worn_armor_ok().
async function destroyArmor(source, state) {
    let armor = someHeroArmor(state);
    if (isConfused(state)) {
        if (!armor)
            return itchyFeeling(source, 'Your bones itch.', state);
        const oldProof = !!armor.oerodeproof;
        armor.oerodeproof = false;
        const color = heroIsBlind(state) ? '' : ` ${displayColorName('purple', state)}`;
        await pline(`${ownedObjectAction(armor, heroIsBlind(state) ? 'vibrate' : 'glow', state)}${color} for a moment.`);
        await replaceProofing(armor, oldProof, !!source.cursed, state);
        return {};
    }
    if (source.cursed) {
        if (armor?.cursed) {
            await pline(`${ownedObjectAction(armor, 'vibrate', state)}.`);
            if (armor.spe >= -6) {
                setEnchantment(armor, armor.spe - 1);
                adjustArmorAttributeBonus(armor, -1, state);
            }
            await makeStunned((state.u.stunnedTurns ?? 0) + rn1(10, 10), { state });
            return {};
        }
        return { known: armor ? await disintegrateWornArmor(armor, { state }) : false };
    }
    const worn = wornArmorInDestroyOrder(state);
    if (armor && source.blessed && worn.length > 1) {
        if (!state._knownObjectTypes?.has(source.otyp))
            await pline('This is a scroll of destroy armor!');
        const selected = await chooseInventoryObject('destroy', object => worn.includes(object) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
        if (selected && worn.includes(selected))
            armor = selected;
        await disintegrateWornArmor(armor, { state });
        return { known: true };
    }
    if (source.blessed) {
        const cursed = worn.filter(object => object.cursed);
        if (cursed.length) {
            const target = cursed[rn2(cursed.length)];
            if (!target)
                throw new RangeError('Destroy armor selected no cursed worn armor.');
            if (await disintegrateWornArmor(target, { state }))
                return { known: true };
        }
    }
    if (await erodeWornArmor(state))
        return { known: true };
    return itchyFeeling(source, 'Your skin itches.', state);
}
async function itchyFeeling(source, message, state) {
    const result = await strangeFeeling(source, message, { state });
    await exerciseAttribute(A_STR, false, state);
    await exerciseAttribute(A_CON, false, state);
    return result;
}
async function replaceProofing(armor, oldProof, newProof, state) {
    if (oldProof && !newProof) {
        armor.oerodeproof = true;
        await chargeAlteredUnpaidObject(armor, 'degrade', state);
    }
    armor.oerodeproof = newProof;
}
async function adjustArmorLight(armor, oldRadius, state) {
    if (!oldRadius)
        return;
    const delta = objectLightRadius(armor, state) - oldRadius;
    if (!delta)
        return;
    state.vision_full_recalc = 1;
    if (!heroIsBlind(state)) {
        await pline(`${ownedObjectAction(armor, 'shine', state)} `
            + `${Math.abs(delta) > 1 ? 'much ' : ''}${delta > 0 ? 'brighter' : 'less brightly'}.`);
    }
}
function armorGlow(armor, cursed, sameColor, violent, state) {
    const verb = heroIsBlind(state) ? 'vibrate' : 'glow';
    const color = heroIsBlind(state) || sameColor
        ? '' : ` ${displayColorName(cursed ? 'black' : 'silver', state)}`;
    return `${ownedObjectAction(armor, `${violent ? 'violently ' : ''}${verb}`, state)}${color}`;
}
function armorVerb(armor, verb) {
    return armor.quan > 1 ? verb : `${verb}s`;
}
function isSpecialArmor(armor, state) {
    return [ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_CLOAK,
        ELVEN_SHIELD, ELVEN_BOOTS].includes(armor.otyp)
        || armor.otyp === CORNUTHAUM && state.urole?.key === 'wizard';
}
function isConfused(state) {
    return !!state.u?.confused || (state.u?.confusionTurns ?? 0) > 0;
}
function setEnchantment(armor, amount) {
    armor.spe = Math.max(-SPE_LIM, Math.min(SPE_LIM, amount));
    armor.enchantment = armor.spe;
}
// C read.c:seffect_confuse_monster().
async function confuseMonsterEffect(source, state) {
    const hero = state.u;
    const confused = (hero.confusionTurns ?? 0) > 0;
    const hiddenHands = heroIsBlind(state) || (heroIsInvisible(state)
        && !(hero.seeInvisible || (hero.seeInvisibleTurns ?? 0) > 0));
    const hands = makePlural(heroHandName(state));
    if (MONSTER_SYMBOL[heroSpecies(state)] !== S_HUMAN || source.cursed) {
        if (!hero.confusionTurns)
            await plineWithContinuation(formatFeltMessage('confused.', state));
        await makeConfused((hero.confusionTurns ?? 0) + rnd(100), { state, talk: false });
        return;
    }
    if (confused) {
        if (!source.blessed) {
            const feeling = hiddenHands ? 'tingle' : `glow ${displayColorName('purple', state)}`;
            await plineWithContinuation(`Your ${hands} begin to ${feeling}.`);
            await makeConfused((hero.confusionTurns ?? 0) + rnd(100), { state, talk: false });
        }
        else {
            const aura = hiddenHands ? 'faint buzz' : `${displayColorName('red', state)} glow`;
            await plineWithContinuation(`A ${aura} surrounds your ${heroHeadName(state)}.`);
            await makeConfused(0, { state });
        }
        return;
    }
    let increase = source.oclass === SCROLL_CLASS ? 3 : 0;
    if (!source.blessed) {
        if (hiddenHands) {
            await plineWithContinuation(`Your ${hands} tingle${hero.umconf ? ' even more' : ''}.`);
        }
        else if (!hero.umconf) {
            await plineWithContinuation(`Your ${hands} begin to glow ${displayColorName('red', state)}.`);
        }
        else {
            await plineWithContinuation(`The ${displayColorName('red', state)} glow of your ${hands} intensifies.`);
        }
        increase += rnd(2);
    }
    else {
        if (hiddenHands) {
            await plineWithContinuation(`Your ${hands} tingle ${hero.umconf ? 'even more' : 'very'} sharply.`);
        }
        else {
            await plineWithContinuation(`Your ${hands} glow ${hero.umconf ? 'an even more' : 'a'} brilliant ${displayColorName('red', state)}.`);
        }
        increase += rn1(8, 2);
    }
    hero.umconf = (hero.umconf ?? 0) + ((hero.umconf ?? 0) >= 40 ? 1 : increase);
}
// C read.c:seffect_scare_monster().
async function causeFearEffect(source, state) {
    const reverse = source.cursed || (state.u.confusionTurns ?? 0) > 0;
    let nonPets = 0;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || !cansee(monster.mx, monster.my))
            continue;
        if (reverse) {
            monster.mflee = monster.mfrozen = monster.msleeping = 0;
            monster.mcanmove = 1;
        }
        else if (!monsterResistsEffect(monster, source.oclass === SCROLL_CLASS ? 9 : state.u.ulevel)) {
            const result = await makeMonsterFlee(monster, { state, announce: false });
            if (result.heroDied)
                return { heroDied: true };
        }
        if (!monster.mtame)
            nonPets++;
    }
    if (source.otyp === SCR_SCARE_MONSTER || !nonPets) {
        const message = formatHeardMessage(`${reverse ? 'sad wailing' : 'maniacal laughter'} ${nonPets ? 'close by' : 'in the distance'}.`, state);
        if (message)
            await plineWithContinuation(message);
    }
    return;
}
function removeCurseWornMask(object, state) {
    let mask = (object.owornmask ?? 0) & ~(W_BALL | W_ART | W_ARTI);
    const swapWeapon = state.uswapwep || state.u?.uswapwep;
    const quiver = state.uquiver || state.u?.uquiver;
    if (object === swapWeapon && !(state.u?.twoweap)) {
        mask = 0;
    }
    else if (object === quiver) {
        if (object.oclass === WEAPON_CLASS) {
            if (!OBJECT_MERGE[object.otyp])
                mask = 0;
        }
        else if (object.oclass === GEM_CLASS) {
            if ((state.uwep || state.u?.uwep)?.otyp !== SLING)
                mask = 0;
        }
        else {
            mask = 0;
        }
    }
    return mask;
}
function removeCurseAppliesTo(object, blessed, state) {
    return blessed || !!removeCurseWornMask(object, state)
        || object.otyp === LOADSTONE
        || (object.otyp === LEASH && !!object.leashmon);
}
async function randomlyBlessOrCurse(object, state) {
    if (object.blessed || object.cursed || rn2(2))
        return false;
    if (rn2(2))
        return blessObjectState(object);
    const changed = await curseObject(object, { state });
    await dropCursedSecondaryWeapon(object, state);
    return changed;
}
export function removeCurseFeeling(confused) {
    const hallucinating = heroIsHallucinating(game);
    if (hallucinating) {
        return confused
            ? 'the power of the Force against you!'
            : 'in touch with the Universal Oneness.';
    }
    return confused ? 'like you need some help.'
        : 'like someone is helping you.';
}
// C read.c:seffect_remove_curse().  The caller owns scroll consumption and
// its reading message; this function owns the effect on carried equipment.
export async function removeCurseEffect({ source = null, state = game, blessed = !!source?.blessed, cursed = !!source?.cursed, confused = (state.u.confusionTurns ?? 0) > 0, publish = syncPline, announce = true, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (announce)
        await publish(formatFeltMessage(removeCurseFeeling(confused), state));
    if (cursed && announce)
        await publish('The scroll disintegrates.');
    const changed = [];
    for (const object of cursed ? [] : [...(state.inventory || [])]) {
        const quantity = object.quan ?? object.quantity ?? 1;
        if (object.oclass === COIN_CLASS
            || (object === source && quantity === 1)
            || !removeCurseAppliesTo(object, blessed, state))
            continue;
        if (confused) {
            if (await randomlyBlessOrCurse(object, state))
                changed.push(object);
            if (state.program_state.gameover)
                return changed;
            object.bknown = false;
            if (object.unpaid && object.otyp === POT_WATER
                && (object.blessed || object.cursed))
                updateUnpaidObjectPrice(object, state);
        }
        else if (object.cursed) {
            if (object.unpaid && object.otyp === POT_WATER)
                await chargeAlteredUnpaidObject(object, 'uncurse', state);
            uncurseObjectState(object);
            if (object.bknown && source?.otyp === SCR_REMOVE_CURSE
                && !state._knownObjectTypes?.has(SCR_REMOVE_CURSE)) {
                learnScrollType(SCR_REMOVE_CURSE, { state });
            }
            changed.push(object);
        }
    }
    const saddle = cursed ? null : monsterSaddle(state.u.usteed);
    if (saddle && confused) {
        if (await randomlyBlessOrCurse(saddle, state))
            changed.push(saddle);
        saddle.bknown = false;
    }
    else if (saddle?.cursed) {
        uncurseObjectState(saddle);
        changed.push(saddle);
        if (!heroIsBlind(state)) {
            await publish(`${ownedObjectAction(saddle, 'glow', state)} ${displayColorName('amber', state)}.`);
            saddle.bknown = !(heroIsHallucinating(state));
        }
        else {
            saddle.bknown = false;
        }
    }
    if (heroIsPunished(state) && !confused)
        await unpunishHero(state);
    if (state.u.utrap && state.u.utraptype === TT_BURIEDBALL) {
        await freeHeroFromBuriedBall(state);
        await publish(`The clasp on your ${heroLegName(state)} vanishes.`);
    }
    return changed;
}
// C sit.c:316 calls seffects() with a zeroobj spell source on the stack. It
// has no inventory identity or creation effects, but still passes through
// seffects' Wisdom gain. throne.c's confused blessed remove curse and
// trap.c's magic trap use the same entry.
export async function applyRemoveCurseSpell({ state = game, blessed = false, cursed = false, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    await exerciseScrollWisdom(SPE_REMOVE_CURSE, state);
    await removeCurseEffect({
        source: { otyp: SPE_REMOVE_CURSE, blessed, cursed },
        state,
        publish: plineWithContinuation,
    });
    return { known: false, consumed: false, heroDied: !!state.program_state.gameover };
}
async function maybeTame(monster, source, state) {
    const wasTame = monster.mtame ?? 0;
    const wasPeaceful = !!monster.mpeaceful;
    if (source.cursed) {
        await angerMonster(monster);
        return wasPeaceful && !monster.mpeaceful ? -1 : 0;
    }
    if (!monsterResistsEffect(monster, source.oclass === SCROLL_CLASS ? 9 : state.u.ulevel) || monster.isshk)
        await tameMonster(monster, source, { state });
    return (!wasPeaceful && monster.mpeaceful) || wasTame !== (monster.mtame ?? 0) ? 1 : 0;
}
// C read.c:seffect_taming().
async function charmMonsterEffect(source, state) {
    let candidates = 0, results = 0, visibleResults = 0;
    if (state.u.uswallow) {
        const swallower = state.u.ustuck;
        if (!swallower)
            throw new Error('A swallowed hero needs its swallowing monster.');
        candidates = 1;
        results = visibleResults = await maybeTame(swallower, source, state);
        if (state.program_state.gameover)
            return { heroDied: true };
    }
    else {
        const radius = (state.u.confusionTurns ?? 0) > 0 ? 5 : 1;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const x = state.u.ux + dx, y = state.u.uy + dy;
                if (!isok(x, y))
                    continue;
                const monster = monsterAtPosition(state.level, x, y)
                    || (!dx && !dy ? state.u.usteed : null);
                if (!monster)
                    continue;
                candidates++;
                const changed = await maybeTame(monster, source, state);
                if (state.program_state.gameover)
                    return { heroDied: true };
                results += changed;
                if (canSpotMonster(monster))
                    visibleResults += changed;
            }
        }
    }
    await plineWithContinuation(!results
        ? `Nothing interesting ${candidates ? 'seems to happen' : 'happens'}.`
        : `The neighborhood ${visibleResults ? 'is' : 'seems'} ${results < 0 ? 'un' : ''}friendlier.`);
    return { known: visibleResults > 0 };
}
// C read.c:seffect_charging().
async function chargingEffect(source, state) {
    const blessing = source.cursed ? -1 : source.blessed ? 1 : 0;
    if ((state.u.confusionTurns ?? 0) > 0) {
        await plineWithContinuation(formatFeltMessage(source.cursed ? 'discharged.' : 'charged up!', state));
        if (source.cursed)
            state.u.uen = 0;
        else {
            state.u.uen += d(source.blessed ? 6 : 4, 4);
            state.u.uen = state.u.uenmax = Math.max(state.u.uen, state.u.uenmax);
        }
        state.context.botl = true;
        return;
    }
    const known = source.oclass === SPBOOK_CLASS || OBJECT_INITIAL_KNOWN[source.otyp]
        || state._knownObjectTypes?.has(source.otyp);
    if (!known) {
        await plineWithContinuation('This is a charging scroll.');
        learnScroll(source, { state });
    }
    await consumeInventoryItem(source, state);
    const object = await chooseObjectToCharge(state);
    const charged = object ? await rechargeObject(object, blessing, state) : null;
    return { consumed: true, heroDied: !!charged?.heroDied };
}
async function mailEffect(source, state) {
    const odd = (source.o_id ?? 0) % 2 === 1;
    if (source.spe === 2)
        await plineWithContinuation(`This scroll is marked "${odd ? 'Postage Due' : 'Return to Sender'}".`);
    else if (source.spe === 1)
        await plineWithContinuation(`This seems to be ${odd
            ? 'a chain letter threatening your luck' : 'junk mail addressed to the finder of the Eye of Larn'}.`);
    else if (!state.iflags?.debug_fuzzer)
        await plineWithContinuation('This game cannot open the system mail reader.');
}
export async function applyAreaScrollEffect(source, { state = game, finishHeroDeath = defaultHeroDeath, finishMonsterKill = finishHeroMonsterKillOutcome, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const options = { state, finishHeroDeath, finishMonsterKill };
    switch (source.otyp) {
        case SCR_FIRE: return fireEffect(source, options);
        case SCR_EARTH: return earthEffect(source, options);
        case SCR_STINKING_CLOUD: return cloudEffect(source, state);
        case SCR_AMNESIA: return amnesiaEffect(source, state);
        default: throw new Error(`Unsupported area scroll ${source.otyp}`);
    }
}
// C read.c:seffect_amnesia().
// C read.c:forget().
async function amnesiaEffect(source, state) {
    if (heroIsPunished(state))
        state.u.bc_felt = 0;
    if (!source.blessed)
        loseHeroSpellMemory({ state });
    await drainHeroWeaponSkills(rnd(source.blessed ? 3 : 5), state);
    for (const monster of state.level.monsters) {
        if (monster !== state.u.usteed && monster !== state.u.ustuck)
            monster.meverseen = 0;
    }
    for (const monster of state._migratingMonsters || [])
        monster.meverseen = 0;
    if (heroIsHallucinating(state))
        await pline('Your mind releases itself from mundane concerns.');
    else if (/^maud/i.test(state.plname || ''))
        await pline('As your mind turns inward on itself, you forget everything else.');
    else
        await pline(rn2(2) ? 'Who was that Maud person anyway?'
            : 'Thinking of Maud you forget everything else.');
    exerciseWisdom(false, state);
    return { known: true, consumed: false, heroDied: false };
}
// C read.c:seffect_fire().
async function fireEffect(source, { state, finishHeroDeath }) {
    const blessed = !!source.blessed;
    const confused = (state.u.confusionTurns ?? 0) > 0;
    const alreadyKnown = sourceTypeKnown(source, state);
    let damage = Math.trunc((2 * (rn1(3, 3) + 2 * blessing(source)) + 1) / 3);
    await consumeInventoryItem(source, state);
    if (!alreadyKnown)
        learnScrollType(SCR_FIRE, { state });
    const result = { known: false, consumed: true, heroDied: false };
    const underwater = state.underwater || state.u.uinwater;
    if (confused) {
        if (underwater) {
            await pline(`A little ${displayLiquidName('water', state)} around you vaporizes.`);
        }
        else if (propertyIsActive('fireResistance', state)) {
            await shieldeff(state.u.ux, state.u.uy, state);
            monstersObserveHeroResistance(M_SEEN_FIRE, state);
            await pline(heroIsBlind(state)
                ? formatFeltMessage(`a pleasant warmth in your ${makePlural(heroHandName(state))}.`, state)
                : `Oh, look, what a pretty fire in your ${makePlural(heroHandName(state))}.`);
        }
        else {
            monstersForgetHeroResistance(M_SEEN_FIRE, state);
            await pline(`The scroll catches fire and you burn your ${makePlural(heroHandName(state))}.`);
            result.heroDied = !!await loseHeroHp(1, 'scroll of fire', { state, die: finishHeroDeath });
        }
        return result;
    }
    let center = { x: state.u.ux, y: state.u.uy };
    if (underwater) {
        await pline(`The ${displayLiquidName('water', state)} around you vaporizes violently!`);
    }
    else {
        if (blessed) {
            if (!alreadyKnown)
                await pline('This is a scroll of fire!');
            damage *= 5;
            const selected = await chooseCenter('Where do you want to center the explosion?', state);
            if (selected && canCenterCloud(selected.x, selected.y, state))
                center = selected;
        }
        if (center.x === state.u.ux && center.y === state.u.uy) {
            await pline('The scroll erupts in a tower of flame!');
            state._lastPlineKind = PLNMSG_TOWER_OF_FLAME;
            await burnAwayHeroSlime({ state });
        }
    }
    const explosion = await explode(center.x, center.y, 11, damage, 9, EXPL_FIERY, {
        state, die: finishHeroDeath,
    });
    result.heroDied = explosion.heroDied;
    return result;
}
// C read.c:seffect_earth().
async function earthEffect(source, options) {
    const { state } = options;
    const result = { known: false, consumed: false, heroDied: false };
    if (Is_rogue_level(state.u.uz) || !levelHasCeiling(state)
        || In_endgame(state.u.uz) && !Is_earthlevel(state.u.uz))
        return result;
    if (state.u.uswallow) {
        const heard = formatHeardMessage('rumbling.', state);
        if (heard)
            await pline(heard);
    }
    else if (In_quest(state.u.uz)) {
        await pline(source.blessed ? 'Avalanches of boulders materialize around you!'
            : 'An avalanche of boulders materializes above you!');
    }
    else {
        await pline(`The ${ceilingName(state.u.ux, state.u.uy, state)} rumbles ${source.blessed ? 'around' : 'above'} you!`);
    }
    result.known = true;
    sokobanGuilt(state);
    const dropOptions = { ...options, confused: (state.u.confusionTurns ?? 0) > 0 };
    let count = 0;
    if (!source.cursed) {
        for (let x = state.u.ux - 1; x <= state.u.ux + 1; x++) {
            for (let y = state.u.uy - 1; y <= state.u.uy + 1; y++) {
                if (!isok(x, y) || x === state.u.ux && y === state.u.uy)
                    continue;
                const location = state.level.at(x, y);
                if (!location)
                    continue;
                if (IS_OBSTRUCTED(location.typ) || IS_AIR(location.typ)
                    || location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)))
                    continue;
                const dropped = await dropBoulderOnMonster(x, y, dropOptions);
                count += Number(dropped.dropped);
                if (dropped.heroDied)
                    return { ...result, heroDied: true };
            }
        }
    }
    if (!source.blessed) {
        const dropped = await dropBoulderOnHero({ ...dropOptions, helmetProtects: !source.cursed });
        result.heroDied = dropped.heroDied;
    }
    else if (!count)
        await pline('But nothing else happens.');
    return result;
}
// C read.c:seffect_stinking_cloud().
// C read.c:do_stinking_cloud().
async function cloudEffect(source, state) {
    const alreadyKnown = sourceTypeKnown(source, state);
    if (!alreadyKnown)
        await pline('You have found a scroll of stinking cloud!');
    const center = await chooseCenter(`Where do you want to center the ${alreadyKnown ? 'stinking ' : ''}cloud?`, state);
    if (!center)
        await pline('Never mind.');
    else if (!canCenterCloud(center.x, center.y, state)) {
        await pline(heroIsHallucinating(state) ? 'Ugh... someone cut the cheese.'
            : `${source.oclass === 9 ? 'The scroll crumbles with' : 'You smell'} a whiff of rotten eggs.`);
    }
    else {
        await createPoisonGasCloud(state, center.x, center.y, 15 + 10 * blessing(source), 8 + 4 * blessing(source));
    }
    return { known: true, consumed: false, heroDied: false };
}
function blessing(source) {
    return source.blessed ? 1 : source.cursed ? -1 : 0;
}
function sourceTypeKnown(source, state) {
    return source.oclass === 10 || !!OBJECT_INITIAL_KNOWN[source.otyp]
        || !!state._knownObjectTypes?.has(source.otyp);
}
function canCenterCloud(x, y, state) {
    if (!isok(x, y))
        return false;
    const location = state.level.at(x, y);
    if (!location)
        return false;
    return (ACCESSIBLE(location.typ)
        || isPoolAt(x, y, state) || isLavaAt(x, y, state))
        && cansee(x, y) && (x - state.u.ux) ** 2 + (y - state.u.uy) ** 2 < 32;
}
async function chooseCenter(question, state) {
    await pline(question);
    const valid = (x, y) => canCenterCloud(x, y, state);
    await prepareMapPositionHighlights(valid);
    const firstUse = await showGetposTip(state);
    await showGetposInstructions(state);
    if (firstUse)
        await pline('Move cursor to the desired position:');
    const selected = await selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy },
        prompt: state._pending_message,
        goal: 'the desired position',
        isValidLocation: valid,
        highlightHero: false,
    });
    // C getpos() clears the message window itself at exit, and only when a
    // non-autodescribe message is pending (getpos.c:exitgetpos); a pick made
    // with autodescribe on leaves the last description visible, and
    // do_stinking_cloud() prints nothing after a valid center.
    return selected;
}
// C read.c:seffect_teleportation(). The read transaction owns useup().
export async function teleportScrollEffect(source, { state = game, gotoLevel, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let known = false;
    if (source.cursed || state.u.confused || (state.u.confusionTurns ?? 0) > 0) {
        await levelTeleport({ state, ...(gotoLevel ? { gotoLevel } : {}) });
        known = true;
    }
    else {
        await teleportHero({
            source, chooseDestination: askTeleportDestination,
            discover: async () => {
                await learnScroll(source, { state });
            },
        });
    }
    return { known, consumed: false, heroDied: !!state.program_state.gameover };
}
// C read.c:seffect_food_detection().
// C read.c:seffect_gold_detection().
async function detectionEffect(source, state) {
    const detect = source.otyp === SCR_GOLD_DETECTION
        ? (source.cursed || (state.u.confusionTurns ?? 0) > 0 ? detectTraps : detectGold)
        : detectFood;
    const result = await detect(source, { state });
    if (result.strangeFeeling)
        await finishStrangeFeeling(source, { state });
    return { known: !!result.known, consumed: !!result.result };
}
// Native seffect_identify(), including the scroll-only consumption and
// discovery boundary before selecting the remaining inventory.
export async function identifyEffect(source, { state = game, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const isScroll = source.oclass === SCROLL_CLASS;
    const alreadyKnown = !isScroll || state._knownObjectTypes?.has(source.otyp);
    if (isScroll) {
        const selfOnly = (state.u.confusionTurns ?? 0) > 0 || (source.cursed && !alreadyKnown);
        await consumeInventoryItem(source);
        if (selfOnly)
            await plineWithContinuation('You identify this as an identify scroll.');
        else if (!alreadyKnown)
            await plineWithContinuation('This is an identify scroll.');
        if (!alreadyKnown)
            learnScrollType(SCR_IDENTIFY, { state });
        if (selfOnly)
            return [];
    }
    if (!state.inventory.length) {
        await plineWithContinuation(`You're not carrying anything${isScroll ? ' else' : ''} to be identified.`);
        return [];
    }
    let limit = 1;
    if (source.blessed || (!source.cursed && !rn2(5))) {
        limit = rn2(5);
        if (limit === 1 && source.blessed
            && (state.u.uluck ?? 0) + (state.u.moreluck ?? 0) > 0)
            limit++;
    }
    return identifyPack(limit, !alreadyKnown);
}
// C read.c:seffect_magic_mapping().
async function magicMappingEffect(source, state) {
    const isScroll = source.oclass === SCROLL_CLASS;
    if (state.level.flags.nommap) {
        if (isScroll) {
            await plineWithContinuation('Your mind is filled with crazy lines!');
            await plineWithContinuation(heroIsHallucinating(state)
                ? 'Wow!  Modern art.' : `Your ${heroHeadName(state)} spins in bewilderment.`);
        }
        else {
            await plineWithContinuation(`Your ${heroHeadName(state)} spins as something blocks the spell!`);
        }
        await makeConfused((state.u.confusionTurns ?? 0) + rnd(30), { state, talk: false });
        return;
    }
    if (isScroll && source.blessed) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                if (state.level.requireAt(x, y).typ === SDOOR)
                    revealSecretDoor(x, y);
            }
        }
    }
    await plineWithContinuation('A map coalesces in your mind!');
    const temporarilyConfused = source.cursed && !((state.u.confusionTurns ?? 0) > 0);
    if (temporarilyConfused)
        state.u.confusionTurns = 1;
    // C seffect_magic_mapping() suppresses notices through do_mapping(),
    // including its temporary map's redraw, without a catch-up afterward.
    await withMonsterNoticesBlocked(state, () => mapMagicLevel({ state }));
    if (temporarilyConfused) {
        state.u.confusionTurns = 0;
        await plineWithContinuation("Unfortunately, you can't grasp the details.");
    }
    return { known: isScroll };
}
// C read.c:seffects(). Scrolls and scroll-like spells use the same effects;
// the caller owns normal discovery, source disposal, and the action turn.
export async function applyScrollEffects(source, { state = game, gotoLevel, finishHeroDeath, finishMonsterKill, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hooks = { gotoLevel, finishHeroDeath, finishMonsterKill };
    await exerciseScrollWisdom(source.otyp, state);
    const result = await scrollEffect(source, state, hooks);
    return {
        known: !!result?.known,
        consumed: !!result?.consumed,
        heroDied: !!result?.heroDied || !!state.program_state.gameover,
    };
}
async function exerciseScrollWisdom(otyp, state) {
    if (OBJECT_MAGIC[otyp])
        await exerciseAttribute(A_WIS, true, state);
}
// C read.c:seffect_blank_paper().
// C read.c:seffect_create_monster().
// C read.c:seffect_genocide().
// C read.c:seffect_punishment().
async function scrollEffect(source, state, hooks) {
    switch (source.otyp) {
        case SCR_ENCHANT_ARMOR:
        case SCR_DESTROY_ARMOR:
        case SCR_ENCHANT_WEAPON:
            return applyArmorScrollEffect(source, { state });
        case SCR_AMNESIA:
        case SCR_FIRE:
        case SCR_EARTH:
        case SCR_STINKING_CLOUD:
            return applyAreaScrollEffect(source, {
                state,
                finishHeroDeath: hooks.finishHeroDeath,
                finishMonsterKill: hooks.finishMonsterKill,
            });
        case SCR_REMOVE_CURSE:
        case SPE_REMOVE_CURSE:
            await removeCurseEffect({ source, state, publish: plineWithContinuation });
            return;
        case SCR_CONFUSE_MONSTER:
        case SPE_CONFUSE_MONSTER:
            await confuseMonsterEffect(source, state);
            return;
        case SCR_GOLD_DETECTION:
        case SCR_FOOD_DETECTION:
        case SPE_DETECT_FOOD:
            return detectionEffect(source, state);
        case SCR_SCARE_MONSTER:
        case SPE_CAUSE_FEAR:
            return causeFearEffect(source, state);
        case SCR_IDENTIFY:
        case SPE_IDENTIFY:
            await identifyEffect(source, { state });
            return { consumed: source.oclass === SCROLL_CLASS };
        case SCR_TAMING:
        case SPE_CHARM_MONSTER:
            return charmMonsterEffect(source, state);
        case SCR_MAGIC_MAPPING:
        case SPE_MAGIC_MAPPING:
            return magicMappingEffect(source, state);
        case SCR_CREATE_MONSTER:
        case SPE_CREATE_MONSTER: {
            const confused = (state.u.confusionTurns ?? 0) > 0;
            const count = 1 + (confused || source.cursed ? 12 : 0)
                + (source.blessed || rn2(73) ? 0 : rnd(4));
            const known = await createCritters(count, confused ? MONSTER_NAME.indexOf('acid blob') : null);
            return { known };
        }
        case SCR_LIGHT:
            return applyLightScrollEffect(source, hooks.finishMonsterKill
                ? { finishMonsterKill: hooks.finishMonsterKill } : {});
        case SCR_GENOCIDE:
            if (source.oclass !== SPBOOK_CLASS && !OBJECT_INITIAL_KNOWN[source.otyp]
                && !state._knownObjectTypes?.has(source.otyp))
                await plineWithContinuation('You have found a scroll of genocide!');
            if (source.blessed)
                await doClassGenocide(hooks.finishHeroDeath
                    ? { finishHeroDeath: hooks.finishHeroDeath } : {});
            else
                await doGenocide(Number(!source.cursed)
                    | (2 * Number((state.u.confusionTurns ?? 0) > 0)), hooks.finishHeroDeath
                    ? { finishHeroDeath: hooks.finishHeroDeath } : {});
            return { known: true };
        case SCR_CHARGING:
            return chargingEffect(source, state);
        case SCR_TELEPORTATION:
            return teleportScrollEffect(source, { state, gotoLevel: hooks.gotoLevel });
        case SCR_PUNISHMENT:
            if (source.blessed || (state.u.confusionTurns ?? 0) > 0)
                await plineWithContinuation(formatFeltMessage('guilty.', state));
            else
                await punishHero(source);
            return { known: true };
        case SCR_BLANK_PAPER:
            await plineWithContinuation(heroIsBlind(state)
                ? "You don't remember there being any magic words on this scroll."
                : 'This scroll seems to be blank.');
            return { known: true };
        case SCR_MAIL:
            await mailEffect(source, state);
            return { known: true };
        default:
            await impossible(`What weird effect is this? (${source.otyp})`);
            return;
    }
}
//# sourceMappingURL=read.js.map