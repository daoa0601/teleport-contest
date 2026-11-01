// C apply.c:use_leash(), use_leash_core(), m_unleash(), o_unleash(),
// get_mleash(), leashable() and unleash_all().
import { isok } from './const.js';
import { canSeeMonster, canSpotMonster, map_invisible, unmap_invisible } from './display.js';
import { plineWithContinuation as pline, plineWithContinuation } from './pline.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SOUND } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterLeashName, monsterName } from './do_name.js';
import { monsterPossessive } from './mondata.js';
import { possessiveName } from './hacklib.js';
import { LEASH } from './object_data.js';
import { promptDirection } from './tty_prompts.js';
import { rn2, rnd } from './rng.js';
import type { MessagePublisher } from './pline.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { publishMonsterGrowl, publishMonsterWhimper, publishMonsterYelp } from './ambient_sounds.js';

export async function useLeash(leash: GameObject): Promise<boolean> {
    const hero = game.u;
    if (hero.uswallow) {
        if (!hero.ustuck) throw new Error('A swallowed hero needs an engulfer.');
        const name = monsterName(hero.ustuck, { suppressIt: true });
        const action = !leash.leashmon ? `leash ${name} from inside`
            : leash.leashmon === hero.ustuck.m_id ? `unleash ${name} from inside`
                : `unleash anything from inside ${name}`;
        await pline(`You can't ${action}.`);
        return false;
    }
    if (!leash.leashmon && game.inventory.filter(object => object.otyp === LEASH && object.leashmon).length >= 2) {
        await pline('You cannot leash any more pets.');
        return false;
    }
    const direction = await promptDirection();
    if (!direction) {
        await pline('Never mind.');
        return false;
    }
    const x = hero.ux + direction.dx, y = hero.uy + direction.dy;
    if (!isok(x, y)) return false;
    if (x === hero.ux && y === hero.uy) {
        if (hero.usteed && direction.dz > 0) {
            await useLeashOnMonster(leash, hero.usteed, x, y, true);
            return true;
        }
        await pline('Leash yourself?  Very funny...');
        return false;
    }
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (!monster) {
        await pline('There is no creature there.');
        await unmap_invisible(x, y);
    } else await useLeashOnMonster(leash, monster, x, y, canSpotMonster(monster));
    return true;
}

async function useLeashOnMonster(leash: GameObject, monster: Monster, x: number, y: number, spotted: boolean) {
    const level = requireGameLevel();
    const name = () => monsterName(monster, { capitalized: true });
    const petName = () => monsterLeashName(monster);
    if (!spotted && level.requireAt(x, y).remembered_glyph?.kind !== 'invisible') {
        await pline(`You fail to ${leash.leashmon ? 'un' : ''}leash something.`);
        await map_invisible(x, y);
    } else if (!monster.mtame) {
        await pline(`${name()} ${leash.leashmon ? 'is not' : 'cannot be'} leashed!`);
    } else if (!leash.leashmon) {
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (monster.mleashed) await pline(`This ${spotted ? petName() : 'creature'} is already leashed.`);
        else if (flags & 0x00100000) await pline('The leash would just fall off.');
        else if ((flags & 0x6000) === 0x6000 && (flags & 0x8000))
            await pline(`${name()} has no extremities the leash would fit.`);
        else if (!monsterCanBeLeashed(monster)) {
            const target = x !== monster.mx || y !== monster.my ? `${possessiveName(petName())} tail` : petName();
            await pline(`The leash won't fit onto ${spotted ? 'your ' : ''}${target}.`);
        } else {
            await pline(`You slip the leash around ${spotted ? 'your ' : ''}${petName()}.`);
            monster.mleashed = 1;
            leash.leashmon = monster.m_id;
            monster.msleeping = 0;
        }
    } else if (leash.leashmon !== monster.m_id) {
        await pline('This leash is not attached to that creature.');
    } else if (leash.cursed) {
        await pline('The leash would not come off!');
        leash.bknown = true;
    } else {
        monster.mleashed = 0;
        leash.leashmon = 0;
        await pline(`You remove the leash from ${spotted ? 'your ' : ''}${petName()}.`);
    }
}

// C check_leash(): only movement farther from a pet tightens its leash.
export async function checkHeroLeashes(oldX: number, oldY: number) {
    requirePlayingGame(game);
    const distance = (x: number, y: number, monster: Monster) =>
        (x - monster.mx) ** 2 + (y - monster.my) ** 2;
    for (const leash of game.inventory.filter(object => object.otyp === LEASH && object.leashmon)) {
        const monster = game.level.monsters.find(candidate => candidate.m_id === leash.leashmon);
        if (!monster) {
            await impossible("leash in use isn't attached to anything?");
            leash.leashmon = 0;
            continue;
        }
        if (distance(game.u.ux, game.u.uy, monster) <= distance(oldX, oldY, monster)) continue;
        const separation = Math.max(Math.abs(game.u.ux - monster.mx), Math.abs(game.u.uy - monster.my));
        if (separation <= 3) continue;
        if (leash.cursed && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x400)) {
            if (separation > 5 || (monster.mhp -= rnd(2)) <= 0) {
                const pacifism = game.u.uconduct.killer ?? 0;
                await pline(`Your leash chokes ${monsterName(monster)} to death!`);
                await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
                if (monster.mhp > 0) game.u.uconduct.killer = pacifism;
            } else {
                await pline(`${monsterName(monster, { capitalized: true })} is choked by the leash!`);
                if (monster.mtame && rn2(monster.mtame)) monster.mtame--;
            }
        } else if (separation > 5) {
            await pline(`${possessiveName(monsterName(monster, { capitalized: true }))} leash snaps loose!`);
            releaseMonsterLeash(monster);
        } else {
            await pline('You pull on the leash.');
            if (MONSTER_SOUND[monster.mnum]) {
                const sound = rn2(3);
                if (sound === 0) await publishMonsterGrowl(monster);
                else if (sound === 1) await publishMonsterYelp(monster);
                else await publishMonsterWhimper(monster);
            }
        }
        if (game.program_state.gameover) return;
    }
}

const M1_NOLIMBS = 0x00006000;
const M1_NOHEAD = 0x00008000;
const M1_UNSOLID = 0x00100000;
const LEASH_PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

// C apply.c:leashable().  A head is enough to leash a limbless monster.
export function monsterCanBeLeashed(monster: Monster): boolean {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const hasNoLimbs = (flags & M1_NOLIMBS) === M1_NOLIMBS;
    return monster?.mnum !== LEASH_PM_LONG_WORM
        && !(flags & M1_UNSOLID)
        && (!hasNoLimbs || !(flags & M1_NOHEAD));
}

// C apply.c:get_mleash().
export function leashAttachedToMonster(monster: Monster | null | undefined, state: GameState = game): GameObject | null {
    return (state.inventory || []).find(object =>
        object.otyp === LEASH && object.leashmon === monster?.m_id) || null;
}

// C apply.c:o_unleash(). The leash need not be in inventory.
export function releaseObjectLeash(leash: GameObject, state: GameState = game): void {
    const monster = requireGameLevel(state).monsters.find(candidate => candidate.m_id === leash.leashmon);
    if (monster) monster.mleashed = 0;
    leash.leashmon = 0;
}

// C apply.c:m_unleash().
export function releaseMonsterLeash(monster: Monster, state: GameState = game): GameObject | null {
    const leash = leashAttachedToMonster(monster, state);
    if (leash) leash.leashmon = 0;
    monster.mleashed = 0;
    return leash;
}

// C apply.c:m_unleash() with feedback.
export async function releaseMonsterLeashWithFeedback(monster: Monster, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}) {
    requireLiveGame(state);
    if (canSeeMonster(monster)) {
        const name = monsterName(monster, { capitalized: true, state });
        const possessive = monsterPossessive(monster, { state });
        await publish(`${name} pulls free of ${possessive} leash!`);
    } else {
        await publish('Your leash falls slack.');
    }
    return releaseMonsterLeash(monster, state);
}

// C apply.c:unleash_all().
export function releaseAllMonsterLeashes(state: GameState = game): number {
    const attachedLeashes = (state.inventory || []).filter(object =>
        object.otyp === LEASH && object.leashmon);
    for (const monster of state.level?.monsters || [])
        monster.mleashed = 0;
    for (const leash of attachedLeashes) leash.leashmon = 0;
    return attachedLeashes.length;
}
