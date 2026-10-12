import type { CommandBinding } from './command_types.js';
import type { MapLocation } from './map_types.js';
import type { GameObject } from './object_types.js';

// The meal survives interruption. Its object may disappear or merge while
// context.victual still retains the counters for the interrupted action.
export interface PreparedFoodObject extends GameObject {
    oeaten: number;
}

export interface FoodMeal {
    key: 'eat-food';
    text?: string;
    piece: PreparedFoodObject | null;
    o_id: number;
    usedtime: number;
    reqtime: number;
    nmod: number;
    canchoke: boolean;
    fullwarn: boolean;
    eating: boolean;
    doreset: boolean;
}

export interface TinOpening {
    key: 'open-tin';
    text: string;
    object: GameObject;
    tin: GameObject | null;
    o_id: number;
    reqtime: number;
    usedtime: number;
}

export interface NonfoodMeal {
    key?: never;
    piece: GameObject | null;
    o_id: number;
    reqtime: number;
    usedtime: number;
    nmod: number;
    canchoke: boolean;
    eating: boolean;
    fullwarn?: boolean;
    doreset?: boolean;
}

export interface FoodContext {
    victual?: FoodMeal | NonfoodMeal | null;
    tin?: TinOpening | null;
    forceSaveHungerState?: boolean;
    hungerStateBeforeMeal?: number;
}

export interface CommandOccupation {
    key: 'command';
    text: string;
    binding: CommandBinding;
}

export interface DiggingOccupation {
    key: 'dig';
    text: string;
    didDigMessage: boolean;
}

export interface StudyOccupation {
    key: 'study-book';
    text: string;
}

export interface ForceLockOccupation {
    key: 'force-lock';
    text: string;
    container: GameObject;
    picktyp: boolean;
    chance: number;
    usedtime: number;
}

export interface PickLockOccupation {
    key: 'pick-lock';
    text: string;
    remaining: number;
    usedtime: number;
    container?: GameObject;
    door?: MapLocation;
    x: number;
    y: number;
    tool: GameObject;
    chance: number;
}

export interface WipeFaceOccupation {
    key: 'wipe-face';
    text: string;
    remaining: number;
}

// C svc.context.engraving plus the running occupation.  The progress fields
// belong to this engraving attempt only; a stopped attempt discards them,
// matching how native resumes no occupation after restore or interruption.
export interface EngraveOccupation {
    key: 'engrave';
    text: 'engraving';
    remainingText: string;
    nextIndex: number;
    stylus: GameObject | null;
    engraveType: number;
    x: number;
    y: number;
    actionct: number;
}

// The occupation schedules eating and supplies its label. Meal progress belongs
// to context.victual and survives when the occupation is interrupted.
export interface FoodOccupation {
    key: 'eat-food';
    text: string;
}

export interface TakeoffOccupation {
    key: 'takeoff';
    text: 'disrobing' | 'disarming';
}

export type HeroOccupation = CommandOccupation | DiggingOccupation
    | StudyOccupation | ForceLockOccupation | PickLockOccupation
    | WipeFaceOccupation | FoodOccupation | TinOpening | EngraveOccupation | TakeoffOccupation;
