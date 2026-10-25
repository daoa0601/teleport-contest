// C save.c:savemon() and restore.c:restmon(): saved pet extensions.
import type { GameMap } from './game.js';
import type { Monster, SavedMonsterTraits } from './monster_types.js';
import type { GameObject } from './object_types.js';

export function restoreLevelPetHistory(level: GameMap, elapsed: number): void {
    for (const monster of level.monsters) {
        restoreMonsterPetHistory(monster, elapsed);
        restoreObjectPetHistory(monster.minvent || monster.inventory || [], elapsed);
    }
    for (const column of level.objects)
        for (const pile of column ?? []) restoreObjectPetHistory(pile ?? [], elapsed);
    restoreObjectPetHistory(level.buriedObjects ?? [], elapsed);
}

export function restoreMonsterPetHistory(monster: Monster | SavedMonsterTraits, elapsed: number): void {
    const pet = monster.edog || monster.mextra?.edog;
    if (!pet) return;
    // Only these two pet times are saved relative to moves. Whistle time
    // remains absolute, and catch-up separately reduces tameness.
    pet.droptime += elapsed;
    pet.hungrytime += elapsed;
    if (pet.apport <= 0) pet.apport = 1;
    monster.edog = pet;
    if (monster.mextra) monster.mextra.edog = pet;
    else monster.mextra = { edog: pet };
}

export function restoreObjectPetHistory(objects: readonly GameObject[], elapsed: number): void {
    for (const object of objects) {
        if (object.oextra?.omonst) restoreMonsterPetHistory(object.oextra.omonst, elapsed);
        restoreObjectPetHistory(object.contents ?? [], elapsed);
    }
}
