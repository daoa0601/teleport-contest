// Applied mirrors. C apply.c:use_mirror(), beautiful(); zap.c:bhit(INVIS_BEAM).

import {
    A_CHA, COLNO, MAXULEV, MONSEEN_INFRAVIS, MONSEEN_NORMAL, MONSEEN_SEEINVIS,
    RLOC_MSG, Upolyd, WEAK, isok,
} from './const.js';
import { currentAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { heroFaceName, monsterStomachName } from './body_parts.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import {
    canSeeMonster, displayColorName, howMonsterSeen, plineWithContinuation as pline,
} from './display.js';
import { game, requireLiveGame, requireGameLevel } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { freeInventoryObject } from './hero_inventory.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { makeConfused } from './hero_mental_status.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroPolyGender, heroSpecies } from './hero_species.js';
import { formatFeltMessage, formatHeardMessage } from './hero_speech.js';
import { paralyzeMonster } from './mon.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsHumanoid, monsterIsUnicorn, monsterIsVampire, monsterIsVampireShifter,
    monsterTypeName,
} from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterAtPosition } from './monster_location.js';
import {
    monsterName, monsterPossessive, monsterReflexiveAction, monsterSubjectPronoun,
    possessiveName,
} from './monster_name.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { learnObjectType } from './object_knowledge.js';
import { minimalObjectName } from './objnam.js';
import { monsterReflectionSource, rayPositionIsOpen } from './ray.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { randomMonsterRelocation } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { promptDirection } from './tty_prompts.js';
import type { DirectionSelection } from './tty_prompts.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

const FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const UMBER_HULK = MONSTER_NAME.indexOf('umber hulk');
const MEDUSA = MONSTER_NAME.indexOf('Medusa');
const AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');
const M1_NOEYES = 0x00001000;
const M1_SEE_INVIS = 0x01000000;
const M2_DEMON = 0x00000100;
const S_NYMPH = 14;
const S_GHOST = 54;
const DIRECT_SIGHT = MONSEEN_NORMAL | MONSEEN_SEEINVIS | MONSEEN_INFRAVIS;

export async function useMirror(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const direction = await promptDirection();
    if (!direction) return { spentTime: false, heroDied: false, object };
    const result = { spentTime: true, heroDied: false, object };
    const hero = state.u;
    const invisible = heroIsInvisible(state);
    const canSeeMirror = !heroIsBlind(state) && (!invisible || seesInvisible(state));
    const simpleName = minimalObjectName(object, state);
    const mirror = object.quan === 1 ? simpleName : makePlural(simpleName);
    if (object.cursed && !rn2(2)) {
        await pline(heroIsBlind(state) ? 'Nothing seems to happen.'
            : `The ${mirror} fogs up and doesn't reflect!`);
        return result;
    }
    if (!direction.dx && !direction.dy && !direction.dz) {
        await seeOwnReflection(mirror, canSeeMirror, state);
        return result;
    }
    if (hero.uswallow) {
        if (canSeeMirror) {
            if (!hero.ustuck) throw new Error('A swallowed hero has no engulfer.');
            await pline(`You reflect ${possessiveName(monsterName(hero.ustuck))} ${monsterStomachName(hero.ustuck.mnum)}.`);
        }
        return result;
    }
    if (hero.uinwater || state.underwater) {
        if (canSeeMirror) await pline(heroIsHallucinating(state)
            ? 'You give the fish a chance to fix their makeup.'
            : 'You reflect the murky water.');
        return result;
    }
    if (direction.dz) {
        if (canSeeMirror) await pline(`You reflect the ${direction.dz > 0
            ? surfaceName(hero.ux, hero.uy, state) : ceilingName(hero.ux, hero.uy, state)}.`);
        return result;
    }
    const target = mirrorTarget(direction, state);
    if (!target || !target.onHead || ((MONSTER_FLAGS1[target.monster.mnum] ?? 0) & M1_NOEYES))
        return result;
    result.heroDied = await showMonsterReflection(target.monster, object, mirror, invisible, state);
    return result;
}

function seesInvisible(state: GameState) {
    return !!state.u.seeInvisible || (state.u.seeInvisibleTurns ?? 0) > 0;
}

export function heroBeautyDescription(state: GameState = game) {
    const charisma = currentAttribute(A_CHA, state);
    if (charisma >= 25) return 'sublime';
    if (charisma >= 19) return 'splendorous';
    if (charisma >= 16) return heroPolyGender(state) === 1 ? 'beautiful' : 'handsome';
    if (charisma >= 14) return heroPolyGender(state) === 1 ? 'winsome' : 'amiable';
    if (charisma >= 11) return 'cute';
    if (charisma >= 9) return 'plain';
    if (charisma >= 6) return 'homely';
    return charisma >= 4 ? 'ugly' : 'hideous';
}

async function seeOwnReflection(mirror: string, visible: boolean, state: GameState) {
    const hero = state.u;
    requireInitializedHero(hero);
    const species = heroSpecies(state);
    const hallucinating = heroIsHallucinating(state);
    if (!visible) {
        await pline(`You can't see your ${heroBeautyDescription(state)} ${heroFaceName(state)}.`);
    } else if (species === FLOATING_EYE) {
        if (heroHasFreeAction(state)) {
            await pline('You stiffen momentarily under your gaze.');
            return;
        }
        await pline(hallucinating ? `Yow!  The ${mirror} stares back!`
            : "Yikes!  You've frozen yourself!");
        if (!hallucinating || !rn2(4)) {
            state._occupation = null;
            endVoluntaryMultiTurn(state);
            state._helplessTurns = rnd(MAXULEV + 6 - hero.ulevel);
            state._helplessReason = 'gazing into a mirror';
        }
        state._helplessDoneMessage = null;
    } else if (monsterIsVampire(species)
        || (hero.mcham !== undefined && monsterIsVampire(hero.mcham))) {
        await pline("You don't have a reflection.");
    } else if (species === UMBER_HULK) {
        await pline("Huh?  That doesn't look like you!");
        await makeConfused((hero.confusionTurns || 0) + d(3, 4), { state, talk: false });
    } else if (hallucinating) {
        await pline(`You look ${displayColorName(null, state)}.`);
    } else if (hero.sick || (hero.sickTurns ?? 0) > 0) {
        await pline('You look peaked.');
    } else if (hero.uhs >= WEAK) {
        await pline('You look undernourished.');
    } else if (Upolyd(hero)) {
        await pline(`You look like ${withIndefiniteArticle(monsterTypeName(species, state.flags.female))}.`);
    } else {
        await pline(`You look as ${heroBeautyDescription(state)} as ever.`);
    }
}

// The invisible beam checks an occupant before its terrain and can pass an
// invisible creature which cannot see itself. It never animates or lights tiles.
function mirrorTarget({ dx, dy }: Pick<DirectionSelection, 'dx' | 'dy'>, state: GameState) {
    const level = requireGameLevel(state);
    let x = state.u.ux, y = state.u.uy;
    for (let distance = 0; distance < COLNO; distance++) {
        x += dx;
        y += dy;
        if (!isok(x, y)) return null;
        const monster = monsterAtPosition(level, x, y);
        if (monster && (!monster.minvis || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS)))
            return { monster, onHead: monster.mx === x && monster.my === y };
        if (!rayPositionIsOpen(x, y, state)) return null;
    }
    return null;
}

async function showMonsterReflection(
    monster: Monster, object: GameObject, mirror: string, invisible: boolean, state: GameState,
): Promise<boolean> {
    const visible = canSeeMonster(monster);
    const ways = visible ? howMonsterSeen(monster) : 0;
    const perceives = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
    const able = !monster.mcan && (!monster.minvis || perceives);
    const name = () => monsterName(monster, { capitalized: true, state });
    if (monster.msleeping) {
        if (visible) await pline(`${name()} is too tired to look at your ${mirror}.`);
    } else if (!monster.mcansee) {
        if (visible) await pline(`${name()} can't see anything right now.`);
    } else if (invisible && !perceives) {
        if (visible) await pline(`${name()} fails to notice your ${mirror}.`);
    } else if ((ways & DIRECT_SIGHT) === MONSEEN_INFRAVIS) {
        await pline(`${monsterReflexiveAction(monster, name(), 'are', 'too far away to see', { state })} in the dark.`);
    } else if (monsterIsVampire(monster.mnum) || MONSTER_SYMBOL[monster.mnum] === S_GHOST
        || monsterIsVampireShifter(monster)) {
        if (visible) await pline(`${name()} doesn't have a reflection.`);
    } else if (able && monster.mnum === MEDUSA) {
        const reflection = monsterReflectionSource(monster, state);
        if (reflection) {
            await pline(`The gaze is reflected away by ${possessiveName(monsterName(monster))} ${reflection.noun}!`);
            if (['shield', 'amulet'].includes(reflection.noun)) {
                if (!reflection.object) throw new Error('Reflecting jewelry or armor requires an object.');
                learnObjectType(reflection.object.otyp, state);
            }
            return false;
        }
        if (visible) await pline(`${name()} is turned to stone!`);
        return (await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my,
            { petrified: true })).heroDied;
    } else if (able && monster.mnum === FLOATING_EYE) {
        const gaze = MONSTER_ATTACKS[monster.mnum]?.[0];
        if (!gaze) throw new Error('A floating eye has no gaze attack.');
        let turns = d(monster.m_lev, gaze[3]);
        if (!rn2(4)) turns = 120;
        if (visible) await pline(`${name()} is frozen by its reflection.`);
        else {
            const heard = formatHeardMessage('something stop moving.', state);
            if (heard) await pline(heard);
        }
        paralyzeMonster(monster, (monster.mfrozen || 0) + turns);
    } else if (able && monster.mnum === UMBER_HULK) {
        if (visible) await pline(`${name()} confuses itself!`);
        monster.mconf = 1;
    } else if (able && (MONSTER_SYMBOL[monster.mnum] === S_NYMPH || monster.mnum === AMOROUS_DEMON)) {
        if (visible) {
            await pline(`${monsterReflexiveAction(monster, name(), 'admire', '', { state })} in your ${mirror}.`);
            const pronoun = monsterSubjectPronoun(monster, { state });
            await pline(`${pronoun.charAt(0).toUpperCase()}${pronoun.slice(1)} takes it!`);
        } else await pline(`It steals your ${mirror}!`);
        await removeWornHeroItem(object, state);
        if (state.program_state.gameover) return true;
        await freeInventoryObject(object, state);
        if (state.program_state.gameover) return true;
        await addObjectToMonsterInventory(monster, object, state);
        if (monsterTeleportRestricted(monster, state)) {
            if (canSeeMonster(monster)) await pline(`A mysterious force prevents ${monsterName(monster)} from teleporting!`);
        } else {
            const relocation = await randomMonsterRelocation(monster, { state, flags: RLOC_MSG });
            if (relocation?.died) return true;
        }
    } else if (!monsterIsUnicorn(monster.mnum) && !monsterIsHumanoid(monster.mnum)
        && !((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON) && (!monster.minvis || perceives) && rn2(5)) {
        if (monster.mfrozen) {
            await pline(visible ? `You discern no obvious reaction from ${monsterName(monster)}.`
                : formatFeltMessage('a bit silly gesturing the mirror in that direction.', state));
        } else {
            if (visible) await pline(`${name()} is frightened by its reflection.`);
            return (await makeMonsterFlee(monster, { state, turns: d(2, 4), announce: false })).heroDied;
        }
    } else if (!heroIsBlind(state) && (!monster.minvis || seesInvisible(state))) {
        await pline(`${name()} ${monster.minvis && !perceives ? "doesn't seem to notice" : 'ignores'} ${monsterPossessive(monster, { state })} reflection.`);
    }
    return false;
}
