import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { CorpseRevived } from './corpse_revival.js';
import type { HeroMonsterKillOptions } from './hero_monster_death.js';
import { requirePlayingGame } from './gstate.js';

export interface UndeadTurningOptions {
    roll: typeof rnd;
    random: (limit: number) => number;
    wakeMonster: (monster: Monster) => unknown;
    finishMonsterKill: (monster: Monster, x: number, y: number, options?: HeroMonsterKillOptions) => unknown;
}

// Undead turning for actual monsters, objects, inventories, and the hero.
// C zap.c:bhitm(), bhito(), unturn_dead(), and unturn_you().

import { G_GENOD, PLNMSG_OBJ_GLOWS } from './const.js';
import {
    canSeeMonster, plineWithContinuation as pline,
} from './display.js';
import { reportHeroEncumbrance } from './attrib.js';
import { reviveCorpseByMagic } from './corpse_revival.js';
import { makeStunned } from './hero_mental_status.js';
import { game } from './gstate.js';
import { restartEggHatchTimer } from './mklev.js';
import { makeMonsterFlee } from './monster_flee.js';
import {
    monsterIsUndead, monsterIsVampireShifter,
    monsterIsNonliving, monsterTypeName, monsterYoungerForm,
} from './monster_data.js';
import { monsterName } from './monster_name.js';
import { ownedObjectName } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { CORPSE, EGG } from './object_data.js';
import { rnd } from './rng.js';
import { adjustSpellDamage } from './spell_damage.js';
import { cansee } from './vision.js';

function eggCanHatch(egg: GameObject, state: GameState) {
    const mnum = egg?.corpsenm;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0) return false;
    const younger = monsterYoungerForm(mnum);
    return [mnum, younger].filter(Number.isInteger).every(species =>
        !((state.mvitals?.[species]?.mvflags ?? 0) & G_GENOD));
}

async function announceRevival(event: CorpseRevived) {
    const x = event?.location?.x ?? event?.monster?.mx;
    const y = event?.location?.y ?? event?.monster?.my;
    if (!event?.monster || !cansee(x, y)) return;
    const name = monsterTypeName(
        event.monster.mnum, !!event.monster.female,
    );
    await pline(`The ${name} is resurrected!`);
}

export async function turnObjectWithUndeadMagic(object: GameObject, state: GameState = game) {
    if (object.otyp === EGG) {
        if (eggCanHatch(object, state)) restartEggHatchTimer(object);
        return true;
    }
    if (object.otyp !== CORPSE) {
        // NetHack counts another floor object as a beam hit even though
        // undead turning leaves that object unchanged.
        return true;
    }

    const event = await reviveCorpseByMagic(object, state);
    if (event?.kind !== 'revived') return false;
    for (const message of event.messages || []) await pline(message);
    await announceRevival(event);
    return true;
}

export async function turnCarriedObjects(inventory: readonly GameObject[] | undefined, state: GameState = game) {
    requirePlayingGame(state);
    let revived = 0;
    const heroInventory = inventory === state.inventory;
    for (const object of [...(inventory || [])]) {
        if (object.otyp === EGG) {
            if (eggCanHatch(object, state)) restartEggHatchTimer(object);
            continue;
        }
        if (object.otyp !== CORPSE) continue;
        const carrier = object.ocarry || state.level.monsters.find(monster =>
            (monster.minvent || monster.inventory || []).includes(object));
        const visible = heroInventory || carrier && canSeeMonster(carrier);
        const plural = (object.quan ?? object.quantity ?? 1) > 1;
        const corpse = visible ? `${plural ? 'One of ' : ''}${ownedObjectName(object, state, { capitalized: !plural })}` : '';
        const species = object.corpsenm;
        const event = await reviveCorpseByMagic(object, state, { byHero: !state.context.mon_moving });
        if (event?.kind !== 'revived') continue;
        revived++;
        for (const message of event.messages || []) await pline(message);
        if (visible) {
            const alive = !monsterIsNonliving(event.monster.mnum);
            const different = species !== event.monster.mnum;
            const form = different ? ` as ${withIndefiniteArticle(monsterTypeName(event.monster.mnum, event.monster.female))}` : '';
            const subject = state._lastPlineKind === PLNMSG_OBJ_GLOWS ? 'It' : corpse;
            await pline(`${subject} suddenly ${alive ? 'comes alive' : 'reanimates'}${form}!`);
        } else if (canSeeMonster(event.monster)) {
            await pline(`${monsterName(event.monster, { state, article: 'a', capitalized: true })} suddenly appears!`);
        }
    }
    if (heroInventory && revived) await reportHeroEncumbrance(state);
    return revived;
}

export async function turnMonsterWithUndeadMagic(monster: Monster, source: 'wand' | 'spell', state: GameState, options: UndeadTurningOptions): Promise<boolean | void> {
    const inventory = monster.minvent || monster.inventory || [];
    const revived = await turnCarriedObjects(inventory, state);
    const affected = monsterIsUndead(monster.mnum)
        || monsterIsVampireShifter(monster);
    if (!affected) {
        if (revived) await options.wakeMonster(monster);
        return;
    }

    let damage = options.roll(8);
    if (state.urole?.key === 'knight' && state.u?.uhave?.questart)
        damage *= 2;
    if (source === 'spell') damage = adjustSpellDamage(damage, state);


    state.context.bypasses = true;

    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(
        monster, attackLevel, options.random,
    );
    if (resisted) {
        damage = Math.ceil(damage / 2);
    }
    monster.mhp -= damage;
    if (monster.mhp <= 0) {
        await options.finishMonsterKill(monster, monster.mx, monster.my);
        if (monster.dead || monster.mhp <= 0) return;
    }
    if (!resisted) {
        const flight = await makeMonsterFlee(monster, {
            state, random: options.random, rollOne: options.roll,
        });
        if (flight.heroDied) return true;
    }
    await options.wakeMonster(monster);
    return false;
}

export async function turnHeroWithUndeadMagic(state: GameState = game, { roll = rnd }: { roll?: typeof rnd } = {}) {
    requirePlayingGame(state);
    await turnCarriedObjects(state.inventory, state);
    if (monsterIsUndead(state.u?.umonnum)) {
        const alreadyStunned = (state.u?.stunnedTurns ?? 0) > 0;
        await pline(
            `You feel frightened and ${alreadyStunned ? 'even more ' : ''}stunned.`,
        );
        await makeStunned((state.u.stunnedTurns ?? 0) + roll(30), { state, talk: false });
    } else {
        await pline('You shudder in dread.');
    }
}
