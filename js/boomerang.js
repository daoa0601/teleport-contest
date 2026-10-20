// C zap.c:boomhit(). Unlike bhit(), contact need not end this flight.
import { currentAttribute } from './attrib.js';
import { A_DEX, DOOR, D_CLOSED, D_LOCKED, SINK, ZAP_POS, isok, xdir, ydir } from './const.js';
import { flush_screen, lastDirtyMapCursor, newsym, plineWithContinuation, show_glyph_cell } from './display.js';
import { requirePlayingGame } from './gstate.js';
import { CmapSymbol, cmapToGlyph } from './glyph_numbers.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { monsterAtPosition } from './monster_location.js';
import { respondToImmediateMagic } from './monster_magic_response.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { snuffThrownCandle } from './thrown_object.js';
import { CLR_BROWN } from './terminal.js';
import { cansee } from './vision.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
export async function flyBoomerang(object, dx, dy, state, volley) {
    requirePlayingGame(state);
    let direction = xdir.findIndex((x, index) => x === dx && ydir[index] === dy);
    if (direction < 0 || direction >= 8)
        throw new Error(`A boomerang needs a horizontal direction, received (${dx}, ${dy}).`);
    const flight = {
        x: state.u.ux, y: state.u.uy, path: [], contact: null,
        stoppedBy: 'range', destroyed: false, migrated: false,
        caught: false, consumed: false, heroDied: false, stopVolley: false,
    };
    let hitsLeft = Math.max(1, object.spe + 1);
    let previous = null;
    let curveLeft = state.u.rightHanded;
    await flush_screen(0);
    try {
        for (let step = 0; step < 10; step++) {
            curveLeft = !curveLeft;
            const stepX = xdir[direction] ?? 0;
            const stepY = ydir[direction] ?? 0;
            const x = flight.x + stepX, y = flight.y + stepY;
            if (!isok(x, y)) {
                flight.stoppedBy = 'edge';
                break;
            }
            flight.x = x;
            flight.y = y;
            const monster = monsterAtPosition(state.level, x, y);
            if (monster) {
                const response = await respondToImmediateMagic(monster, state);
                if (response?.heroDied) {
                    flight.heroDied = true;
                    break;
                }
                if (hitsLeft-- < 0) {
                    flight.contact = monster;
                    flight.stoppedBy = 'monster';
                    break;
                }
                await snuffThrownCandle(object, state);
                const hit = await hitMonsterWithThrownObject(monster, object, {
                    state, target: { x, y }, ...(volley ? { volley } : {}),
                });
                if (hit.heroDied) {
                    flight.heroDied = true;
                    break;
                }
                if (hit.consumed) {
                    flight.consumed = true;
                    break;
                }
            }
            const location = state.level.requireAt(x, y);
            if (!ZAP_POS(location.typ) || location.typ === DOOR
                && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED))) {
                flight.x -= stepX;
                flight.y -= stepY;
                flight.stoppedBy = 'terrain';
                break;
            }
            if (x === state.u.ux && y === state.u.uy) {
                if (state.u.fumbling || propertyIsActive('fumbling', state)
                    || rn2(20) >= currentAttribute(A_DEX, state)) {
                    const damage = rollPhysicalWeaponDamageAgainstHero(object, state);
                    const hit = await hitHeroWithObject(object, state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 10 + object.spe, { state, name: 'boomerang' });
                    flight.heroDied = hit.died;
                    flight.stopVolley = true;
                    if (!hit.died && volley && volley.index < volley.count) {
                        const index = volley.index;
                        const suffix = index % 100 >= 11 && index % 100 <= 13 ? 'th'
                            : index % 10 === 1 ? 'st' : index % 10 === 2 ? 'nd'
                                : index % 10 === 3 ? 'rd' : 'th';
                        await plineWithContinuation(`You stop throwing after the ${index}${suffix} toss.`);
                    }
                }
                else {
                    if (previous)
                        newsym(previous.x, previous.y);
                    previous = null;
                    await plineWithContinuation('You skillfully catch the boomerang.');
                    flight.caught = true;
                }
                break;
            }
            flight.path.push({ x, y });
            if (previous)
                newsym(previous.x, previous.y);
            previous = cansee(x, y) ? { x, y } : null;
            if (previous)
                show_glyph_cell(x, y, curveLeft ? ')' : '(', CLR_BROWN, false, 0, {
                    kind: 'effect', glyph: cmapToGlyph(curveLeft ? CmapSymbol.boomleft : CmapSymbol.boomright),
                });
            const cursor = lastDirtyMapCursor();
            await flush_screen(1);
            if (cursor)
                state.nhDisplay?.setCursor(...cursor);
            await state.animationFrame?.();
            if (location.typ === SINK) {
                if (!heroIsDeaf(state))
                    await plineWithContinuation('Klonk!');
                await wakeMonstersNearWithMessages(x, y, 20, state);
                flight.stoppedBy = 'sink';
                break;
            }
            if (step % 5 !== 0)
                direction = (direction + (state.u.rightHanded ? 7 : 1)) % 8;
        }
    }
    finally {
        if (previous)
            newsym(previous.x, previous.y);
    }
    return flight;
}
//# sourceMappingURL=boomerang.js.map