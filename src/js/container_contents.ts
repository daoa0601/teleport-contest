// C end.c:container_contents(), shared by final disclosure and #loot ':'.
import { isContainer } from './container.js';
import { displayMessageWindow, plineWithContinuation } from './display.js';
import { identifyObjectForDisclosure, inventoryItemDescription } from './invent.js';
import { BAG_OF_TRICKS, STATUE } from './object_data.js';
import { definiteName, objectName, observeObjectForNaming, simpleObjectName } from './objnam.js';
import { lootSortMode, sortObjects } from './object_sort.js';
import { isQuantumBox } from './quantum_cat.js';
import { showDisclosureOverlay } from './windows.js';
import type { GameObject } from './object_types.js';

export async function containerContents(
    list: readonly GameObject[], identified: boolean, allContainers: boolean, reportEmpty: boolean,
): Promise<void> {
    for (const box of list) {
        if (isContainer(box) || box.otyp === STATUE) {
            box.cknown = true;
            if (identified) box.lknown = true;
            if (box.otyp === BAG_OF_TRICKS) continue;
            if (box.contents?.length) {
                const lines = [`Contents of ${definiteName(objectName(box))}:`, ''];
                if (isQuantumBox(box)) {
                    lines.push("  Schroedinger's cat!");
                } else {
                    if (!identified)
                        for (const object of box.contents) observeObjectForNaming(object);
                    for (const object of sortObjects(box.contents, { mode: lootSortMode() })) {
                        if (identified) identifyObjectForDisclosure(object);
                        lines.push(`  ${inventoryItemDescription(object)}`);
                    }
                }
                await showDisclosureOverlay(lines, { pagerStyle: 'text', restoreUnderlay: true });
                if (allContainers)
                    await containerContents(box.contents, identified, true, reportEmpty);
            } else if (reportEmpty) {
                const name = definiteName(simpleObjectName(box));
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} is empty.`);
                await displayMessageWindow();
            }
        }
        if (!allContainers) break;
    }
}
