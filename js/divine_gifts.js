// C pray.c:pleased() favors, give_spell(), gcrownu(), and at_your_feet().
import { recordAchievement } from './achievements.js';
import { deityName } from './alignment.js';
import { findArmorClass } from './armor.js';
import { artifactById, artifactByName, discoverArtifact, findArtifact, nameArtifact, } from './artifacts.js';
import { heroFootName, monsterStomachName } from './body_parts.js';
import { ACH_TUNE, A_STR, P_BROAD_SWORD, P_LONG_SWORD, Upolyd } from './const.js';
import { displayColorName, newsym, plineWithContinuation as pline, see_monsters } from './display.js';
import { godVoice } from './divine_wrath.js';
import { gainExperienceLevel } from './exper.js';
import { placeCreatedObject } from './floor_object.js';
import { landFloorObject } from './floor_effects.js';
import { game, requirePlayingGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { restoreHeroNutrition } from './hunger.js';
import { mkobj, mksobj, rndClass } from './mklev.js';
import { MONSTER_FLAGS2, requireMonsterData } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { HELM_OF_OPPOSITE_ALIGNMENT, LONG_SWORD, MAGIC_MARKER, getObjectClassBounds, OBJECT_NAMES, OBJECT_SPELL_CATEGORY, OBJECT_SUBTYPE, SPE_BLANK_PAPER, requireObjectData, } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { withIndefiniteArticle, makePlural } from './object_grammar.js';
import { learnObjectType, observeObject, recordObjectEncounter } from './object_knowledge.js';
import { blessObjectState, uncurseObjectState } from './object_state.js';
import { objectName, ownedObjectAction, ownedObjectName, simpleObjectNameWithArticle } from './objnam.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty } from './properties.js';
import { rn1, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf, setHeroBlindnessTurns } from './senses.js';
import { adjustWeaponSkillSlots, ensureHeroSkills, SKILL_NAMES, unrestrictHeroSkill } from './skills.js';
import { forceLearnSpell, knownSpell } from './spell.js';
import { willWeld } from './weapon_type.js';
const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const SPBOOK_CLASS = 10;
const RUNESWORD = OBJECT_NAMES.indexOf('runesword');
const SPE_FINGER_OF_DEATH = OBJECT_NAMES.indexOf('finger of death');
const SPE_RESTORE_ABILITY = OBJECT_NAMES.indexOf('restore ability');
const DIVINE_PROPERTIES = ['telepathy', 'fast', 'stealth'];
const CROWNING_PROPERTIES = [
    'seeInvisible', 'fireResistance', 'coldResistance', 'shockResistance',
    'sleepResistance', 'poisonResistance',
];
export async function grantPrayerFavor(choice, alignment) {
    requirePlayingGame(game);
    switch (choice) {
        case 1:
            await blessWieldedWeapon();
            return;
        case 3:
            if (await revealCastleTune(alignment))
                return;
            // Once the tune is known, this favor becomes healing.
            await restoreHeroVigor();
            return;
        case 2:
            await restoreHeroVigor();
            return;
        case 4:
            await uncurseInventory();
            return;
        case 5:
            await grantDivineProperty();
            return;
        case 7:
        case 8:
            if (game.u.ualign.record >= 20 && !game.u.uevent?.uhand_of_elbereth) {
                await crownHero();
                return;
            }
            // A hero cannot be crowned twice.
            await giveSpell();
            return;
        case 6: await giveSpell();
    }
}
async function blessWieldedWeapon() {
    requirePlayingGame(game);
    const weapon = game.uwep;
    if (!weapon || !(willWeld(weapon) || isWeapon(weapon)))
        return;
    const damaged = weapon.oeroded || weapon.oeroded2;
    const repair = damaged ? ` and ${weapon.quan > 1 ? 'are' : 'is'} now as good as new` : '';
    const changed = weapon.cursed || !weapon.blessed;
    if (weapon.cursed) {
        await pline(heroIsBlind(game)
            ? `You feel the power of ${deityName(game.u.ualign.type)} over ${ownedObjectName(weapon, game, { capitalized: false })}.`
            : `${ownedObjectAction(weapon, 'softly glow')} ${displayColorName('amber')}${repair}.`);
        uncurseObjectState(weapon);
        weapon.bknown = true;
    }
    else if (!weapon.blessed) {
        const color = heroIsBlind(game) ? null : displayColorName('light blue');
        await pline(color === null
            ? `You feel the blessing of ${deityName(game.u.ualign.type)} over ${ownedObjectName(weapon, game, { capitalized: false })}.`
            : `${ownedObjectAction(weapon, 'softly glow')} with ${withIndefiniteArticle(color)} aura${repair}.`);
        blessObjectState(weapon);
        weapon.bknown = true;
    }
    if (damaged) {
        weapon.oeroded = weapon.oeroded2 = 0;
        if (!changed)
            await pline(`${ownedObjectAction(weapon, heroIsBlind(game) ? 'feel' : 'look')} as good as new!`);
    }
}
async function restoreHeroVigor() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!heroIsBlind(game)) {
        const color = displayColorName('golden');
        await pline(`You are surrounded by ${withIndefiniteArticle(color)} glow.`);
    }
    if (hero.ulevel < hero.ulevelmax) {
        hero.ulevelmax--;
        await gainExperienceLevel();
    }
    else {
        hero.uhpmax += 5;
        hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
        if (Upolyd(hero))
            hero.mhmax += 5;
    }
    hero.uhp = hero.uhpmax;
    if (Upolyd(hero))
        hero.mh = hero.mhmax;
    if (hero.acurr.a[A_STR] < hero.amax.a[A_STR]) {
        hero.acurr.a[A_STR] = hero.amax.a[A_STR];
        game.context.botl = true;
    }
    if (hero.uhunger < 900)
        await pline(restoreHeroNutrition());
    hero.uluck = Math.max(0, hero.uluck || 0);
    hero.ucreamed = 0;
    const { regainedSight } = setHeroBlindnessTurns(0);
    if (regainedSight)
        await pline('You can see again.');
    game.context.botl = true;
}
async function revealCastleTune(alignment) {
    requirePlayingGame(game);
    const event = game.u.uevent ||= {};
    if (event.uopened_dbridge || event.gehennom_entered || (event.uheard_tune ?? 0) >= 2)
        return false;
    if (!event.uheard_tune) {
        await godVoice(alignment);
        await pline(`"Hark, ${requireMonsterData(MONSTER_FLAGS2, game.u.umonnum) & 0x08 ? 'mortal' : 'creature'}!"`);
        await pline('"To enter the castle, thou must play the right tune!"');
    }
    else {
        if (!heroIsDeaf(game))
            await pline('You hear a divine music...');
        await pline(`It sounds like:  "${game.castleTune}".`);
        recordAchievement(game, ACH_TUNE);
    }
    event.uheard_tune = (event.uheard_tune || 0) + 1;
    return true;
}
async function uncurseInventory() {
    requirePlayingGame(game);
    const blind = heroIsBlind(game);
    if (blind)
        await pline(`You feel the power of ${deityName(game.u.ualign.type)}.`);
    else {
        const color = displayColorName('light blue');
        await pline(`You are surrounded by ${withIndefiniteArticle(color)} aura.`);
    }
    for (const object of game.inventory) {
        if (!object.cursed || object === game.uarmh && object.otyp === HELM_OF_OPPOSITE_ALIGNMENT)
            continue;
        if (!blind) {
            await pline(`${ownedObjectAction(object, 'softly glow')} ${displayColorName('amber')}.`);
            object.bknown = true;
        }
        uncurseObjectState(object);
    }
}
async function grantDivineProperty() {
    requirePlayingGame(game);
    await godVoice(game.u.ualign.type, 'Thou hast pleased me with thy progress,');
    const gift = DIVINE_PROPERTIES.find(property => !hasPermanentIntrinsicProperty(property));
    let name;
    if (gift) {
        grantIntrinsicProperty(gift, 'outside');
        name = { telepathy: 'Telepathy', fast: 'Speed', stealth: 'Stealth' }[gift];
        if (gift === 'telepathy' && heroIsBlind(game))
            await see_monsters();
    }
    else {
        if (!hasPermanentIntrinsicProperty('protection')) {
            grantIntrinsicProperty('protection', 'outside');
            if (!game.u.ublessed)
                game.u.ublessed = rn1(3, 2);
        }
        else
            game.u.ublessed = (game.u.ublessed || 0) + 1;
        findArmorClass();
        name = 'my protection';
    }
    await pline(`"and thus I grant thee the gift of ${name}!"`);
    await pline('"Use it wisely in my name!"');
}
export async function announceDivineGift(description) {
    requirePlayingGame(game);
    if (heroIsBlind(game))
        description = 'Something';
    description = description.charAt(0).toUpperCase() + description.slice(1);
    if (game.u.uswallow) {
        const monster = game.u.ustuck;
        if (!monster)
            throw new Error('A swallowed hero must have a swallowing monster');
        const name = monsterName(monster);
        const owner = /s$/.test(name) ? `${name}'` : `${name}'s`;
        const stomach = monsterStomachName(monster.mnum);
        await pline(`${description} drops into ${owner} ${stomach}.`);
    }
    else {
        await pline(`${description} ${heroIsBlind(game) ? 'lands' : 'appears'} ${game.u.levitating ? 'beneath' : 'at'} your ${makePlural(heroFootName())}!`);
    }
}
async function dropGift(object, description) {
    await announceDivineGift(description);
    if (game.u.uswallow) {
        const monster = game.u.ustuck;
        if (!monster)
            throw new Error('A swallowed hero must have a swallowing monster');
        await addObjectToMonsterInventory(monster, object);
    }
    else
        await landFloorObject(object, game.u.ux, game.u.uy);
}
async function giveSpell() {
    requirePlayingGame(game);
    const book = await mkobj(-SPBOOK_CLASS, true);
    const skills = ensureHeroSkills(game);
    if (!skills)
        throw new Error('Divine spell gifts require initialized hero skills');
    let tries = game.u.ulevel + 1;
    while (--tries > 0) {
        if (book.otyp === SPE_BLANK_PAPER) {
            if (!game._knownObjectTypes?.has(book.otyp)
                || game.inventory.some(object => object.otyp === MAGIC_MARKER))
                break;
        }
        else {
            const skill = SKILL_NAMES.indexOf(`${OBJECT_SPELL_CATEGORY[book.otyp]} spells`);
            if (['unknown', 'forgotten'].includes(knownSpell(book.otyp)) && (skills[skill]?.skill ?? 0) > 0)
                break;
        }
        book.otyp = rndClass(getObjectClassBounds(SPBOOK_CLASS).first, SPE_BLANK_PAPER);
    }
    let knowledge;
    if (book.otyp !== SPE_BLANK_PAPER && !rn2(4)
        && (knowledge = knownSpell(book.otyp)) !== 'fresh') {
        const letter = forceLearnSpell(book.otyp);
        if (letter) {
            await pline(knowledge === 'unknown'
                ? `Divine knowledge of ${OBJECT_NAMES[book.otyp]} fills your mind!  Spell '${letter}'.`
                : `Your knowledge of spell '${letter}' - ${OBJECT_NAMES[book.otyp]} is ${knowledge === 'forgotten' ? 'restored' : 'refreshed'}.`);
        }
        await deleteObject(book);
    }
    else {
        book.dknown = true;
        recordObjectEncounter(book.otyp);
        if (book.otyp === SPE_BLANK_PAPER || !rn2(100))
            learnObjectType(book.otyp);
        blessObjectState(book);
        const name = simpleObjectNameWithArticle(book);
        await announceDivineGift(name.charAt(0).toUpperCase() + name.slice(1));
        placeCreatedObject(book, game.u.ux, game.u.uy);
        newsym(game.u.ux, game.u.uy);
    }
}
async function crownHero() {
    requirePlayingGame(game);
    const hero = game.u;
    for (const property of CROWNING_PROPERTIES)
        grantIntrinsicProperty(property, 'outside');
    await godVoice(hero.ualign.type);
    const heldArtifact = artifactById(game.uwep?.oartifact)?.name;
    let classGift = null;
    if (game.urole.key === 'wizard' && heldArtifact !== 'Vorpal Blade' && heldArtifact !== 'Stormbringer'
        && !game.inventory.some(object => object.otyp === SPE_FINGER_OF_DEATH))
        classGift = SPE_FINGER_OF_DEATH;
    else if (game.urole.key === 'monk' && !game.uwep?.oartifact
        && !game.inventory.some(object => object.otyp === SPE_RESTORE_ABILITY))
        classGift = SPE_RESTORE_ABILITY;
    let object = isWeapon(game.uwep) ? game.uwep : null;
    const artifact = artifactByName(hero.ualign.type > 0 ? 'Excalibur'
        : hero.ualign.type < 0 ? 'Stormbringer' : 'Vorpal Blade');
    if (!artifact)
        throw new Error('The crowning artifact must be present in the artifact definitions');
    const existing = game._artifactExists?.has(artifact.id);
    const held = heldArtifact === artifact.name;
    const event = hero.uevent ||= {};
    event.uhand_of_elbereth = hero.ualign.type > 0 ? 1 : hero.ualign.type < 0 ? 3 : 2;
    const deity = deityName(hero.ualign.type);
    if (hero.ualign.type > 0) {
        await pline('"I crown thee...  The Hand of Elbereth!"');
        recordGameLogEvent(`was crowned "The Hand of Elbereth" by ${deity}`);
    }
    else if (hero.ualign.type === 0) {
        await pline('"Thou shalt be my Envoy of Balance!"');
        recordGameLogEvent(`became ${deity}${deity.endsWith('s') ? "'" : "'s"} Envoy of Balance`);
    }
    else {
        const action = (existing && !held) || classGift ? 'take lives' : 'steal souls';
        await pline(`"Thou art chosen to ${action} for My Glory!"`);
        recordGameLogEvent(`was chosen to ${action} for the Glory of ${deity}`);
    }
    if (classGift) {
        object = await mksobj(classGift, true, false);
        blessObjectState(object);
        object.bknown = object.dknown = true;
        recordObjectEncounter(object.otyp);
        const name = simpleObjectNameWithArticle(object);
        await dropGift(object, name.charAt(0).toUpperCase() + name.slice(1));
        hero.ugifts = (hero.ugifts || 0) + 1;
        recordGameLogEvent(`was bestowed with spellbook of ${OBJECT_NAMES[classGift]}`);
        if (knownSpell(classGift) !== 'unknown' && isWeapon(game.uwep))
            object = game.uwep;
    }
    if (hero.ualign.type > 0) {
        if (!classGift && object?.otyp === LONG_SWORD && !object.oartifact) {
            if (!heroIsBlind(game))
                await pline('Your sword shines brightly for a moment.');
            const before = objectName(object);
            if (nameArtifact(object, artifact, { knownOrigin: true })) {
                hero.ugifts = (hero.ugifts || 0) + 1;
                recordGameLogEvent(`had ${game.flags.female ? 'her' : 'his'} wielded ${before} transformed into ${artifact.name}`);
            }
        }
    }
    else {
        const blackSword = hero.ualign.type < 0 ? `${displayColorName('black')} sword` : null;
        if (!classGift && object && held) {
            if (hero.ualign.type === 0) {
                if (!heroIsBlind(game))
                    observeObject(object);
                findArtifact(object);
                await pline(`Your ${objectName(object)} goes snicker-snack!`);
            }
            else {
                await pline(`Your ${blackSword} hums ominously!`);
            }
            observeObject(object);
        }
        else if (!classGift && !existing) {
            object = await mksobj(hero.ualign.type < 0 ? RUNESWORD : LONG_SWORD, false, false);
            nameArtifact(object, artifact, { knownOrigin: true });
            object.spe = 1;
            await dropGift(object, blackSword ? withIndefiniteArticle(blackSword) : 'A sword');
            hero.ugifts = (hero.ugifts || 0) + 1;
            recordGameLogEvent(`was bestowed with ${artifact.name}`);
        }
    }
    unrestrictHeroSkill(hero.ualign.type < 0 ? P_BROAD_SWORD : P_LONG_SWORD);
    if (object?.oartifact === artifact.id)
        discoverArtifact(artifact.id);
    if (isWeapon(object)) {
        blessObjectState(object);
        object.oeroded = object.oeroded2 = 0;
        object.oerodeproof = object.bknown = object.rknown = true;
        object.spe = Math.max(1, object.spe);
        unrestrictHeroSkill(Math.abs(requireObjectData(OBJECT_SUBTYPE, object.otyp)));
    }
    else if (!classGift)
        await pline('You feel unworthy.');
    await adjustWeaponSkillSlots(1);
}
function isWeapon(object) {
    return !!object && (object.oclass === WEAPON_CLASS
        || object.oclass === TOOL_CLASS && requireObjectData(OBJECT_SUBTYPE, object.otyp) !== 0);
}
//# sourceMappingURL=divine_gifts.js.map