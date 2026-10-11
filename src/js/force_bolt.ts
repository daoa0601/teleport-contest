import type { HeroMonsterKillOptions } from './hero_monster_death.js';
interface ForceHitOptions {
    x?: number; y?: number; roll: (sides: number) => number;
    rollDice: typeof d; random: typeof rn2;
    finishMonsterKill: (monster: Monster, x: number, y: number, options?: HeroMonsterKillOptions) => unknown;
}
interface FloorForceOptions {
    state?: GameState; random?: typeof rn2; rollDice?: typeof d;
}
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
// Point-target striking and force-bolt damage. C zap.c:bhitm()/bhito().
// The wand effect owner chooses targets and handles traversal and terrain.
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import {
    newsym, plineWithContinuation as pline, randomDisplayMonsterName, shieldeff,
} from './display.js';
import { game } from './gstate.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { monsterName } from './monster_name.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { findMonsterArmorClass } from './monworn.js';
import { breakFloorObject } from './object_breakage.js';
import { BOULDER, STATUE } from './object_data.js';
import { rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { breakStatue, fractureRock } from './rock_breakage.js';
import { d, rn2 } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { adjustSpellDamage } from './spell_damage.js';
import { cansee } from './vision.js';

export async function hitMonsterWithForce(monster: Monster, source: 'wand' | 'spell', state: GameState, options: ForceHitOptions) {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const targetCellWasVisible = cansee(options.x ?? monster.mx, options.y ?? monster.my);
    if (monsterHasMagicResistance(monster)) {
        revealMonsterAppearance(monster, {
            includeMonsterDisguise: false,
        });
        await shieldeff(monster.mx, monster.my, state);
        await pline('Boing!');
        await wakeAttackedMonster(monster);
        return targetCellWasVisible;
    }

    const hit = (state.u?.uswallow && state.u?.ustuck === monster)
        || options.roll(20) < 10 + findMonsterArmorClass(monster);
    if (!hit) {
        if (!monster.m_ap_type) {
            await pline(rayMissMessage(source, monster, {
                x: monster.mx, y: monster.my, state,
            }));
        }
        await wakeAttackedMonster(monster);
        return false;
    }

    revealMonsterAppearance(monster);
    let damage = options.rollDice(2, 12);
    if (state.urole?.key === 'knight' && state.u?.uhave?.questart)
        damage *= 2;
    if (source === 'spell') damage = adjustSpellDamage(damage, state);

    await pline(rayHitMessage(source, monster, {
        x: monster.mx, y: monster.my, damage, state,
    }));
    if (monsterResistsEffect(monster, attackLevel, options.random)) {
        damage = Math.ceil(damage / 2);
        await shieldeff(monster.mx, monster.my, state);
        if (cansee(monster.mx, monster.my))
            await pline(`${monsterName(monster, { capitalized: true })} resists!`);
    }
    monster.mhp = (monster.mhp ?? 1) - damage;
    if (monster.mhp <= 0) {
        await options.finishMonsterKill(monster, monster.mx, monster.my);
    }
    if (monster.mhp > 0 && !monster.dead) {
        await wakeAttackedMonster(monster);
    }
    return targetCellWasVisible;
}

export async function hitFloorObjectWithForce(object: GameObject, {
    state = game, random = rn2, rollDice = d,
}: FloorForceOptions = {}) {
    const x = object.ox, y = object.oy;
    let learned = cansee(x, y) || !heroIsDeaf(state);
    if (object.otyp === BOULDER) {
        if (cansee(x, y)) await pline('The boulder falls apart.');
        else if (!heroIsDeaf(state)) await pline('You hear a crumbling sound.');
        await fractureRock(object, x, y, { state, random });
        return { affected: 1, learned };
    }
    if (object.otyp === STATUE) {
        if (await breakStatue(object, x, y, { state, random })) {
            if (cansee(x, y)) {
                const subject = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'statue';
                await pline(`The ${subject} shatters.`);
            } else if (!heroIsDeaf(state)) await pline('You hear a crumbling sound.');
        }
        return { affected: 1, learned };
    }
    const result = await breakFloorObject(object, {
        state, random, rollDice,
        heroCaused: !state.context?.mon_moving,
    });
    learned &&= result.destroyed;
    if (result.destroyed) newsym(x, y);
    return { affected: 0, learned };
}
