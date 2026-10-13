import type { CommandDefinition } from './command_data.js';
import type { GameObject } from './object_types.js';
import type { TerminalCell } from './terminal.js';
import type { InventoryAction } from './invent.js';

export type NativeCommand = CommandDefinition;

// The selected action retains its command even when it has no one-byte key.
export interface CommandBinding {
    key: number | null;
    command: NativeCommand | null;
    parameter: string | null;
}

export type CannedCommand =
    | { kind: 'rub' | 'apply' | 'wield'; invlet: string }
    | { kind: 'swap-weapon' }
    | { kind: 'inventory-action'; action: InventoryAction }
    | { kind: 'fire'; shotLimit: number };

export type DirectionalRunMode = 0 | 1 | 2 | 3;

export interface DirectionalRunState {
    mode: DirectionalRunMode;
    dx: number;
    dy: number;
    lastStrTurn: number;
}

export interface TravelRunState {
    mode: 8;
    targetX: number;
    targetY: number;
    lastStrTurn: number;
}

export type RunState = DirectionalRunState | TravelRunState;

export interface DelayedArmorAction {
    kind: 'wear' | 'remove';
    object: GameObject;
    remainingGlobalTurns: number;
    ready: boolean;
    finishMessage: string;
    _runmodeRetainedTopline?: TerminalCell[] | undefined;
}

export interface CommandInput {
    key: number;
    count: number;
}
