// C hack.c:slippery_ice_fumbling() and timeout.c:slip_or_trip().
import { currentAttribute } from './attrib.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { heroFootName } from './body_parts.js';
import { A_DEX, DISMOUNT_FELL, PLNMSG_ONE_ITEM_HERE, W_SADDLE } from './const.js';
import { plineWithContinuation, type MessagePublisher } from './display.js';
import { game } from './gstate.js';
import { hurtleHero } from './hero_hurtle.js';
import { heroSpecies } from './hero_species.js';
import { gotoLevel } from './level_change.js';
import { finishTeleportArrival } from './location_effects.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, monsterIsWhirly } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { monsterHasColdResistance } from './monster_resistance.js';
import { CORPSE, OBJECT_DESCRIPTIONS, ROCK } from './object_data.js';
import { objectDescription } from './object_description.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { dismountHero } from './steed.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { isIceAt, isPoolAt } from './terrain_properties.js';

export function checkSlipperyIce(): void {
    const hero = game.u;
    let onIce = !propertyIsActive('levitation', game) && isIceAt(hero.ux, hero.uy);
    if (onIce) {
        const skater = hero.usteed ?? { mnum: heroSpecies(game) };
        const boots = game.uarmf ?? hero.uarmf;
        const appearance = boots && (game.objectDescriptions?.[boots.otyp] ?? OBJECT_DESCRIPTIONS[boots.otyp]);
        const flags = MONSTER_FLAGS1[skater.mnum] ?? 0;
        const symbol = MONSTER_SYMBOL[skater.mnum];
        const coldSkater = hero.usteed ? monsterHasColdResistance(hero.usteed)
            : propertyIsActive('coldResistance', game) || heroHasArtifactDefense('cold', game);
        if (appearance === 'snow boots' || coldSkater
            || propertyIsActive('flying', game) || symbol === 5 || symbol === 25
            || flags & 0x10 || monsterIsWhirly(skater)) {
            onIce = false;
        } else if (!rn2(propertyIsActive('coldResistance', game) ? 3 : 2)) {
            hero.fumblingFromIce = true;
            hero.fumblingTurns = 1;
            hero.fumbling = true;
        }
    }
    if (!onIce) hero.fumblingFromIce = false;
}

export async function slipOrTrip(publish: MessagePublisher = plineWithContinuation): Promise<void> {
    const hero = game.u;
    const steed = hero.usteed;
    const pile = game.level?.objects[hero.ux]?.[hero.uy] ?? [];
    const top = !steed && !(isPoolAt(hero.ux, hero.uy) && !hero.uinwater) ? pile[0] : undefined;
    const hallucinating = heroIsHallucinating(game);
    if (top) {
        let what: string;
        if (game._lastPlineKind === PLNMSG_ONE_ITEM_HERE)
            what = top.quan === 1 ? 'it' : hallucinating ? 'they' : 'them';
        else if (top.dknown || !heroIsBlind(game)) what = objectDescription(top, { state: game });
        else {
            const rocks = pile.find(object => object.otyp === ROCK);
            what = rocks ? rocks.quan === 1 ? 'a rock' : 'some rocks' : 'something';
        }
        await publish(hallucinating
            ? `Egads!  ${what.charAt(0).toUpperCase()}${what.slice(1)} bite${top.quan === 1 ? 's' : ''} your ${heroFootName(game)}!`
            : `You trip over ${what}.`);
        if (!game.uarmf && !hero.uarmf && top.otyp === CORPSE
            && touchPetrifies(top.corpsenm) && !heroResistsStoning(game)) {
            await resolveImmediatePetrification({
                killer: `tripping over ${withIndefiniteArticle(MONSTER_NAME[top.corpsenm ?? -1] ?? 'monster')} corpse`, publish,
            });
        }
        return;
    }
    const onIce = isIceAt(hero.ux, hero.uy);
    const saddle = steed?.minvent?.find(object => (object.owornmask ?? 0) & W_SADDLE);
    if (hero.fumblingFromIce || onIce && !rn2(3)) {
        const iceOnly = !hero.fumblingFromArmor && !hero.fumblingIntrinsic
            && !propertyIsActive('fumbling', game);
        const subject = steed ? monsterName(steed, {
            state: game, capitalized: true, suppressSaddle: true,
        }) : 'You';
        const verb = rn2(2) ? 'slip' : 'slide';
        await publish(`${subject} ${verb}${steed ? 's' : ''} ${onIce ? 'on' : 'off'} the ice.`);
        if (steed && !saddle?.cursed && (!iceOnly || !rn2(3))) {
            await publish('You lose your balance.');
            await dismountHero(DISMOUNT_FELL, { announce: publish });
        } else if (!rn2(10 + currentAttribute(A_DEX, game))) {
            if (heroSpecies(game) !== MONSTER_NAME.indexOf('grid bug')) {
                const directions: readonly (readonly [number, number])[] = [
                    [-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, -1], [1, 1], [-1, 1],
                ];
                const direction = directions[rn2(directions.length)];
                if (!direction) throw new Error('Ice slip chose no direction');
                [hero.dx, hero.dy] = direction;
            }
            const dx = hero.dx ?? 0, dy = hero.dy ?? 0;
            if (hero.ux + dx !== hero.ux0 || hero.uy + dy !== hero.uy0)
                await hurtleHero(dx, dy, 1, { verbose: false, finishTeleport: finishTeleportArrival, gotoLevel });
        }
        return;
    }
    if (steed && saddle?.cursed) return;
    const feet = makePlural(heroFootName(game));
    const messages = steed ? [
        'You slide to one side of the saddle.', `Your ${feet} slip out of the stirrups.`,
        'You let go of the reins.', 'You bang into the saddle-horn.',
    ] : [
        'You stumble.', `You trip over your own ${hallucinating ? 'elbow' : feet}.`,
        `You slip ${hallucinating ? 'on a banana peel' : 'and nearly fall'}.`, 'You flounder.',
    ];
    const message = messages[rn2(4)];
    if (!message) throw new Error('Fumbling chose no message');
    await publish(message);
    if (steed) await dismountHero(DISMOUNT_FELL, { announce: publish });
}
