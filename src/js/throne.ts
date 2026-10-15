// Throne effects.
// C ref: sit.c throne_sit_effect(), special_throne_effect(), attrcurse(),
// and rndcurse().

import { formatFeltMessage } from './hero_speech.js';
import { makeConfused } from './hero_mental_status.js';
import { makeBlinded } from './sight_change.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import {
    A_CON, A_MAX, ROOM,
} from './const.js';
import {
    adjustAttribute, attributeChangeMessage, exerciseAttribute,
} from './attrib.js';
import { artifactById } from './artifacts.js';
import { mapLevel } from './detect.js';
import {
    map_background, newsym, newsym_force, plineWithContinuation, see_monsters, shieldeff,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { loseHeroExperience } from './exper.js';
import { heroHasDrainResistance } from './armor.js';
import { doGenocide, GENOCIDE_ON_THRONE } from './genocide.js';
import { game, requireInitializedGame } from './gstate.js';
import type { HeroHurtleOptions } from './hero_hurtle.js';
import type { MessagePublisher } from './display.js';
import type { GameObject } from './object_types.js';

export type ThroneOptions = Pick<HeroHurtleOptions, 'gotoLevel' | 'chooseTeleportDestination'>;
import { dropCursedSecondaryWeapon } from './two_weapon.js';
import { heroEyeCount, heroEyeName, heroHeadName } from './body_parts.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { loseHeroHp } from './hero_damage.js';
import { cureHeroSickness } from './hero_illness.js';
import { healHeroLegs } from './hero_legs.js';
import { takeHeroGold } from './hero_gold.js';
import { identifyPack } from './invent.js';
import { msummon } from './minion.js';
import {
    courtMonsterType, makemonNear,
} from './mklev.js';
import { MONSTER_FLAGS2, MONSTER_SYMBOL } from './monster_data.js';
import { OBJECT_NAMES } from './object_data.js';
import { curseObject, unblessObjectState } from './object_state.js';
import {
    grantIntrinsicProperty, hasPermanentIntrinsicProperty,
    removePermanentIntrinsicProperty,
} from './properties.js';
import { syncHeroInvisibility } from './hero_invisibility.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import {
    heroIsPolymorphed, polymorphHero,
} from './polyself.js';
import { getLine, promptYesNo } from './query.js';
import { applyRemoveCurseSpell } from './scroll_effects.js';
import { rnd, rn1, rn2 } from './rng.js';
import { monsterSaddle } from './steed.js';
import { teleportHero } from './teleport.js';
import { cansee } from './vision.js';
import { makeWish } from './wish.js';
import { aggravateMonsters } from './monster_anger.js';

const COIN_CLASS = 12;
const M2_PRINCE = 0x00000800;
const S_VAMPIRE = 48;

const CURSEABLE_INTRINSICS = Object.freeze([
    ['fireResistance', 'warmer.'],
    ['teleportation', 'less jumpy.'],
    ['poisonResistance', 'a little sick!'],
    ['telepathy', null],
    ['coldResistance', 'cooler.'],
    ['invisible', 'paranoid.'],
    ['seeInvisible', null],
    ['fast', 'slower.'],
    ['stealth', 'clumsy.'],
    ['protection', 'vulnerable.'],
    ['aggravateMonster', 'less attractive.'],
] as const);

function currentForm(): number | null {
    const species = game.u.umonnum;
    return species !== undefined && Number.isInteger(species) ? species : null;
}

function naturalLuck() {
    return game.u?.uluck ?? game.u?.luck ?? 0;
}

function heroLuck() {
    return naturalLuck() + (game.u.moreluck ?? 0);
}

function changeLuck(amount: number): void {
    game.u.uluck = Math.max(-13, Math.min(13, naturalLuck() + amount));
}

function inVladsTower() {
    return (game.u.uz ? game.dungeons[game.u.uz.dnum]?.dname : undefined) === "Vlad's Tower";
}

function removeThrone(x: number, y: number): void {
    const location = game.level?.at?.(x, y);
    if (!location) return;
    location.typ = ROOM;
    location.flags = 0;
    map_background(x, y, false);
    newsym_force(x, y);
}

async function announceAttributeChange(attribute: number, amount: number, conditional: boolean) {
    const result = adjustAttribute(attribute, amount, game);
    if (conditional && !result.changed) return result;
    if (!result.changed && !result.blockedByDunceCap
        && game.flags?.verbose === false) return result;
    const message = attributeChangeMessage(attribute, result);
    if (message) await plineWithContinuation(message);
    return result;
}

async function healHeroCompletely(): Promise<void> {
    const game = requireInitializedGame();
    const hero = game.u;
    if (heroIsPolymorphed(game)) {
        if ((hero.mh ?? 0) >= (hero.mhmax ?? 0) - 5)
            hero.mhmax = (hero.mhmax ?? 0) + 4;
        hero.mh = hero.mhmax;
    }
    if ((hero.uhp ?? 0) >= (hero.uhpmax ?? 0) - 5) {
        hero.uhpmax = (hero.uhpmax ?? 0) + 4;
        hero.uhppeak = Math.max(hero.uhppeak ?? 0, hero.uhpmax);
    }
    hero.uhp = hero.uhpmax;
    hero.ucreamed = 0;
    await makeBlinded(0);
    cureHeroSickness(game);
    await healHeroLegs(game);
    game.context.botl = true;
}

async function summonCourt(x: number, y: number): Promise<void> {
    let count = rnd(10);
    const title = game.flags?.female ? 'Dame' : 'Sire';
    await plineWithContinuation('A voice echoes:');
    await plineWithContinuation(
        `"Thine audience hath been summoned, ${title}!"`,
    );
    while (count-- > 0)
        await makemonNear(courtMonsterType(), x, y);
}

async function grantSeeInvisible() {
    const hero = game.u;
    if (!heroIsBlind()) {
        await plineWithContinuation('Your vision becomes clear.');
    } else {
        const count = heroEyeCount();
        if (count) {
            const eyes = count === 1 ? heroEyeName() : makePlural(heroEyeName());
            await plineWithContinuation(`Your ${eyes} ${verbForSubject(eyes, 'tingle')}...`);
        } else {
            await plineWithContinuation(`You have a very strange feeling in your ${heroHeadName()}.`);
        }
    }
    grantIntrinsicProperty('seeInvisible', 'outside', game);
    newsym(hero.ux, hero.uy);
}

async function normalThroneEffect(
    effect: number, x: number, y: number, { chooseTeleportDestination }: Pick<ThroneOptions, 'chooseTeleportDestination'>,
): Promise<void> {
    switch (effect) {
    case 1:
        await announceAttributeChange(rn2(A_MAX), -rn1(4, 3), false);
        await loseHeroHp(rnd(10), 'cursed throne');
        break;
    case 2:
        await announceAttributeChange(rn2(A_MAX), 1, false);
        break;
    case 3: {
        const resistant = !!(game.u.shockResistance);
        await plineWithContinuation(
            `A${resistant ? 'n' : ' massive'} electric shock shoots through your body!`,
        );
        await loseHeroHp(resistant ? rnd(6) : rnd(30), 'electric chair');
        await exerciseAttribute(A_CON, false);
        break;
    }
    case 4:
        await plineWithContinuation(formatFeltMessage('much, much better!'));
        await healHeroCompletely();
        break;
    case 5:
        await takeHeroGold();
        break;
    case 6:
        if (naturalLuck() + rn2(5) < 0) {
            await plineWithContinuation(formatFeltMessage('your luck is changing.'));
            changeLuck(1);
        } else {
            await makeWish({ announce: game.flags?.verbose !== false });
        }
        break;
    case 7:
        await summonCourt(x, y);
        break;
    case 8: {
        const title = game.flags?.female ? 'Dame' : 'Sire';
        await plineWithContinuation('A voice echoes:');
        await plineWithContinuation(
            `"By thine Imperious order, ${title}..."`,
        );
        await doGenocide(1 | GENOCIDE_ON_THRONE, { finishHeroDeath });
        break;
    }
    case 9:
        await plineWithContinuation('A voice echoes:');
        await plineWithContinuation(
            '"A curse upon thee for sitting upon this most holy throne!"',
        );
        if (heroLuck() > 0) {
            await makeBlinded((game.u.blindTurns ?? 0) + rn1(100, 250));
            changeLuck(heroLuck() > 1 ? -rnd(2) : -1);
        } else {
            await rndcurse();
        }
        break;
    case 10:
        if (heroLuck() < 0
            || hasPermanentIntrinsicProperty('seeInvisible', game)) {
            if (game.level?.flags?.nommap) {
                await plineWithContinuation(
                    'A terrible drone fills your head!',
                );
                await makeConfused((game.u.confusionTurns ?? 0) + rnd(30), { talk: false });
            } else {
                await plineWithContinuation('An image forms in your mind.');
                mapLevel();
            }
        } else {
            await grantSeeInvisible();
        }
        break;
    case 11:
        if (heroLuck() < 0) {
            await plineWithContinuation(formatFeltMessage('threatened.'));
            aggravateMonsters(game);
        } else {
            await plineWithContinuation(formatFeltMessage('a wrenching sensation.'));
            await teleportHero(chooseTeleportDestination
                ? { chooseDestination: chooseTeleportDestination } : {});
        }
        break;
    case 12:
        await plineWithContinuation('You are granted an insight!');
        if (game.inventory?.length) await identifyPack(rn2(5), false);
        break;
    case 13:
        await plineWithContinuation('Your mind turns into a pretzel!');
        await makeConfused((game.u.confusionTurns ?? 0) + rn1(7, 16), { talk: false });
        break;
    }
}

async function specialThroneEffect(effect: number, x: number, y: number, { gotoLevel }: Pick<ThroneOptions, 'gotoLevel'>): Promise<void> {
    const game = requireInitializedGame();
    switch (effect) {
    case 1:
    case 2:
    case 3:
    case 4:
        await makeWish({ announce: game.flags?.verbose !== false });
        removeThrone(x, y);
        await plineWithContinuation(
            'The throne disintegrates, having spent its power.',
        );
        break;
    case 5:
        await plineWithContinuation(
            'Sitting on the throne was a terrible experience.',
        );
        if (!heroHasDrainResistance(game)) {
            if (await loseHeroExperience('a bad experience sitting on a throne')) return;
            if ((game.u.ulevelmax ?? game.u.ulevel) > game.u.ulevel)
                game.u.ulevelmax--;
        }
        break;
    case 6:
        await plineWithContinuation('A greasy liquid sprays all over you!');
        for (const object of game.inventory || []) {
            if (object.oclass !== COIN_CLASS) object.greased = true;
        }
        game.u.glibTurns = rn1(101, 100);
        break;
    case 7:
        await attrcurse();
        await plineWithContinuation(
            'The throne somehow seems to be amused.',
        );
        break;
    case 8: {
        const gehennom = game.dungeons?.findIndex(
            dungeon => dungeon?.dname === 'Gehennom',
        );
        if (game.u?.uhave?.amulet) {
            await plineWithContinuation(
                formatFeltMessage('extremely disoriented for a moment.'),
            );
        } else if (gehennom >= 0) {
            if (typeof gotoLevel !== 'function') {
                throw new TypeError('Vlad throne travel needs a level mover');
            }
            await gotoLevel({
                dnum: gehennom,
                dlevel: Math.max(
                    1, (game.dungeons[gehennom]?.num_dunlevs ?? 1) - 1,
                ),
            }, {
                arrival: 'random',
                postMessage: 'You feel extremely out of place.',
            });
        }
        break;
    }
    case 9:
        await plineWithContinuation(
            'The throne seeems to be calling for help!',
        );
        await msummon(null);
        await msummon(null);
        await msummon(null);
        break;
    case 10: {
        // C installs a temporary HConfusion value for the blessed spell.
        const previousConfusion = game.u.confusionTurns;
        game.u.confusionTurns = 1;
        try {
            await applyRemoveCurseSpell({ blessed: true });
        } finally {
            if (previousConfusion === undefined) delete game.u.confusionTurns;
            else game.u.confusionTurns = previousConfusion;
        }
        break;
    }
    case 11:
        if (MONSTER_SYMBOL[currentForm() ?? -1] === S_VAMPIRE) {
            await plineWithContinuation(formatFeltMessage('unworthy.'));
        } else {
            await plineWithContinuation(
                'This throne was not meant for those such as you!',
            );
            await plineWithContinuation(formatFeltMessage('a change coming over you.'));
            await polymorphHero();
        }
        break;
    case 12: {
        await plineWithContinuation('The throne is covered in acid!');
        const resistant = !!(game.u.acidResistance);
        await loseHeroHp(resistant ? rnd(16) : rnd(80), 'acidic chair');
        await exerciseAttribute(A_CON, false);
        break;
    }
    case 13:
        await plineWithContinuation(
            'As you sit on the throne, your body and mind start to warp.',
        );
        for (let attribute = 0; attribute < A_MAX; attribute++) {
            await announceAttributeChange(
                attribute, rn2(5) - 2, true,
            );
        }
        break;
    }
}

export async function throneSitEffect({
    gotoLevel = null,
    chooseTeleportDestination = null,
}: ThroneOptions = {}): Promise<void> {
    const x = game.u?.ux;
    const y = game.u?.uy;
    const special = inVladsTower();

    if (rnd(6) > 4) {
        let effect = rnd(13);
        if (game.flags?.debug && !game.flags?.debug_fuzzer) {
            const answer = await getLine(
                'Throne sit effect (1..13) [0=random]',
                ch => /[0-9]/.test(ch),
            );
            if (answer === null) {
                await plineWithContinuation('Never mind.');
                return;
            }
            const requested = Number(answer);
            if (requested >= 1 && requested <= 13) effect = requested;
        }
        if (special) {
            await specialThroneEffect(effect, x, y, { gotoLevel });
            return;
        }
        await normalThroneEffect(effect, x, y, {
            chooseTeleportDestination,
        });
        if (game.program_state.gameover) return;
    } else {
        const prince = !!((MONSTER_FLAGS2[currentForm() ?? -1] ?? 0) & M2_PRINCE);
        const handOfElbereth = !!game.u?.uevent?.uhand_of_elbereth;
        await plineWithContinuation(formatFeltMessage(prince || handOfElbereth ? 'very comfortable here.' : 'somehow out of place...'));
    }

    if (!special && !rn2(3)) {
        if (game.flags?.debug
            && await promptYesNo('Analyze throne?', 'n') !== 'y') return;
        removeThrone(x, y);
        await plineWithContinuation(
            `The throne ${cansee(x, y) ? 'vanishes' : 'has vanished'} in a puff of logic.`,
        );
    }
}

// Selection falls through the source list until it finds an intrinsic the
// hero actually has. Worn sources stay active.
export async function attrcurse({ publish = plineWithContinuation }: {
    publish?: MessagePublisher;
} = {}) {
    const hero = game.u;
    const start = rnd(CURSEABLE_INTRINSICS.length) - 1;
    for (const [property, sensation] of CURSEABLE_INTRINSICS.slice(start)) {
        if (!hasPermanentIntrinsicProperty(property, game)) continue;
        removePermanentIntrinsicProperty(property, game);

        if (property === 'telepathy' && game.blind
            && !hero.blindTelepathy) await see_monsters();
        if (property === 'invisible') syncHeroInvisibility(game);
        if (property === 'seeInvisible') {
            if (!hero.seeInvisible) {
                await refreshHeroSeeing();
            }
            await publish(heroIsHallucinating(game)
                ? 'You tawt you taw a puttie tat!'
                : 'You thought you saw something!');
        } else if (property === 'telepathy') {
            await publish('Your senses fail!');
        } else if (sensation) {
            await publish(formatFeltMessage(sensation));
        }
        return property;
    }
    return null;
}

export async function rndcurse({
    publish = plineWithContinuation,
}: { publish?: MessagePublisher } = {}): Promise<GameObject[]> {
    const state = game;
    const hero = state.u;
    const weapon = state.uwep || hero.uwep;
    if (artifactById(weapon?.oartifact)?.name === 'Magicbane' && rn2(20)) {
        await publish(
            'You feel a malignant aura surround the magic-absorbing blade.',
        );
        return [];
    }

    const antimagic = !!hero.antimagic;
    const halfSpellDamage = heroHasHalfSpellDamage(state);
    if (antimagic) await shieldeff(hero.ux, hero.uy, state);
    await publish('You feel a malignant aura surround you.');

    const inventoryCount = (state.inventory || []).filter(object =>
        object.oclass !== COIN_CLASS).length;
    const sides = Math.trunc(6
        / (Number(antimagic) + Number(halfSpellDamage) + 1));
    const count = rnd(sides);
    const changed: GameObject[] = [];

    for (let remaining = count; inventoryCount && remaining > 0;
        remaining--) {
        // Native keeps the initial count but traverses the live inventory.
        // Cursing an active offhand can remove it between selections.
        const index = rnd(inventoryCount) - 1;
        const object = (state.inventory || []).filter(candidate =>
            candidate.oclass !== COIN_CLASS)[index];
        if (!object || object.cursed) continue;
        if (artifactById(object.oartifact)?.selfWilled && rn2(10) < 8) {
            const name = object.name || OBJECT_NAMES[object.otyp] || 'object';
            await publish(`The ${name} resists!`);
            continue;
        }
        if (object.blessed) unblessObjectState(object);
        else {
            await curseObject(object);
            await dropCursedSecondaryWeapon(object, state);
            if (state.program_state.gameover) return changed;
        }
        changed.push(object);
    }

    let saddle: GameObject | null = null;
    if (hero.usteed && rn2(4) === 0)
        saddle = monsterSaddle(hero.usteed);
    if (saddle && !saddle.cursed) {
        if (saddle.blessed) unblessObjectState(saddle);
        else await curseObject(saddle);
        if (state.blind) {
            saddle.bknown = false;
        } else {
            const color = saddle.cursed ? 'black' : 'brown';
            await publish(`The saddle glows ${color}.`);
            saddle.bknown = !(heroIsHallucinating(state));
        }
        changed.push(saddle);
    }
    return changed;
}
