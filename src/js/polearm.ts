// Applying a polearm (or the Snickersnee katana) as a distance attack.
// C refs: apply.c use_pole(), calc_pole_range(), find_poleable_mon(),
// get_valid_polearm_position(), snickersnee_used_dist_attk().

import { monsterAtPosition } from './monster_location.js';
import {
    ACCESSIBLE,
    COLNO,
    IS_FURNITURE,
    P_BASIC,
    P_SKILLED,
    P_TWO_WEAPON_COMBAT,
    ROWNO,
    SCORR,
    STONE,
    STATUE_TRAP,
    isok,
} from './const.js';
import { artifactById } from './artifacts.js';
import { canSenseMonster, glyphAt, pline, unmap_invisible } from './display.js';
import { wipeHeroEngraving } from './engrave.js';
import { game } from './gstate.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { checkHeroAttackOverexertion } from './hero_overexertion.js';
import { hitMonsterWithAppliedWeapon } from './hero_ranged_attack.js';
import { prepareMapPositionHighlights, selectMapPosition, shouldShowGetposTip, showGetposInstructions, showGetposTip } from './getpos.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { ensureHeroSkills } from './skills.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { BOULDER, OBJECT_SUBTYPE, STATUE } from './object_data.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { cansee, couldsee } from './vision.js';
import { isPolearm } from './weapon_type.js';

import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { GlyphMetadata } from './display.js';
import type { Position } from './map_types.js';
import type { PositionDescription } from './getpos.js';

export type PolearmResult =
    | { heroDied: true }
    | {
          spentTime: boolean;
          resume?: true;
          cancelled?: true;
          failure?: true;
      };

interface PolearmOptions {
    state?: GameState;
    ensureWielded?: () => Promise<{ ready: boolean; newlyWielded?: boolean }>;
    describeTarget?: PositionDescription;
    autohit?: boolean;
}

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;

// C apply.c glyph_is_poleable()/glyph_is_statue() over the drawn glyph.
function poleableGlyph(glyph: GlyphMetadata | null) {
    return glyph?.kind === 'monster' || glyph?.kind === 'invisible' || statueGlyph(glyph);
}

function statueGlyph(glyph: GlyphMetadata | null) {
    return glyph?.kind === 'object' && !!glyph.statueGlyph;
}

function floorHasObject(otyp: number, x: number, y: number, state: GameState) {
    // C sobj_at(): any matching object in the pile, not just the drawn top.
    return (state.level?.objects?.[x]?.[y] || []).some((object) => object.otyp === otyp);
}

function squaredDistance(x: number, y: number, state: GameState) {
    const dx = x - state.u.ux;
    const dy = y - state.u.uy;
    return dx * dx + dy * dy;
}

function monsterAt(x: number, y: number, state: GameState) {
    return state.level ? monsterAtPosition(state.level, x, y) : null;
}

function heroIsImpaired(state: GameState) {
    const confused = !!state.u?.confused || (state.u?.confusionTurns ?? 0) > 0;
    const stunned = !!state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0;
    return confused || stunned || heroIsHallucinating(state);
}

// C apply.c calc_pole_range() reads the hero's skill through
// wield.c uwep_skill_type(): dual wielding uses the two-weapon skill and
// otherwise the wielded item's own class, so Snickersnee (a katana)
// measures reach with sword skill, not polearm skill.
function weaponSkillType(weapon: GameObject | null | undefined, state: GameState) {
    if (state.u?.twoweap) return P_TWO_WEAPON_COMBAT;
    if (!weapon) return 0;
    if (
        weapon.oclass !== WEAPON_CLASS &&
        weapon.oclass !== TOOL_CLASS &&
        weapon.oclass !== GEM_CLASS
    )
        return 0;
    return Math.abs(OBJECT_SUBTYPE[weapon.otyp] ?? 0);
}

function calcPoleRange(weapon: GameObject, { state = game } = {}) {
    const skillType = weaponSkillType(weapon, state);
    const level = skillType === 0 ? 0 : (ensureHeroSkills(state)?.[skillType]?.skill ?? 0);
    let max = 4;
    if (!(skillType === 0 || level <= P_BASIC)) max = level === P_SKILLED ? 5 : 8;
    return { min: 4, max };
}

// C apply.c get_valid_polearm_position().
function validPolearmPosition(x: number, y: number, min: number, max: number, state: GameState) {
    if (!isok(x, y)) return false;
    const distance = squaredDistance(x, y, state);
    return (
        distance >= min &&
        distance <= max &&
        (cansee(x, y) || (couldsee(x, y) && poleableGlyph(glyphAt(x, y, state))))
    );
}

// C apply.c find_poleable_mon(): the single auto-target candidate, if any.
// More than one candidate leaves the cursor on the hero, like C returning
// FALSE without touching the out parameter.
function findPoleableSpot(state: GameState, min: number, max: number) {
    const impaired = heroIsImpaired(state);
    const reach = Math.floor(Math.sqrt(max));
    const loX = Math.max(state.u.ux - reach, 1);
    const hiX = Math.min(state.u.ux + reach, COLNO - 1);
    const loY = Math.max(state.u.uy - reach, 0);
    const hiY = Math.min(state.u.uy + reach, ROWNO - 1);
    let spot: Position | null = null;

    for (let x = loX; x <= hiX; x++) {
        for (let y = loY; y <= hiY; y++) {
            if (!validPolearmPosition(x, y, min, max, state)) continue;
            const glyph = glyphAt(x, y, state);
            if (!impaired && glyph?.kind === 'monster') {
                const monster = monsterAt(x, y, state);
                if (
                    monster &&
                    (monster.mtame || (monster.mpeaceful && state.flags?.confirm !== false))
                )
                    continue;
            }
            if (poleableGlyph(glyph) && (!statueGlyph(glyph) || impaired)) {
                if (spot) return null;
                spot = { x, y };
            }
        }
    }
    return spot;
}

function rememberedPolearmMonster(state: GameState) {
    const id = state.context?.polearm?.hitmonId;
    if (id === null || id === undefined) return null;
    return (
        (state.level?.monsters || []).find(
            (monster) => monster.m_id === id && !monster.dead && (monster.mhp ?? 1) > 0,
        ) || null
    );
}

function rememberPolearmTarget(monster: Monster | null, state: GameState) {
    if (!state.context.polearm) state.context.polearm = { hitmonId: null };
    state.context.polearm.hitmonId = monster ? monster.m_id : null;
}

// C apply.c could_pole_mon(): the dofire fireassist predicate.
export function couldPoleMonster(weapon: GameObject | null | undefined, { state = game } = {}) {
    if (!weapon || !isPolearm(weapon)) return false;
    const { min, max } = calcPoleRange(weapon, { state });
    if (findPoleableSpot(state, min, max)) return true;
    const remembered = rememberedPolearmMonster(state);
    if (!remembered || !canSenseMonster(remembered)) return false;
    const distance = squaredDistance(remembered.mx, remembered.my, state);
    return distance <= max && distance >= min;
}

// C obj.h u_wield_art(ART_SNICKERSNEE), via the same id lookup
// weapon_type.js uses for is_pole().
function isArtifactSnickersnee(object: GameObject) {
    return artifactById(object?.oartifact)?.name === 'Snickersnee';
}

// C words the obstacle with the displayed cmap glyph's defsyms
// explanation; glyphAt() carries that as terrainName.
function obstacleDescription(glyph: GlyphMetadata | null, x: number, y: number, state: GameState) {
    const typ = state.level?.at(x, y)?.typ;
    if (typ === STONE || typ === SCORR) return 'stone';
    if (glyph?.kind === 'terrain' && glyph.terrainName) return `the ${glyph.terrainName}`;
    return 'an unknown obstacle';
}

async function chooseTarget(
    start: Position,
    describeTarget: PositionDescription | undefined,
    state: GameState,
    min: number,
    max: number,
) {
    await pline('Where do you want to hit?');
    const valid = (x: number, y: number) => validPolearmPosition(x, y, min, max, state);
    prepareMapPositionHighlights(valid);
    const firstUse = shouldShowGetposTip(state);
    if (firstUse) await showGetposTip(state);
    await showGetposInstructions(state);
    if (firstUse) await pline('Move cursor to the spot to hit:');

    return selectMapPosition({
        start,
        prompt: state._pending_message,
        goal: 'the spot to hit',
        ...(describeTarget ? { describe: describeTarget } : {}),
        isValidLocation: valid,
    });
}

export async function usePolearm(
    object: GameObject,
    { state = game, ensureWielded, describeTarget, autohit = false }: PolearmOptions = {},
): Promise<PolearmResult> {
    if (state.u?.uswallow || state.uswallow) {
        await pline("There's not enough room here to use that.");
        return { spentTime: false };
    }

    const wielded = ensureWielded
        ? await ensureWielded()
        : {
              ready: state.uwep === object || state.u.uwep === object,
              newlyWielded: false,
          };
    if (!wielded?.ready) return { spentTime: false };
    if (wielded.newlyWielded) return { spentTime: true, resume: true };

    const { min, max } = calcPoleRange(object, { state });

    // Auto-target: the sole candidate monster, else the remembered target.
    let cc = { x: state.u.ux, y: state.u.uy };
    const unique = findPoleableSpot(state, min, max);
    if (unique) cc = unique;
    else {
        const remembered = rememberedPolearmMonster(state);
        if (remembered && canSenseMonster(remembered)) {
            const distance = squaredDistance(remembered.mx, remembered.my, state);
            if (distance <= max && distance >= min) cc = { x: remembered.mx, y: remembered.my };
        }
    }

    if (!autohit) {
        const target = await chooseTarget(cc, describeTarget, state, min, max);
        if (!target) return { spentTime: false, cancelled: true };
        cc = target;
    }

    const glyph = glyphAt(cc.x, cc.y, state);
    const distance = squaredDistance(cc.x, cc.y, state);
    if (distance > max) {
        await pline('Too far!');
        return { spentTime: false, failure: true };
    }
    if (distance < min) {
        if (autohit && cc.x === state.u.ux && cc.y === state.u.uy)
            await pline("Don't know what to hit.");
        else await pline('Too close!');
        return { spentTime: false, failure: true };
    }
    if (!cansee(cc.x, cc.y) && !poleableGlyph(glyph)) {
        await pline("You won't hit anything if you can't see that spot.");
        return { spentTime: false, failure: true };
    }
    if (!couldsee(cc.x, cc.y)) {
        await pline("You can't reach that spot from here.");
        return { spentTime: false, failure: true };
    }

    rememberPolearmTarget(null, state);
    state.bhitpos = { x: cc.x, y: cc.y };
    const monster = monsterAt(cc.x, cc.y, state);
    let freehit = false;

    if (monster) {
        // C attack_checks(): a declined attack or a hidden-monster reveal
        // aborts without reaching thitmonst(). C gb.bhitpos is cc.
        const verdict = await prepareAppliedWeaponAttack(
            monster, object, { state, struckAt: cc });
        if (!verdict.proceed) return { spentTime: verdict.spentTime };
        if (await checkHeroAttackOverexertion()) return { spentTime: true };
        rememberPolearmTarget(monster, state);

        if (
            isArtifactSnickersnee(object) &&
            state.context?.snickersneeTurn === (state.moves ?? 0)
        ) {
            await pline("The blade doesn't reach there!");
            return { spentTime: false, failure: true };
        }

        // C charges check_caitiff() before recording the Snickersnee free
        // strike; the shared applied-weapon attack must not repeat it.
        await applyCaitiffPenalty(monster, state);

        if (isArtifactSnickersnee(object)) {
            const previous = state.context?.snickersneeTurn ?? -1;
            freehit = previous !== (state.moves ?? 0);
            state.context.snickersneeTurn = state.moves;
            if (freehit && !heroIsDeaf(state)) await pline('Shkinng!');
        }

        state.notonhead = cc.x !== monster.mx || cc.y !== monster.my;
        const hit = await hitMonsterWithAppliedWeapon(monster, object, {
            state,
            checkCaitiff: false,
            target: cc,
        });
        if (hit.heroDied) return hit;
    } else if (statueGlyph(glyph) && floorHasObject(STATUE, cc.x, cc.y, state)) {
        const trapAt = (state.level?.traps || []).some(
            (trap) => trap.tx === cc.x && trap.ty === cc.y && trap.ttyp === STATUE_TRAP,
        );
        // trap.c activate_statue_trap() reports success as the released
        // monster pointer; use_pole() tests only that pointer.
        const activated = trapAt ? !!(await activateStatueTrapAt(cc.x, cc.y, { state })) : false;
        if (!activated) {
            await pline('Thump!  Your blow bounces harmlessly off the statue.');
            await wakeMonstersNearWithMessages(cc.x, cc.y, 25, state);
        }
    } else {
        unmap_invisible(cc.x, cc.y);

        if (
            glyph?.kind === 'object' &&
            glyph.otyp === BOULDER &&
            floorHasObject(BOULDER, cc.x, cc.y, state)
        ) {
            await pline('Thump!  Your blow bounces harmlessly off the boulder.');
            await wakeMonstersNearWithMessages(cc.x, cc.y, 25, state);
        } else {
            const location = state.level?.at(cc.x, cc.y);
            if (!location || !ACCESSIBLE(location.typ) || IS_FURNITURE(location.typ)) {
                await pline(
                    `You uselessly attack ${obstacleDescription(glyph, cc.x, cc.y, state)}.`,
                );
            } else {
                await pline('You miss; there is no one there to hit.');
            }
        }
    }

    wipeHeroEngraving(2, state);
    return { spentTime: !freehit };
}
