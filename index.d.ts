import type { Readable } from "svelte/store";

export type PathSegment = string | number;
export type Path = PathSegment[];

export interface ValidationResult {
  valid: boolean | null;
  reason?: unknown;
  path?: Path;
  error?: unknown;
  promise?: Promise<ValidationResult>;
  [key: string]: unknown;
}

export type GetFrom = (relPath: string) => unknown;
export type PredFn<T = unknown> = (value: T, getFrom?: GetFrom) => unknown;

export interface SpecmaFns {
  and: (...preds: unknown[]) => unknown;
  getMessage: (key: string) => unknown;
  getPred: (spec: unknown) => PredFn | undefined;
  getSpread: (spec: unknown) => unknown;
  isOpt: (value: unknown) => boolean;
  validatePred: (
    pred: unknown,
    value: unknown,
    getFrom?: GetFrom
  ) => ValidationResult;
}

export interface PredSpecableState<T = unknown> {
  active: boolean;
  changed: boolean;
  error: unknown;
  id: unknown;
  initialValue: T;
  promise: Promise<ValidationResult>;
  submitting: boolean;
  valid: boolean;
  validating: boolean;
  value: T;
}

export interface PredSpecableStore<T = unknown>
  extends Readable<PredSpecableState<T>> {
  id: unknown;
  isRequired: boolean;
  spec: unknown;
  activate: (bool?: boolean) => Promise<boolean>;
  reset: (newValue?: T) => void;
  set: (newValue: T, shouldActivate?: boolean) => void;
  submit: () => Promise<boolean | undefined>;
}

export interface CollError {
  path: Path;
  which?: string;
  error: unknown;
  isColl?: boolean;
  [key: string]: unknown;
}

export interface CollSpecableState<T = unknown> {
  active: boolean | null;
  changed: boolean;
  valid: boolean | null;
  validating: boolean;
  id: unknown;
  initialValue: T;
  value: T;
  error: unknown;
  errors: CollError[];
  collErrors: CollError[];
  details: Record<string, unknown>;
  submitting: boolean;
}

export type AnySpecableStore<T = unknown> =
  | PredSpecableStore<T>
  | CollSpecableStore<T>;

export type CollValue =
  | unknown[]
  | Map<unknown, unknown>
  | Record<string, unknown>
  | undefined;

export type ChildrenStores = unknown[] | Map<unknown, unknown> | Record<string, unknown>;

export interface CollSpecableStore<T = unknown>
  extends Readable<CollSpecableState<T>> {
  id: unknown;
  isRequired: boolean;
  spec: unknown;
  stores: ChildrenStores;
  activate: (bool?: boolean) => Promise<boolean>;
  add: (coll: unknown) => this;
  getChild: (path?: Path) => AnySpecableStore | null;
  getChildren: () => ChildrenStores;
  remove: (idsToRemove?: unknown[]) => this;
  reset: (newInitialValue?: T) => this;
  set: (coll: unknown, partial?: boolean, shouldActivate?: boolean) => this;
  update: (fn: (stores: ChildrenStores) => ChildrenStores) => this;
  children: Readable<ChildrenStores>;
  submit: () => Promise<boolean | undefined>;
}

export interface PredSpecableOptions<T = unknown> {
  changePred?: (a: T, b: T) => boolean;
  id?: unknown;
  required?: unknown;
  spec?: unknown;
  onSubmit?: (
    value: T,
    form: PredSpecableStore<T>
  ) => unknown | Promise<unknown>;
}

export interface CollSpecableOptions<T = unknown> {
  changePred?: unknown;
  fields?: unknown;
  getId?: unknown;
  id?: unknown;
  required?: unknown;
  spec?: unknown;
  onSubmit?: (
    value: T,
    form: CollSpecableStore<T>
  ) => unknown | Promise<unknown>;
}

export interface RegisterTransforms<T = unknown> {
  toInput?: (value: T) => string;
  toValue?: (rawValue: string) => T;
}

export type RegisterArgs<T = unknown> =
  | PredSpecableStore<T>
  | [PredSpecableStore<T>, RegisterTransforms<T>];

export interface RegisterAction {
  destroy: () => void;
  update: (newArgs: RegisterArgs | null | undefined) => void;
}

export function configure(specmaFns: SpecmaFns): void;

export function predSpecable<T = unknown>(
  initialValue: T,
  options?: PredSpecableOptions<T>,
  _extra?: Record<string, unknown>
): PredSpecableStore<T>;

export function collSpecable<T = unknown>(
  initialValue: T,
  options?: CollSpecableOptions<T>,
  _extra?: Record<string, unknown>
): CollSpecableStore<T>;

export function specable<T = unknown>(
  initialValue: T[],
  options?: CollSpecableOptions<T[]>,
  _extra?: Record<string, unknown>
): CollSpecableStore<T[]>;

export function specable<K, V>(
  initialValue: Map<K, V>,
  options?: CollSpecableOptions<Map<K, V>>,
  _extra?: Record<string, unknown>
): CollSpecableStore<Map<K, V>>;

export function specable<T extends Record<string, unknown>>(
  initialValue: T,
  options?: CollSpecableOptions<T>,
  _extra?: Record<string, unknown>
): CollSpecableStore<T>;

export function specable<T = unknown>(
  initialValue: T,
  options?: PredSpecableOptions<T>,
  _extra?: Record<string, unknown>
): PredSpecableStore<T>;

export function specable<T = unknown>(
  initialValue: T,
  options?: PredSpecableOptions<T> | CollSpecableOptions<T>,
  _extra?: Record<string, unknown>
): AnySpecableStore<T>;

export function register<T = unknown>(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  storeOrArgs?: RegisterArgs<T> | null
): RegisterAction | undefined;
