// Offerings at altars.
// C pray.c:dosacrifice(), offer_corpse(), and the Amulet offering helpers.
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { nomul } from './command_state.js';
import { observeObjectForNaming } from './objnam.js';
import { adjustHeroAlignment, convertHeroAlignment, deityName } from './alignment.js';
import { artifactById, artifactExistCount, createArtifactGift, discoverArtifact, markArtifactFound, } from './artifacts.js';
import { adjustAttribute, exerciseAttribute } from './attrib.js';
import { heroFootName } from './body_parts.js';
import { A_NONE, A_WIS, ALTAR, AM_SANCTUM, AM_SHRINE, Align2amask, Amask2align, Is_astralevel, LUCKMAX, LUCKMIN, MM_NOMSG, ROOM, STRAT_APPEARMSG, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, } from './const.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { displayColorName, newsym, plineWithContinuation as pline, } from './display.js';
import { angryGods, desecrateAltar, fryByGod, godsUpset, godVoice } from './divine_wrath.js';
import { announceDivineGift } from './divine_gifts.js';
import { finishHeroDeath, finishLivingGame } from './end.js';
import { landFloorObject } from './floor_effects.js';
import { floorObjectDescription } from './floor_object_display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { recordGameLogEvent } from './gamelog.js';
import { game, requireInitializedGame } from './gstate.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { demonLord, summonMinion } from './minion.js';
import { makemonNear } from './mklev.js';
import { MONSTER_ALIGNMENT, MONSTER_BODY_META, MONSTER_DIFFICULTY, MONSTER_FLAGS2, MONSTER_NAME, monsterIsUnicorn, } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { AMULET_OF_YENDOR, CORPSE, FAKE_AMULET_OF_YENDOR, OBJECT_SUBTYPE, } from './object_data.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { simpleObjectNameWithArticle } from './objnam.js';
import { learnObjectType, recordObjectEncounter } from './object_knowledge.js';
import { useUpFloorObject } from './floor_consumption.js';
import { objectQuantity } from './object_stack.js';
import { uncurseObjectState } from './object_state.js';
import { angerTemplePriest } from './priest.js';
import { heroFormHidesUnderObjects } from './polyself.js';
import { grantIntrinsicProperty, propertyIsActive } from './properties.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { rn2, rnl, rnd, rnz } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { unrestrictHeroSkill } from './skills.js';
import { heroResistsStoning, touchPetrifies, touchPetrifyingCorpse } from './stoning.js';
const AMULET_CLASS = 5;
const FOOD_CLASS = 7;
const M2_UNDEAD = 0x00000002;
const M2_DEMON = 0x00000100;
const PM_ACID_BLOB = MONSTER_NAME.indexOf('acid blob');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const MAX_VALUE = 24;
function requireCorpseOffering(object) {
    if (object.otyp !== CORPSE || object.corpsenm === undefined || object.age === undefined)
        throw new Error('A corpse offering requires its species and creation time.');
}
export async function dosacrifice() {
    const game = requireInitializedGame();
    game.context.move = 0;
    const hero = game.u;
    const altar = game.level.requireAt(hero.ux, hero.uy);
    if (altar.typ !== ALTAR || hero.uswallow) {
        await pline(`You are not ${hero.levitating || hero.flying ? 'over' : 'on'} an altar.`);
        return;
    }
    if (propertyIsActive('confusion') || propertyIsActive('stunned')) {
        await pline('You are too impaired to perform the rite.');
        return;
    }
    const offering = await chooseOffering();
    if (!offering)
        return;
    game.context.move = 1;
    const alignment = Amask2align(altar.flags);
    const highAltar = !!(altar.flags & AM_SANCTUM);
    if (offering.otyp === AMULET_OF_YENDOR) {
        if (highAltar)
            await offerAmulet(offering, alignment);
        else
            await offerAmuletTooSoon(alignment);
    }
    else if (offering.otyp === FAKE_AMULET_OF_YENDOR) {
        await offerFakeAmulet(offering, highAltar, alignment);
    }
    else if (offering.otyp === CORPSE) {
        await offerCorpse(offering, highAltar, alignment);
    }
    else {
        await pline('Nothing happens.');
    }
}
async function chooseOffering() {
    const game = requireInitializedGame();
    const hero = game.u;
    let declinedFloor = false;
    if (!game.iflags.menu_requested && heroCanReachFloor(game, { checkPit: true })) {
        const corpses = (game.level.objects?.[hero.ux]?.[hero.uy] || [])
            .filter(object => object.otyp === CORPSE);
        for (const corpse of corpses) {
            if (heroIsBlind(game) && !(game.uarmg || hero.uarmg)
                && !heroResistsStoning() && touchPetrifies(corpse.corpsenm)) {
                await touchPetrifyingCorpse(corpse);
                return null;
            }
            const single = objectQuantity(corpse) === 1;
            observeObjectForNaming(corpse);
            const answer = await promptYesNoQuit(`There ${single ? 'is' : 'are'} ${floorObjectDescription(corpse)} here; sacrifice ${single ? 'it' : 'one'}?`, 'n');
            if (answer === 'y')
                return corpse;
            if (answer === 'q')
                return null;
            declinedFloor = true;
        }
    }
    const astral = Is_astralevel(hero.uz);
    const object = await chooseInventoryObject('sacrifice', object => {
        if (object.oclass !== FOOD_CLASS && object.oclass !== AMULET_CLASS)
            return GETOBJ_EXCLUDE;
        if (![CORPSE, AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(object.otyp))
            return GETOBJ_EXCLUDE_SELECTABLE;
        return astral !== (object.oclass === AMULET_CLASS) ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST;
    }, { emptyMessage: `You don't have anything ${declinedFloor ? 'else ' : ''}to sacrifice.` });
    if (object && object.oclass !== AMULET_CLASS && object.otyp !== CORPSE) {
        await pline("You can't sacrifice that!");
        return null;
    }
    return object;
}
async function offerCorpse(corpse, highAltar, alignment) {
    const game = requireInitializedGame();
    requireCorpseOffering(corpse);
    const hero = game.u;
    const conduct = hero.uconduct ||= {};
    if (!conduct.gnostic)
        recordGameLogEvent(`rejected atheism by offering ${inventoryItemDescription(corpse)} on an altar of ${deityName(alignment)}`);
    conduct.gnostic = (conduct.gnostic || 0) + 1;
    await touchPetrifyingCorpse(corpse);
    if (game.program_state.gameover)
        return;
    if (isRider(corpse.corpsenm)) {
        await pline('At your touch, the corpse suddenly moves...');
        const revival = await reviveCorpseImmediately(corpse);
        for (const message of revival?.messages ?? [])
            await pline(message);
        await exerciseAttribute(A_WIS, false);
        return;
    }
    if ((MONSTER_FLAGS2[corpse.corpsenm] ?? 0) & game.urace.selfmask) {
        await offerOwnRace(corpse, highAltar, alignment);
        return;
    }
    if (corpse.oextra?.omonst?.mtame) {
        await pline('So this is how you repay loyalty?');
        adjustHeroAlignment(-3);
        grantIntrinsicProperty('aggravateMonster', 'outside');
        await rejectOffering(highAltar, alignment);
        return;
    }
    const value = await offeringValue(corpse, alignment);
    if (value === 0) {
        await pline('Nothing happens.');
        return;
    }
    if (value < 0) {
        await rejectOffering(highAltar, alignment);
        return;
    }
    if (alignment !== hero.ualign.type) {
        if (highAltar)
            await desecrateAltar(true, alignment);
        else
            await offerToAnotherGod(corpse, alignment);
        return;
    }
    await consumeOffering(corpse);
    await rewardOffering(value);
}
async function offeringValue(corpse, alignment) {
    const game = requireInitializedGame();
    const age = corpse.on_ice ? corpse.age + Math.trunc((game.moves - corpse.age) / 2) : corpse.age;
    if (corpse.corpsenm !== PM_ACID_BLOB && game.moves > age + 50)
        return 0;
    const difficulty = MONSTER_DIFFICULTY[corpse.corpsenm];
    if (difficulty === undefined)
        throw new RangeError(`Unknown sacrifice species ${corpse.corpsenm}`);
    let value = difficulty + 1;
    if (corpse.oeaten) {
        const body = MONSTER_BODY_META[corpse.corpsenm];
        if (!body)
            throw new RangeError(`Unknown corpse body ${corpse.corpsenm}`);
        const nutrition = body[1];
        value = Math.max(1, nutrition
            ? Math.trunc(value * Math.min(corpse.oeaten, nutrition) / nutrition) : 0);
    }
    const hero = game.u;
    if ((MONSTER_FLAGS2[corpse.corpsenm] ?? 0) & M2_UNDEAD) {
        if (hero.ualign.type !== -1 || corpse.corpsenm === PM_WRAITH && hero.uconduct?.unvegetarian)
            value++;
    }
    else if (monsterIsUnicorn(corpse.corpsenm)) {
        const unicornAlignment = Math.sign(MONSTER_ALIGNMENT[corpse.corpsenm] ?? 0);
        if (unicornAlignment === alignment) {
            const insult = alignment < 0 ? 'chaos' : alignment > 0 ? 'law' : 'balance';
            await pline(`Such an action is an insult to ${insult}!`);
            adjustAttribute(A_WIS, -1);
            return -1;
        }
        if (hero.ualign.type === alignment) {
            const name = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
            await pline(formatFeltMessage(hero.ualign.record < alignmentLimit() ? `appropriately ${name}.` : 'you are thoroughly on the right path.'));
            adjustHeroAlignment(5);
            value += 3;
        }
        else if (unicornAlignment === hero.ualign.type) {
            hero.ualign.record = -1;
            value = 1;
        }
        else
            value += 3;
    }
    return value;
}
async function consumeOffering(object) {
    const game = requireInitializedGame();
    if (heroIsHallucinating(game)) {
        const messages = [
            'Your sacrifice sprouts wings and a propeller and roars away!',
            'Your sacrifice puffs up, swelling bigger and bigger, and pops!',
            'Your sacrifice collapses into a cloud of dancing particles and fades away!',
        ];
        const message = messages[rn2(messages.length)];
        if (message === undefined)
            throw new Error('Sacrifice message RNG selected an invalid entry.');
        await pline(message);
    }
    else if (heroIsBlind(game) && game.u.ualign.type === 1) {
        await pline('Your sacrifice disappears!');
    }
    else {
        const effect = game.u.ualign.type === 1 ? 'flash of light'
            : game.u.ualign.type === 0 ? 'plume of smoke' : 'burst of flame';
        await pline(`Your sacrifice is consumed in a ${effect}!`);
    }
    await useOffering(object);
    await exerciseAttribute(A_WIS, true);
}
// C pray.c: carried offerings go through useup(), floor ones useupf(..., 1).
async function useOffering(object) {
    const game = requireInitializedGame();
    if (game.inventory.includes(object)) {
        await consumeInventoryItem(object);
    }
    else {
        await useUpFloorObject(object, 1, { state: game });
        if (game.u.uundetected && heroFormHidesUnderObjects()
            && !game.level.objects?.[game.u.ux]?.[game.u.uy]?.length)
            game.u.uundetected = false;
        newsym(game.u.ux, game.u.uy);
    }
}
async function rejectOffering(highAltar, alignment) {
    const game = requireInitializedGame();
    if (highAltar && alignment !== game.u.ualign.type)
        await desecrateAltar(true, alignment);
    else
        await godsUpset(alignment);
}
async function offerToAnotherGod(corpse, alignment) {
    const game = requireInitializedGame();
    const hero = game.u;
    if (hero.ualign.record < 0 || alignment === A_NONE && inHell()) {
        const original = hero.ualignbase?.[1] ?? hero.ualign.type;
        const current = hero.ualignbase?.[0] ?? hero.ualign.type;
        if (current === original && alignment !== A_NONE) {
            await pline(`You have a strong feeling that ${deityName(hero.ualign.type)} is angry...`);
            await consumeOffering(corpse);
            await pline(`${deityName(alignment)} accepts your allegiance.`);
            if (alignment !== -1 && alignment !== 0 && alignment !== 1)
                throw new Error(`Cannot convert to altar alignment ${alignment}`);
            await convertHeroAlignment(alignment);
            if (game.program_state.gameover)
                return;
            changeLuck(-3);
            hero.ublesscnt = (hero.ublesscnt || 0) + 300;
        }
        else {
            hero.ugangr = (hero.ugangr || 0) + 3;
            adjustHeroAlignment(-5);
            await pline(`${deityName(alignment)} rejects your sacrifice!`);
            await godVoice(alignment, 'Suffer, infidel!');
            changeLuck(-5);
            adjustAttribute(A_WIS, -2);
            if (!inHell())
                await angryGods(hero.ualign.type);
        }
        return;
    }
    await consumeOffering(corpse);
    await pline(`You sense a conflict between ${deityName(hero.ualign.type)} and ${deityName(alignment)}.`);
    if (rn2(8 + hero.ulevel) > 5) {
        await pline(formatFeltMessage(`the power of ${deityName(hero.ualign.type)} increase.`));
        await exerciseAttribute(A_WIS, true);
        changeLuck(1);
        const altar = game.level.requireAt(hero.ux, hero.uy);
        altar.flags = Align2amask(hero.ualign.type) | (altar.flags & AM_SHRINE);
        newsym(hero.ux, hero.uy);
        if (!heroIsBlind(game)) {
            const color = hero.ualign.type > 0 ? 'white' : hero.ualign.type < 0 ? 'black' : 'gray';
            await pline(`The altar glows ${displayColorName(color)}.`);
        }
        if (rnl(hero.ulevel) > 6 && hero.ualign.record > 0
            && rnd(hero.ualign.record) > Math.trunc(3 * alignmentLimit() / 4))
            await summonMinion(alignment, true);
        await angerTemplePriest(game, true);
    }
    else {
        await pline(`Unluckily, you feel the power of ${deityName(hero.ualign.type)} decrease.`);
        changeLuck(-1);
        await exerciseAttribute(A_WIS, false);
        if (rnl(hero.ulevel) > 6 && hero.ualign.record > 0
            && rnd(hero.ualign.record) > Math.trunc(7 * alignmentLimit() / 8))
            await summonMinion(alignment, true);
    }
}
async function offerOwnRace(corpse, highAltar, alignment) {
    const game = requireInitializedGame();
    const hero = game.u;
    if ((MONSTER_FLAGS2[hero.umonnum] ?? 0) & M2_DEMON) {
        await pline('You find the idea very satisfying.');
        await exerciseAttribute(A_WIS, true);
    }
    else if (hero.ualign.type !== -1) {
        await pline("You'll regret this infamous offense!");
        await exerciseAttribute(A_WIS, false);
    }
    if (highAltar && (alignment !== -1 || hero.ualign.type !== -1)) {
        await desecrateAltar(true, alignment);
        return;
    }
    const altar = game.level.requireAt(hero.ux, hero.uy);
    if (alignment !== -1 && alignment !== A_NONE) {
        await pline(`The altar is stained with ${game.urace.adj} blood.`);
        altar.flags = Align2amask(-1);
        newsym(hero.ux, hero.uy);
        await angerTemplePriest();
    }
    else {
        let failure;
        if (alignment === -1 && hero.ualign.type !== -1) {
            const color = displayColorName('black');
            await pline(`The blood floods the altar, which vanishes in ${withIndefiniteArticle(color)} cloud!`);
            altar.typ = ROOM;
            altar.flags = 0;
            newsym(hero.ux, hero.uy);
            await angerTemplePriest();
            failure = 'The cloud dissipates.';
        }
        else {
            await pline('The blood covers the altar!');
            changeLuck(alignment === A_NONE ? -2 : 2);
            failure = 'The blood coagulates.';
        }
        const type = demonLord(alignment);
        const demon = type == null ? null : await makemonNear(type, hero.ux, hero.uy, MM_NOMSG);
        if (demon && type !== null) {
            const name = monsterName(demon, { article: 'a' });
            if (name !== 'it')
                demon.mstrategy = (demon.mstrategy ?? 0) & ~STRAT_APPEARMSG;
            await pline(`You have summoned ${name === 'it' ? 'something dreadful' : name}!`);
            if (Math.sign(hero.ualign.type) === Math.sign(MONSTER_ALIGNMENT[type] ?? 0))
                demon.mpeaceful = true;
            await pline('You are terrified, and unable to move.');
            nomul(-3);
            game._helplessReason = 'being terrified of a demon';
            game._helplessDoneMessage = '';
        }
        else
            await pline(failure);
    }
    if (hero.ualign.type !== -1) {
        adjustHeroAlignment(-5);
        hero.ugangr = (hero.ugangr || 0) + 3;
        adjustAttribute(A_WIS, -1);
        if (!inHell())
            await angryGods(hero.ualign.type);
        if (game.program_state.gameover)
            return;
        changeLuck(-5);
    }
    else
        adjustHeroAlignment(5);
    await useOffering(corpse);
}
async function rewardOffering(value) {
    const game = requireInitializedGame();
    const hero = game.u;
    const hallucinating = heroIsHallucinating(game);
    if ((hero.ugangr ?? 0) > 0) {
        const previous = hero.ugangr ?? 0;
        hero.ugangr = Math.max(0, previous - Math.trunc(value * (hero.ualign.type === -1 ? 2 : 3) / MAX_VALUE));
        if (hero.ugangr === previous) {
            await pline(hallucinating ? 'The gods seem tall.' : 'You have a feeling of inadequacy.');
        }
        else {
            const mood = hero.ugangr ? (hallucinating ? 'groovy' : 'slightly mollified')
                : (hallucinating ? 'cosmic (not a new fact)' : 'mollified');
            await pline(`${deityName(hero.ualign.type)} seems ${mood}.`);
            if ((hero.uluck ?? 0) < 0) {
                if (hero.ugangr)
                    changeLuck(1);
                else
                    hero.uluck = 0;
            }
        }
    }
    else if (hero.ualign.record < 0) {
        adjustHeroAlignment(Math.min(value, MAX_VALUE, -hero.ualign.record));
        await pline(formatFeltMessage('partially absolved.'));
    }
    else if (hero.ublesscnt > 0) {
        const previous = hero.ublesscnt;
        hero.ublesscnt = Math.max(0, previous - Math.trunc(value * (hero.ualign.type === -1 ? 500 : 300) / MAX_VALUE));
        if (hero.ublesscnt !== previous) {
            await pline(hero.ublesscnt
                ? (hallucinating ? 'You realize that the gods are not like you and I.' : 'You have a hopeful feeling.')
                : (hallucinating ? 'Overall, there is a smell of fried onions.' : 'You have a feeling of reconciliation.'));
            if ((hero.uluck ?? 0) < 0) {
                if (hero.ublesscnt)
                    changeLuck(1);
                else
                    hero.uluck = 0;
            }
        }
    }
    else {
        if (await bestowArtifact(value))
            return;
        const previous = hero.uluck || 0;
        const increase = Math.min(Math.trunc(value * LUCKMAX / (MAX_VALUE * 2)), Math.max(0, value - previous));
        changeLuck(increase);
        hero.uluck = Math.max(0, hero.uluck ?? 0);
        if (hero.uluck !== previous) {
            const feet = makePlural(heroFootName());
            await pline(heroIsBlind(game)
                ? `You think something brushed your ${heroFootName()}.`
                : hallucinating ? `You see crabgrass at your ${feet}.  A funny thing in a dungeon.`
                    : `You glimpse a four-leaf clover at your ${feet}.`);
        }
    }
}
async function bestowArtifact(value) {
    const game = requireInitializedGame();
    const hero = game.u;
    if (hero.ulevel <= 2 || (hero.uluck ?? 0) < 0)
        return false;
    const count = artifactExistCount();
    const selected = game.flags.debug
        ? await promptYesNo('Gift an artifact?') === 'y'
        : rn2(6 + 2 * (hero.ugifts || 0) * count) === 0;
    if (!selected)
        return false;
    const object = await createArtifactGift(hero.ualign.type, value);
    if (!object)
        return false;
    if (object.oartifact === undefined)
        throw new Error('An artifact gift requires an artifact id.');
    markArtifactFound(object.oartifact);
    const artifact = artifactById(object.oartifact);
    if (!artifact)
        throw new Error('An artifact gift must have a registered artifact identity.');
    if (object.spe === undefined)
        throw new Error('An artifact gift must have an enchantment value.');
    object.spe = Math.max(0, object.spe);
    if (object.cursed)
        uncurseObjectState(object);
    object.oerodeproof = true;
    const blind = heroIsBlind(game);
    const hallucinating = heroIsHallucinating(game);
    let noun = hallucinating ? 'a doodad' : blind ? 'an object' : simpleObjectNameWithArticle(object);
    if (!blind)
        noun += ` named ${artifact.name.replace(/^The /, '')}`;
    await announceDivineGift(noun);
    await landFloorObject(object, hero.ux, hero.uy);
    await godVoice(hero.ualign.type, 'Use my gift wisely!');
    hero.ugifts = (hero.ugifts || 0) + 1;
    hero.ublesscnt = rnz(300 + 50 * count);
    await exerciseAttribute(A_WIS, true);
    recordGameLogEvent(`was bestowed with ${artifact.name} by ${deityName(hero.ualign.type)}`);
    const skillType = [2, 6, 13].includes(object.oclass ?? 0)
        ? Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0) : 0;
    unrestrictHeroSkill(skillType);
    if (!hallucinating && !blind) {
        object.dknown = true;
        recordObjectEncounter(object.otyp);
        learnObjectType(object.otyp);
        discoverArtifact(artifact.id);
    }
    return true;
}
async function offerAmuletTooSoon(alignment) {
    const game = requireInitializedGame();
    if (alignment === A_NONE && inHell())
        await godsUpset(A_NONE);
    else
        await pline(formatFeltMessage(`${heroIsHallucinating(game) ? 'homesick'
            : alignment === game.u.ualign.type ? 'an urge to return to the surface' : 'ashamed'}.`));
}
async function offerFakeAmulet(amulet, highAltar, alignment) {
    const game = requireInitializedGame();
    if (!highAltar && !amulet.known) {
        await offerAmuletTooSoon(alignment);
        return;
    }
    await publishHeardMessage('a nearby thunderclap.', pline);
    if (!amulet.known) {
        await pline(`You realize you have made a ${heroIsHallucinating(game) ? 'boo-boo' : 'mistake'}.`);
        amulet.known = true;
        changeLuck(-1);
    }
    else {
        if (heroIsDeaf(game))
            await pline('Oh, no.');
        changeLuck(-3);
        adjustHeroAlignment(-1);
        game.u.ugangr = (game.u.ugangr || 0) + 3;
        await rejectOffering(highAltar, alignment);
    }
}
async function offerAmulet(amulet, alignment) {
    const game = requireInitializedGame();
    const hero = game.u;
    await useOffering(amulet);
    await pline(`You offer the Amulet of Yendor to ${deityName(alignment)}...`);
    if (alignment === A_NONE) {
        hero.ualign.record = Math.min(hero.ualign.record, -99);
        await pline('An invisible choir chants, and you are bathed in darkness...');
        await pline(`Moloch shrugs and retains dominion over ${deityName(hero.ualign.type)},`);
        await pline('then mercilessly snuffs out your life.');
        if (await finishHeroDeath({
            killer: "Moloch's indifference", deathCause: "killed by Moloch's indifference",
            deathLineShown: true,
        }))
            return;
        await pline('Moloch snarls and tries again...');
        if (await fryByGod(A_NONE, true))
            return;
        await pline(`A cloud of ${displayColorName('black')} smoke surrounds you...`);
        await finishLivingGame('escaped');
    }
    else if (alignment !== hero.ualign.type) {
        adjustHeroAlignment(-99);
        await pline(`${deityName(alignment)} accepts your gift, and gains dominion over ${deityName(hero.ualign.type)}...`);
        await pline(`${deityName(hero.ualign.type)} is enraged...`);
        await pline(`Fortunately, ${deityName(alignment)} permits you to live...`);
        await pline(`A cloud of ${displayColorName('orange')} smoke surrounds you...`);
        await finishLivingGame('escaped');
    }
    else {
        (hero.uevent ||= {}).ascended = 1;
        adjustHeroAlignment(10);
        await pline('An invisible choir sings, and you are bathed in radiance...');
        await godVoice(alignment, 'Mortal, thou hast done well!');
        await pline('"In return for thy service, I grant thee the gift of Immortality!"');
        await pline(`You ascend to the status of ${game.flags.female ? 'Demigoddess' : 'Demigod'}...`);
        await finishLivingGame('ascended');
    }
}
function alignmentLimit() {
    return 10 + Math.trunc(game.moves / 200);
}
function changeLuck(amount) {
    game.u.uluck = Math.max(LUCKMIN, Math.min(LUCKMAX, (game.u.uluck || 0) + amount));
}
function inHell() {
    const game = requireInitializedGame();
    return !!game.dungeons?.[game.u.uz.dnum]?.flags?.hellish;
}
//# sourceMappingURL=sacrifice.js.map