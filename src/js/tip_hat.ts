// C sounds.c:tiphat() and responsive_mon_at().
import { BOLT_LIM, IRONBARS, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE,
    STRAT_WAITMASK, W_ARMH, isok } from './const.js';
import { armorSimpleName } from './armor.js';
import { canSeeMonster, glyphAt, map_invisible, plineWithContinuation as pline } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { MONSTER_FLAGS1, MONSTER_SOUND, monsterIsHumanoid } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, monsterPossessive } from './monster_name.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { publishMonsterNoise } from './monster_sound.js';
import { STATUE } from './object_data.js';
import { propertyIsActive } from './properties.js';
import { rn1, rn2 } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { isAccessibleAt } from './terrain_properties.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { couldsee } from './vision.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';

const M1_NOEYES = 0x00001000;
const M1_SEE_INVIS = 0x01000000;

interface TipRecipient {
    monster: Monster | null;
    visible: boolean;
    unseen: boolean;
    statue: boolean;
    x: number;
    y: number;
}

export async function tipWornHelmet(helmet: GameObject): Promise<boolean> {
    const discovery = !helmet.bknown;
    if (helmet.cursed) {
        await pline(`You can't.  ${helmet.quan > 1 ? 'They are' : 'It is'} cursed.`);
        helmet.bknown = true;
        return discovery;
    }
    const direction = await promptDirection(() => readDirectionKey('At whom? (in what direction) '));
    if (!direction) return discovery;
    await pline(`You briefly doff your ${armorSimpleName(helmet)}.`);
    if (!direction.dx && !direction.dy) {
        const steed = game.u.usteed;
        if (steed && direction.dz > 0) {
            if (monsterIsHelpless(steed))
                await pline(`${monsterName(steed, { capitalized: true })} doesn't notice.`);
            else await publishMonsterNoise(steed);
        } else if (direction.dz)
            await pline(`There's no one ${direction.dz < 0 ? 'up' : 'down'} there.`);
        else await pline("The lout here doesn't acknowledge you...");
        return true;
    }
    await acknowledgeHelmetTip(findTipRecipient(direction.dx, direction.dy));
    return true;
}

function findTipRecipient(dx: number, dy: number): TipRecipient {
    const level = requireGameLevel();
    let target: TipRecipient = { monster: null, visible: false, unseen: false,
        statue: false, x: game.u.ux, y: game.u.uy };
    for (let range = 1; range <= BOLT_LIM + 1; range++) {
        const x = target.x + dx, y = target.y + dy;
        if (!isok(x, y) || range > 1 && !couldsee(x, y)) break;
        let monster = monsterAtPosition(level, x, y);
        let visible = !!monster && canSeeMonster(monster);
        const glyph = glyphAt(x, y);
        const unseen = glyph?.kind === 'invisible';
        const statue = glyph?.kind === 'object' && !!glyph.statueGlyph
            || !visible && !unseen && level.objects[x]?.[y]?.[0]?.otyp === STATUE;
        if (visible && monster && [M_AP_FURNITURE, M_AP_OBJECT].includes(M_AP_TYPE(monster))) {
            visible = false;
            monster = null;
        }
        target = { monster, visible, unseen, statue, x, y };
        if (visible || unseen || statue && heroIsHallucinating()
            || range === 1 && monster && canAcknowledgeTip(monster, x, y)
                && (MONSTER_SOUND[monster.mnum] ?? 0) !== 0
            || !(isAccessibleAt(x, y) || level.at(x, y)?.typ === IRONBARS)) break;
    }
    return target;
}

async function acknowledgeHelmetTip({ monster, visible, unseen, statue, x, y }: TipRecipient): Promise<void> {
    if (unseen || statue && heroIsHallucinating()) {
        await pline(`That ${unseen ? 'unseen ' : ''}creature is ignoring you!`);
        return;
    }
    if (!monster || !canAcknowledgeTip(monster, x, y)) {
        await pline(visible && monster
            ? `${monsterName(monster, { capitalized: true })} seems not to notice you.`
            : 'Nothing happens.');
        return;
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (visible && monsterIsHumanoid(monster.mnum)) {
        if (monster.mpeaceful && !propertyIsActive('conflict', game)) {
            const helmet = (monster.minvent ?? monster.inventory ?? [])
                .find(object => (object.owornmask ?? 0) & W_ARMH);
            const name = monsterName(monster, { capitalized: true });
            if (!helmet) await pline(`${name} waves.`);
            else if (helmet.cursed) {
                await pline(`${name} grasps ${monsterPossessive(monster)} ${armorSimpleName(helmet)} but can't remove it.`);
                helmet.bknown = true;
            } else await pline(`${name} tips ${monsterPossessive(monster)} ${armorSimpleName(helmet)} in response.`);
        } else {
            const reactions = ['curses', 'gestures rudely', 'gestures offensively'];
            const deaf = heroIsDeaf();
            const which = deaf ? rn1(2, 1) : rn2(3);
            const twice = deaf || which > 0 || rn2(3) ? 0 : rn1(2, 1);
            await pline(`${monsterName(monster, { capitalized: true })} ${reactions[which]}${twice ? ` and ${reactions[twice]}` : ''} at you...`);
        }
        return;
    }
    if (Math.abs(x - game.u.ux) <= 1 && Math.abs(y - game.u.uy) <= 1
        && !heroIsDeaf() && await publishMonsterNoise(monster)) {
        if (!visible) map_invisible(x, y);
    } else await pline(visible ? `${monsterName(monster, { capitalized: true })} doesn't respond.`
        : 'Nothing happens.');
}

function canAcknowledgeTip(monster: Monster, x: number, y: number): boolean {
    const traits = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !monsterIsHelpless(monster) && !!monster.mcansee && !(traits & M1_NOEYES)
        && (!heroIsInvisible(game) || !!(traits & M1_SEE_INVIS))
        && monster.mx === x && monster.my === y;
}
