// Type declarations for @wity/dial

export interface DialAttributes {
  version?: string | null;
  turn?: number | null;
  actor?: string | null;
  session?: string | null;
}

export interface DialStepNode {
  env: string;
  id?: string | null;
  label?: string | null;
  observe?: string | null;
  yield?: string[] | null;
  command: string;
}

export interface DialOption {
  value: string;
  label: string;
  default: boolean;
}

export interface DialElementNode {
  type: string;
  id?: string | null;
  observe?: string | null;
  yield?: string[] | null;
  addressedTo?: string | null;
  // dial-inform
  render?: string;
  text?: string | null;
  payload?: unknown;
  // dial-ask
  responseType?: string;
  timeout?: number | null;
  options?: DialOption[];
  // dial-execute
  steps?: DialStepNode[];
  // dial-suggest
  action?: string | null;
  // dial-declare
  contextKey?: string | null;
  // dial-acknowledge
  of?: string | null;
  // dial-phatic
  signal?: string | null;
  // dial-delegate
  to?: string | null;
  intent?: string | null;
}

export interface DialEnvelope {
  attributes: DialAttributes;
  elements: DialElementNode[];
  raw: string;
}

export interface DialExecutionResult {
  command: string;
  env: string;
  stdout: string;
  stderr: string;
  success: boolean;
  error?: string;
}

export interface RouteContext {
  session: DialSession;
  emit: (event: string) => void;
}

export type ElementHandler = (el: DialElementNode, ctx: RouteContext) => Promise<void> | void;

export class DialSession {
  constructor(opts?: { maxResults?: number });
  declare(key: string, value: unknown): void;
  getDeclared(): Record<string, unknown>;
  recordResults(results: DialExecutionResult[]): void;
  getLastResults(): DialExecutionResult[];
  clear(): void;
}

export class DialRouter {
  on(type: string, handler: ElementHandler): this;
  route(envelope: DialEnvelope, session: DialSession): Promise<void>;
}

export function runStepGraph(
  steps: DialStepNode[],
  executor: (step: DialStepNode) => Promise<DialExecutionResult>,
  initialYielded?: Set<string>
): Promise<{ results: DialExecutionResult[]; yielded: Set<string> }>;

export function parse(text: string): DialEnvelope | null;
export function extractProse(text: string): string;
