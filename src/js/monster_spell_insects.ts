// C mcastu.c:mcast_insects(). Feedback depends on sensing the caster and
// spotting the summons separately; blindness alone answers neither question.
import { MONSEEN_TELEPAT, MM_ANGRY, MM_NOMSG } from './const.js';
import { heroIsDisplaced } from './armor.js';
import { canSeeMonster, canSpotMonster, howMonsterSeen, newsym, randomBogusMonsterName } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroIsUnaware } from './hero_sleep.js';
import { formatHeardMessage } from './hero_speech.js';
import { makemonAt, mkclassAligned } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import type { MonsterSpellEffect } from './monster_action_types.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { makePlural, makeSingular, verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { rnd } from './rng.js';
import { heroDetectsMonsters, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';

const S_ANT = 1;
const S_SNAKE = 45;
const M1_SEE_INVIS = 0x00020000;

export async function summonMonsterInsects(caster: Monster, state: PlayingGameState): Promise<MonsterSpellEffect> {
    const monsterClass = mkclassAligned(S_ANT, 0) === null ? S_SNAKE : S_ANT;
    const oldSeen = spottedMonsterCount(state);
    const level = caster.m_lev ?? 0;
    const quantity = Math.max(3, level < 2 ? 1 : rnd(Math.trunc(level / 2)));
    const created: Monster[] = [];
    for (let index = 0; index <= quantity; index++) {
        const point = findNearbyMonsterPosition(caster.mnum,
            caster.mux ?? state.u.ux, caster.muy ?? state.u.uy, { state });
        // Native returns immediately if enexto() fails, including after
        // earlier successful births; it gives no summoning feedback then.
        if (!point) return { count: created.length, created, message: null };
        const species = mkclassAligned(monsterClass, 0);
        if (species === null) continue;
        const monster = await makemonAt(species, point.x, point.y, MM_ANGRY | MM_NOMSG);
        if (!monster) continue;
        monster.msleeping = 0;
        monster.mpeaceful = 0;
        monster.mtame = 0;
        setMonsterMalign(monster, state);
        newsym(monster.mx, monster.my);
        created.push(monster);
    }

    const newSeen = spottedMonsterCount(state);
    const seeCaster = canSeeMonster(caster) || !!(howMonsterSeen(caster) & MONSEEN_TELEPAT)
        || heroDetectsMonsters(state);
    const what = heroIsHallucinating(state) ? makePlural(randomBogusMonsterName())
        : monsterClass === S_SNAKE ? 'snakes' : 'insects';
    let message: string | null;
    if (!seeCaster) {
        if (newSeen <= oldSeen || heroIsUnaware(state)) {
            message = formatHeardMessage(`someone summoning ${what}.`, state);
        } else {
            const subject = newSeen === oldSeen + 1 ? withIndefiniteArticle(makeSingular(what)) : what;
            const appearance = `${subject} ${verbForSubject(subject, 'appear')}.`;
            message = heroIsDeaf(state) ? appearance.charAt(0).toUpperCase() + appearance.slice(1)
                : formatHeardMessage(`someone summoning something, and ${appearance}`, state);
        }
    } else {
        const subject = monsterName(caster, { state, capitalized: true });
        const wrongTarget = caster.mux !== state.u.ux || caster.muy !== state.u.uy;
        if (!created.length) message = `${subject} casts at a clump of sticks, but nothing happens.`;
        else if (monsterClass === S_SNAKE) message = `${subject} transforms a clump of sticks into ${what}!`;
        else if (heroIsInvisible(state) && !((MONSTER_FLAGS1[caster.mnum] ?? 0) & M1_SEE_INVIS) && wrongTarget)
            message = `${subject} summons ${what} around a spot near you!`;
        else if (heroIsDisplaced(state) && wrongTarget)
            message = `${subject} summons ${what} around your displaced image!`;
        else message = `${subject} summons ${what}!`;
    }
    return { count: created.length, created, message };
}

function spottedMonsterCount(state: PlayingGameState): number {
    return state.level.monsters.filter(monster => !monster.dead && monster.mhp > 0
        && !(monster.isgd && monster.mx === 0) && canSpotMonster(monster)).length;
}
