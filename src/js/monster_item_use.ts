// Shared monster item feedback and cursed-wand precheck. C muse.c.
import { BOLT_LIM, G_GONE, MM_NOMSG, QBUFSZ, WAND_BACKFIRE_CHANCE } from './const.js';
import { impossible } from './diagnostics.js';
import {
    canSeeMonster, canSenseMonster, flashGlyphAt, map_invisible, newsym,
    plineWithContinuation, randomDisplayMonsterName, transientMonsterGlyph,
} from './display.js';
import { heroSpecies } from './hero_species.js';
import { formatHeardMessage } from './hero_speech.js';
import { inventoryItemDescription } from './invent.js';
import { AD_RBRE } from './monster_attack_types.js';
import { MONSTER_GENO } from './monster_data.js';
import { finishMonsterKilled } from './monster_death.js';
import { paralyzeMonster } from './mon.js';
import { destroyObjectFromMonsterInventory, forgetObjectKnowledge } from './monster_inventory.js';
import { monsterName, monsterReflexiveAction, monsterSubjectPronoun } from './monster_name.js';
import type { MonsterOffensiveOptions } from './monster_offensive_types.js';
import { sameMonsterRace } from './monster_race.js';
import type { Monster } from './monster_types.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import type { GameObject } from './object_types.js';
import { minimalObjectName, objectCombatName, observeObjectForNaming } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { d, rn2 } from './rng.js';
import { makemonAt } from './mklev.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { OBJECT_DESCRIPTIONS } from './object_data.js';
import { setMonsterMalign } from './monster_alignment.js';
import { removeMonsterFromGame } from './monster_departure.js';
import type { MonsterOffensiveResult } from './monster_offensive_types.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import type { GameState, PlayingGameState } from './game_state.js';
import { cansee, couldsee } from './vision.js';
import { objectWeight } from './weight.js';

interface MonsterDeviceUseOptions extends MonsterOffensiveOptions {
    self?: boolean;
}

export interface MonsterWandBackfireResult {
    exploded: boolean;
    nativeResult: 0 | 1;
    heroDied: boolean;
    monsterDied: boolean;
}

const WAND_CLASS = 11;
const G_UNIQ = 0x1000;

export async function presentMonsterQuaff(monster: Monster, object: GameObject, {
    state, publish = plineWithContinuation,
}: MonsterOffensiveOptions): Promise<boolean> {
    const seen = canSeeMonster(monster);
    if (seen) {
        observeObject(object, state);
        observeObjectForNaming(object, { state });
        const name = inventoryItemDescription({ ...object, quan: 1, quantity: 1 });
        await publish(`${monsterName(monster, { state, capitalized: true })} drinks ${name}!`);
    } else if (!heroIsDeaf(state)) await publish('You hear a chugging sound.');
    return seen;
}

// Return null when the selected item can still be used. An exploded wand
// spends no action if its owner survives, but cancels the selected choice.
export async function prepareMonsterItemUse(monster: Monster, object: GameObject,
    options: MonsterOffensiveOptions): Promise<MonsterOffensiveResult | null> {
    const { state, random = rn2, publish = plineWithContinuation } = options;
    if (object.oclass === 8) {
        const appearance = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
        const species = appearance === 'milky' ? 287 : appearance === 'smoky' ? 315 : null;
        if (species !== null && !((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
            && !random(13 + 2 * (state.mvitals?.[species]?.born ?? 0))) {
            const point = findNearbyMonsterPosition(species, monster.mx, monster.my, { state, random });
            if (!point) return null;
            const visible = cansee(monster.mx, monster.my);
            await presentMonsterQuaff(monster, object, options);
            await consumeMonsterItem(monster, object, state);
            const occupant = await makemonAt(species, point.x, point.y, MM_NOMSG);
            if (!occupant) {
                if (visible) await publish('The potion turns out to be empty.');
            } else if (species === 287) {
                if (visible) {
                    const subject = monsterName(monster, { state });
                    const occupantName = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'ghost';
                    await publish(`As ${subject} opens the bottle, an enormous ${occupantName} emerges!`);
                    await publish(`${monsterName(monster, { state, capitalized: true })} is frightened to death, and unable to move.`);
                }
                paralyzeMonster(monster, 3);
            } else {
                if (visible) await publish(`In a cloud of smoke, ${monsterName(occupant, { state, article: 'a' })} emerges!`);
                await publish(`${visible ? monsterName(occupant, { state, capitalized: true }) : 'Something'} speaks.`);
                // Native precheck() verbalizes bottle occupants even for a deaf hero.
                if (random(2)) {
                    await publish('"You freed me!"');
                    occupant.mpeaceful = 1;
                    setMonsterMalign(occupant, state);
                } else {
                    await publish('"It is about time."');
                    if (visible) await publish(`${monsterName(occupant, { state, capitalized: true })} vanishes.`);
                    await removeMonsterFromGame(occupant);
                }
            }
            return { nativeResult: 2, heroDied: !!state.program_state.gameover };
        }
    }
    const backfire = await checkMonsterWandBackfire(monster, object, options);
    return backfire.exploded ? { nativeResult: backfire.nativeResult, heroDied: backfire.heroDied } : null;
}

export async function presentMonsterWandUse(monster: Monster, object: GameObject, {
    state, self = false, publish = plineWithContinuation,
}: MonsterDeviceUseOptions): Promise<void> {
    if (object.spe < 1) {
        await impossible(`Mon zapping wand with ${object.spe} charges?`, { state });
        return;
    }
    if (!canSeeMonster(monster)) {
        const message = formatHeardMessage(`a ${itemUseIsNearby(monster, state) ? 'nearby' : 'distant'} zap.`, state);
        if (message) await publish(message);
        forgetObjectKnowledge(object);
    } else if (self) {
        const subject = monsterName(monster, { state, capitalized: true });
        const action = monsterReflexiveAction(monster, subject, 'zap', '', { state });
        observeObjectForNaming(object, { state });
        await publish(`${action} with ${inventoryItemDescription(object)}!`);
    } else {
        const subject = monsterName(monster, { state, capitalized: true });
        await publish(`${subject} zaps ${withIndefiniteArticle(objectCombatName(object, { state }))}!`);
        await stopHeroOccupation(state, publish);
    }
    object.spe--;
}

export async function presentMonsterHornUse(monster: Monster, object: GameObject, {
    state, self = false, publish = plineWithContinuation,
}: MonsterDeviceUseOptions): Promise<void> {
    if (!canSeeMonster(monster)) {
        const message = formatHeardMessage(`a horn being played ${itemUseIsNearby(monster, state) ? 'nearby' : 'in the distance'}.`, state);
        if (message) await publish(message);
        forgetObjectKnowledge(object);
    } else {
        observeObject(object, state);
        let name = objectCombatName(object, { state });
        if (name.length >= QBUFSZ) name = minimalObjectName(object, state);
        const subject = monsterName(monster, { state, capitalized: true });
        if (self) {
            await publish(`${monsterReflexiveAction(monster, subject, 'play', `a ${name} directed at`, { state })}!`);
        } else {
            await publish(`${subject} plays ${withIndefiniteArticle(name)} directed at you!`);
        }
        learnObjectType(object.otyp, state);
        if (!self) await stopHeroOccupation(state, publish);
    }
    object.spe--;
}

export async function presentMonsterScrollRead(monster: Monster, object: GameObject, {
    state, publish = plineWithContinuation,
}: MonsterOffensiveOptions): Promise<void> {
    const visible = canSeeMonster(monster);
    if (!visible && heroIsDeaf(state)) return;
    observeObject(object, state);
    if (visible) observeObjectForNaming(object, { state });
    const single = { ...object, quan: 1, quantity: 1 };
    const name = visible ? inventoryItemDescription(single)
        : withIndefiniteArticle(minimalObjectName(single, state));
    if (visible) {
        await publish(`${monsterName(monster, { state, capitalized: true })} reads ${name}!`);
    } else {
        const unique = !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) || monster.isshk;
        const recognize = !heroIsHallucinating(state)
            && (monster.meverseen || sameMonsterRace(heroSpecies(state), monster.mnum) && !unique);
        const sensed = canSenseMonster(monster);
        if (!sensed && couldsee(monster.mx, monster.my)
            && (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 <= 100)
            map_invisible(monster.mx, monster.my);
        const words = `reading ${name}`.replace('reading a scroll labeled', monster.mconf ? 'attempting to incant' : 'incant');
        const subject = monsterName(monster, {
            state, article: 'a', suppressInvisible: true, suppressSaddle: true,
            suppressIt: !!recognize, augmentIt: !recognize,
        });
        const heard = formatHeardMessage(`${subject} ${words}.`, state);
        if (heard) await publish(heard);
        if (sensed) await flashReadingMonster(monster, state);
    }
    if (monster.mconf) await publish(`Being confused, ${visible
        ? monsterName(monster, { state }) : monsterSubjectPronoun(monster, { state })} mispronounces the magic words...`);
}

export async function checkMonsterWandBackfire(monster: Monster, object: GameObject, {
    state, publish = plineWithContinuation, random = rn2, rollDice = d,
}: MonsterOffensiveOptions): Promise<MonsterWandBackfireResult> {
    if (object.oclass !== WAND_CLASS || !object.cursed || random(WAND_BACKFIRE_CHANCE) !== 0)
        return { exploded: false, nativeResult: 0, heroDied: false, monsterDied: false };
    const damage = rollDice(object.spe + 2, 6);
    if (cansee(monster.mx, monster.my)) {
        const subject = monsterName(monster, { state, capitalized: true });
        await publish(`${subject} zaps ${withIndefiniteArticle(objectCombatName(object, { state }))}, which suddenly explodes!`);
    } else {
        const message = formatHeardMessage(`a zap and an explosion ${itemUseIsNearby(monster, state) ? 'nearby' : 'in the distance'}.`, state);
        if (message) await publish(message);
    }
    await consumeMonsterItem(monster, object, state);
    monster.mhp -= damage;
    if (monster.mhp > 0)
        return { exploded: true, nativeResult: 0, heroDied: false, monsterDied: false };
    const death = await finishMonsterKilled(monster, state, {
        damageType: AD_RBRE, cause: '', publish, random, rollDice,
    });
    // Native precheck returns 1 after monkilled(), including life saving.
    return {
        exploded: true, nativeResult: 1,
        heroDied: !!death.heroDied, monsterDied: !death.survived,
    };
}

function itemUseIsNearby(monster: Monster, state: PlayingGameState): boolean {
    const range = couldsee(monster.mx, monster.my) ? BOLT_LIM + 1 : BOLT_LIM - 3;
    return (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2 <= range * range;
}

// C m_useup(): remove one item, preserving the remaining stack's identity.
export async function consumeMonsterItem(monster: Monster, object: GameObject, state: GameState): Promise<void> {
    if (object.quan > 1) {
        object.quan--;
        object.quantity = object.quan;
        object.owt = objectWeight(object);
    } else if (!await destroyObjectFromMonsterInventory(monster, object, state)) {
        throw new Error('A used monster item must belong to its monster.');
    }
}

async function flashReadingMonster(monster: Monster, state: PlayingGameState): Promise<void> {
    let count = couldsee(monster.mx, monster.my) ? 8 : 4;
    if (!state.flags.sparkle) count /= 2;
    const row = state.viz_array?.[monster.my];
    const saved = row?.[monster.mx];
    if (!row || saved === undefined) throw new Error('A sensed reader needs its visibility cell');
    row[monster.mx] = saved | 3;
    try {
        await flashGlyphAt(monster.mx, monster.my, transientMonsterGlyph(monster), count);
    } finally {
        row[monster.mx] = saved;
        newsym(monster.mx, monster.my);
    }
}
