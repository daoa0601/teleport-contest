// C dothrow.c:walk_path(). Ordered steps exclude the source and include the target.
export function walkPathCells(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    let cx = fromX;
    let cy = fromY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let error = 0;
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    const cells = [];
    const steps = Math.max(ax, ay);
    for (let index = 0; index < steps; index++) {
        if (ax < ay) {
            cy += sy;
            error += ax << 1;
            if (error > ay) {
                cx += sx;
                error -= ay << 1;
            }
        }
        else {
            cx += sx;
            error += ay << 1;
            if (error > ax) {
                cy += sy;
                error -= ax << 1;
            }
        }
        cells.push({ x: cx, y: cy });
    }
    return cells;
}
//# sourceMappingURL=path_walk.js.map