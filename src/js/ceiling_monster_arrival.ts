// C hack.c:spoteffects(): a concealed monster shares the arrival square
// until its surprise attack is resolved, then moves beside the hero.
import { heroHasCarriedArtifactFlag } from './artifacts.js';
import { objectIsHardHelmet } from './armor.js';
import { RLOC_NOMSG } from './const.js';
import { canSenseMonster } from './display.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { damageHeroFromMonster } from './hero_damage.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { d, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { moveMonsterNextToHero } from './teleport.js';
import { ceilingName } from './terrain_name.js';

const S_PIERCER = 16;

export async function finishCeilingMonsterArrival(state: PlayingGameState, publish: MessagePublisher): Promise<boolean> {
    const hero = state.u;
    const monster = monsterAtPosition(state.level, hero.ux, hero.uy);
    if (!monster || hero.uswallow) return false;
    monster.mundetected = 0;
    monster.msleeping = 0;
    if (MONSTER_SYMBOL[monster.mnum] === S_PIERCER) {
        const subject = monsterName(monster, { state, article: 'a', capitalized: true });
        await publish(`${subject} suddenly drops from the ${ceilingName(hero.ux, hero.uy, state)}!`);
        const helmet = state.uarmh ?? hero.uarmh;
        if (monster.mtame) {
            // Tame piercers drop to greet the hero and do no damage.
        } else if (objectIsHardHelmet(helmet)) {
            await publish('Its blow glances off your helm.');
        } else {
            const missed = hero.uac + 3 <= rnd(20);
            const falling = monsterName(monster, { state, article: 'a', adjective: 'falling', suppressIt: true });
            if (missed) {
                await publish(`You are almost hit by ${falling}!`);
            } else {
                await publish(`You are hit by ${falling}!`);
                let damage = d(4, 6);
                if (hero.halfPhysicalDamage || heroHasCarriedArtifactFlag('SPFX_HPHDAM', state))
                    damage = Math.trunc((damage + 1) / 2);
                if (await damageHeroFromMonster(monster, damage, { state, publish })) return true;
            }
        }
    } else if (monster.mtame) {
        const subject = monsterName(monster, { state, article: 'a', capitalized: true });
        await publish(`${subject} jumps near you from the ${ceilingName(hero.ux, hero.uy, state)}.`);
    } else if (monster.mpeaceful) {
        const surprised = heroIsBlind(state) && !canSenseMonster(monster) ? 'something'
            : monsterName(monster, { state, article: 'a' });
        await publish(`You surprise ${surprised}!`);
        monster.mpeaceful = 0;
    } else {
        const subject = monsterName(monster, { state, article: 'a', capitalized: true });
        await publish(`${subject} attacks you by surprise!`);
    }
    await moveMonsterNextToHero(monster, state, { flags: RLOC_NOMSG });
    return !!state.program_state.gameover;
}
