// Monster-versus-monster gaze admission and reflection.
// C mhitm.c:gazemm(); ordinary damage belongs to mdamagem().

import { monsterResistsBlindingLight } from './blinding_attack.js';
import { M_AP_TYPE, M_ATTK_AGR_DIED, M_ATTK_MISS } from './const.js';
import { canSeeMonster, canSpotMonster, plineWithContinuation } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { AD_BLND } from './monster_attack_types.js';
import { applyMonsterCombatBlindness } from './monster_combat_status.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterName, monsterPossessive, possessiveName } from './monster_name.js';
import { prepareMonsterPetrification } from './monster_stoning.js';
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { monsterReflectionSource } from './ray.js';
import { d, rn2 } from './rng.js';
import type { MessagePublisher } from './display.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { AttackTuple } from './monster_action_types.js';
import type { MonsterCombatDamageResult, ResolveMonsterCombatDamage } from './monster_combat_effect_types.js';
import type { Monster } from './monster_types.js';

const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const S_MIMIC = 13;
const M1_SEE_INVIS = 0x01000000;

interface MonsterCombatGazeOptions {
    state?: GameState;
    visible: boolean;
    random?: typeof rn2;
    rollDice?: typeof d;
    publish?: MessagePublisher;
    resolveDamage: ResolveMonsterCombatDamage;
}

export async function resolveMonsterCombatGaze(
    attacker: Monster, defender: Monster, attack: AttackTuple, {
        state = game, visible, random = rn2, rollDice = d,
        publish = plineWithContinuation, resolveDamage,
    }: MonsterCombatGazeOptions,
): Promise<MonsterCombatDamageResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const archon = attacker.mnum === PM_ARCHON && attack[1] === AD_BLND;
    const blindedArchon = archon && !attacker.mcansee;
    if (MONSTER_SYMBOL[defender.mnum] === S_MIMIC && M_AP_TYPE(defender))
        revealMonsterAppearance(defender);
    defender.mundetected = 0;

    if (visible) {
        const subject = monsterName(attacker, {
            state, capitalized: true, adjective: blindedArchon ? 'blinded' : '',
        });
        const target = canSpotMonster(defender) ? monsterName(defender, { state }) : 'something';
        await publish(`${subject} gazes ${blindedArchon ? 'toward' : 'at'} ${target}...`);
    }
    if (attacker.mcan || !defender.mcansee
        || (archon ? monsterResistsBlindingLight(defender, state) : !attacker.mcansee)
        || attacker.minvis && !perceivesInvisible(defender) || defender.msleeping) {
        if (visible && canSpotMonster(defender)) await publish('but nothing happens.');
        return gazeResult(M_ATTK_MISS);
    }

    if (attacker.mnum === PM_MEDUSA && monsterReflectionSource(defender, state)) {
        await showGazeReflection(defender, state, publish);
        if (monsterReflectionSource(attacker, state)) {
            await showGazeReflection(attacker, state, publish);
            return gazeResult(M_ATTK_MISS);
        }
        if (defender.minvis && !perceivesInvisible(attacker)) {
            if (canSeeMonster(attacker)) {
                const subject = monsterName(attacker, { state, capitalized: true });
                const pronoun = monsterPossessive(attacker, { state, random });
                await publish(`${subject} doesn't seem to notice that ${pronoun} gaze was reflected.`);
            }
            return gazeResult(M_ATTK_MISS);
        }
        if (canSeeMonster(attacker))
            await publish(`${monsterName(attacker, { state, capitalized: true })} is turned to stone!`);
        const stone = await prepareMonsterPetrification(attacker, { publish });
        if (stone.heroDied) return gazeResult(M_ATTK_MISS, true);
        if (stone.survived) return gazeResult(M_ATTK_MISS);
        const death = await finishEnvironmentalMonsterDeath(attacker, state, {
            noCorpse: true, publish, random, rollDice,
        });
        return gazeResult(attacker.mhp <= 0 ? M_ATTK_AGR_DIED : M_ATTK_MISS, !!death.heroDied);
    }
    if (archon) {
        await applyMonsterCombatBlindness(attacker, defender, attack, {
            state, visible, publish, rollDice,
        });
        if (random(2)) defender.mstun = 1;
    }
    return resolveDamage(attacker, defender, attack);
}

function gazeResult(nativeResult: number, heroDied = false): MonsterCombatDamageResult {
    return { damage: 0, nativeResult, heroDied, skipBrainDrain: false };
}

function perceivesInvisible(monster: Monster): boolean {
    return !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
}

// Native mon_reflects only identifies a worn shield or amulet when its
// reflection is optically visible. Detection alone does not reveal the item.
async function showGazeReflection(monster: Monster, state: PlayingGameState, publish: MessagePublisher): Promise<void> {
    if (!canSeeMonster(monster)) return;
    const source = monsterReflectionSource(monster, state);
    if (!source) return;
    const owner = possessiveName(monsterName(monster, { state }));
    await publish(`The gaze is reflected away by ${owner} ${source.noun}.`);
    const object = source.object;
    if (object && (object.otyp === SHIELD_OF_REFLECTION || object.otyp === AMULET_OF_REFLECTION))
        learnObjectType(object.otyp, state);
}
