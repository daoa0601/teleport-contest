export interface ScreenCell {
    ch: string;
    color: number;
    attr: number;
    decgfx: number;
}
export type ScreenGrid = ScreenCell[][];
export type CellDifference = 'ch' | 'attr';

/** Both grid constructors return 24 rows of 80 cells. */
export function decodeScreen(screen: string): ScreenGrid;
export function makeBlankGrid(): ScreenGrid;
export const ROWS_24: 24;
export const COLS_80: 80;
export function colorToCss(index: number | null | undefined): string;
export function renderCell(cell: ScreenCell): string;
export function diffCell(a: ScreenCell, b: ScreenCell): CellDifference | null;
