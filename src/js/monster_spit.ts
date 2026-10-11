// Natural venom uses the same awaited projectile flight as thrown weapons.
// C mthrowu.c:spitmm() and spitmu().

import { BOLT_LIM, M_ATTK_HIT, M_ATTK_MISS } from './const.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, canSpotMonster, plineWithContinuation } from './display.js';
import { requireLiveGame } from './gstate.js';
import { dist2, distmin } from './hacklib.js';
import { formatHeardMessage } from './hero_speech.js';
import { mksobj } from './mklev.js';
import { AD_ACID, AD_BLND, AD_DRST } from './monster_attack_types.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterLinedUpWithHero, monsterLinedUpWithMonster } from './monster_ranged_alignment.js';
import { throwMonsterProjectile } from './monster_throw.js';
import { ACID_VENOM, BLINDING_VENOM } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { AttackTuple } from './monster_action_types.js';
import type { Monster } from './monster_types.js';

export interface MonsterSpitResult {
    nativeResult: number;
    heroDied: boolean;
}

interface MonsterSpitOptions {
    state: PlayingGameState;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    publish?: MessagePublisher;
}

export function resolveMonsterCombatSpit(
    source: Monster, target: Monster, attack: AttackTuple, options: MonsterSpitOptions,
): Promise<MonsterSpitResult> {
    return spitAtTarget(source, target, attack, options);
}

export function resolveMonsterSpitAtHero(
    source: Monster, attack: AttackTuple, options: MonsterSpitOptions,
): Promise<MonsterSpitResult> {
    return spitAtTarget(source, null, attack, options);
}

async function spitAtTarget(source: Monster, target: Monster | null, attack: AttackTuple, {
    state, random = rn2, rollOne = rnd, publish = plineWithContinuation,
}: MonsterSpitOptions): Promise<MonsterSpitResult> {
    requireLiveGame(state);
    if (source.mcan) {
        await reportDryThroat(source, state, publish);
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    }
    const aligned = target
        ? monsterLinedUpWithMonster(source, target, state)
        : monsterLinedUpWithHero(source, state, random);
    if (!aligned) return { nativeResult: M_ATTK_MISS, heroDied: false };

    const targetX = target ? target.mx : source.mux ?? 0;
    const targetY = target ? target.my : source.muy ?? 0;
    const blinding = attack[1] === AD_BLND || attack[1] === AD_DRST;
    if (!blinding && attack[1] !== AD_ACID)
        await impossible('bad attack type in spitmm');
    const venomType = blinding ? BLINDING_VENOM : ACID_VENOM;
    const venom = await mksobj(venomType, true, false);
    const distance = distmin(source.mx, source.my, targetX, targetY);
    if (random(BOLT_LIM - distance)) {
        await deleteObject(venom, state);
        return { nativeResult: M_ATTK_MISS, heroDied: false };
    }
    if (canSeeMonster(source))
        await publish(`${monsterName(source, { state, capitalized: true })} spits venom!`);
    const flight = await throwMonsterProjectile(source, venom, {
        state, dx: Math.sign(targetX - source.mx), dy: Math.sign(targetY - source.my),
        range: distance, target, random, rollOne, publish,
    });
    if (flight.heroDied) return { nativeResult: M_ATTK_HIT, heroDied: true };
    endVoluntaryMultiTurn(state);
    if (source.mtame && !source.isminion) {
        const pet = source.edog ?? source.mextra?.edog;
        if (!pet) throw new Error(`Spitting pet ${source.m_id} has no pet state.`);
        if (pet.hungrytime > 1) pet.hungrytime -= 5;
    }
    return { nativeResult: M_ATTK_HIT, heroDied: false };
}

async function reportDryThroat(source: Monster, state: PlayingGameState, publish: MessagePublisher): Promise<void> {
    if (heroIsDeaf(state)
        || dist2(source.mx, source.my, state.u.ux, state.u.uy) >= BOLT_LIM * BOLT_LIM) return;
    if (canSpotMonster(source)) {
        const owner = possessiveName(monsterName(source, { state }));
        await publish(`A dry rattle comes from ${owner} throat.`);
    } else {
        const message = formatHeardMessage('a dry rattle nearby.', state);
        if (message) await publish(message);
    }
}
