// Slow-monster and speed-monster point effects. C zap.c:bhitm().

import {
    canSeeMonster, plineWithContinuation as pline,
} from './display.js';
import { expelHero, holdingMonsterName } from './hero_expulsion.js';
import { wakeMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { monsterIsWhirly } from './monster_data.js';
import { monsterName } from './monster_name.js';
import {
    adjustMonsterSpeed, monsterSpeedMessage,
} from './monster_speed.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

interface SpeedMagicOptions {
    random: (limit: number) => number;
    roll: (sides: number) => number;
}

export async function affectMonsterSpeed(
    monster: Monster,
    kind: 'speed' | 'slow',
    source: 'wand' | 'spell',
    state: GameState,
    options: SpeedMagicOptions,
): Promise<boolean> {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(
        monster, attackLevel, options.random,
    );
    let observed = false;
    if (!resisted) {
        revealMonsterAppearance(monster);
        const speed = adjustMonsterSpeed(monster, kind === 'speed' ? 1 : -1);
        checkMonsterGearNextTurn(monster);
        if (canSeeMonster(monster)) {
            const subject = monsterName(monster, { state, capitalized: true });
            const message = monsterSpeedMessage(speed, subject);
            if (message) {
                await pline(message);
                observed = true;
            }
        }
        if (kind === 'slow' && state.u?.uswallow
            && state.u?.ustuck === monster && monsterIsWhirly(monster)) {
            await pline(`You disrupt ${holdingMonsterName(monster)}!`);
            await pline('A huge hole opens up...');
            await expelHero(monster, {
                state, random: options.random, rollOne: options.roll,
            });
        }
    }
    await wakeMonster(monster, { attacked: kind === 'slow' });
    return observed;
}
