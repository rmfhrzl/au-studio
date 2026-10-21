/**
 * Explicit phone-call state machine.
 *
 * States: idle -> ringing/dialing -> active -> ended
 *
 * The reducer is pure so it can be unit tested without a DOM, and so the UI
 * never has to guess what a call is doing.
 */

export type CallState = 'idle' | 'ringing' | 'dialing' | 'active' | 'ended';

export type CallDirection = 'incoming' | 'outgoing';

export type CallOutcome =
  | 'answered'
  | 'declined'
  | 'missed'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CallAction =
  | { type: 'RING_IN' }
  | { type: 'DIAL_OUT' }
  | { type: 'ANSWER' }
  | { type: 'DECLINE' }
  | { type: 'TIMEOUT' }
  | { type: 'CONNECT' }
  | { type: 'END' }
  | { type: 'RESET' };

export interface CallSnapshot {
  state: CallState;
  direction: CallDirection;
  outcome: CallOutcome | null;
  /** Seconds spent in the current state. */
  elapsedInState: number;
  /** Total seconds the call has been running. */
  duration: number;
  muted: boolean;
  speakerOn: boolean;
}

export function createCall(direction: CallDirection): CallSnapshot {
  return {
    state: direction === 'incoming' ? 'ringing' : 'dialing',
    direction,
    outcome: null,
    elapsedInState: 0,
    duration: 0,
    muted: false,
    speakerOn: false,
  };
}

export function idleCall(): CallSnapshot {
  return {
    state: 'idle',
    direction: 'incoming',
    outcome: null,
    elapsedInState: 0,
    duration: 0,
    muted: false,
    speakerOn: false,
  };
}

/**
 * Applies an action to a call snapshot.
 * Illegal transitions are rejected and reported through `changed: false`
 * instead of throwing, so a double click cannot corrupt the machine.
 */
export function reduceCall(
  call: CallSnapshot,
  action: CallAction,
): { call: CallSnapshot; changed: boolean; outcome?: CallOutcome } {
  switch (action.type) {
    case 'RING_IN':
      if (call.state !== 'idle') return { call, changed: false };
      return {
        call: { ...createCall('incoming'), elapsedInState: call.elapsedInState },
        changed: true,
      };

    case 'DIAL_OUT':
      if (call.state !== 'idle') return { call, changed: false };
      return {
        call: { ...createCall('outgoing'), elapsedInState: call.elapsedInState },
        changed: true,
      };

    case 'ANSWER':
      if (call.state === 'active') return { call, changed: false };
      if (call.state !== 'ringing' && call.state !== 'dialing') return { call, changed: false };
      return {
        call: { ...call, state: 'active', elapsedInState: 0, outcome: 'answered' },
        changed: true,
        outcome: 'answered',
      };

    case 'CONNECT':
      if (call.state !== 'dialing') return { call, changed: false };
      return {
        call: { ...call, state: 'active', elapsedInState: 0, outcome: 'answered' },
        changed: true,
        outcome: 'answered',
      };

    case 'DECLINE':
      if (call.state !== 'ringing' && call.state !== 'dialing') return { call, changed: false };
      return {
        call: { ...call, state: 'ended', outcome: 'declined' },
        changed: true,
        outcome: 'declined',
      };

    case 'TIMEOUT':
      if (call.state !== 'ringing') return { call, changed: false };
      return {
        call: { ...call, state: 'ended', outcome: 'missed' },
        changed: true,
        outcome: 'missed',
      };

    case 'END':
      if (call.state !== 'active' && call.state !== 'ringing' && call.state !== 'dialing') {
        return { call, changed: false };
      }
      return {
        call: { ...call, state: 'ended', outcome: call.outcome === 'answered' ? 'completed' : call.outcome },
        changed: true,
        outcome: call.outcome === 'answered' ? 'completed' : call.outcome ?? 'cancelled',
      };

    case 'RESET':
      return { call: idleCall(), changed: true };

    default:
      return { call, changed: false };
  }
}

/** Advances timers inside the call snapshot. */
export function tickCall(call: CallSnapshot, dt: number): CallSnapshot {
  if (call.state === 'idle' || call.state === 'ended') return call;
  return {
    ...call,
    elapsedInState: call.elapsedInState + dt,
    duration: call.duration + dt,
  };
}

/** True while the call overlay must lock navigation. */
export function isCallBlocking(call: CallSnapshot | null): boolean {
  if (!call) return false;
  return call.state === 'ringing' || call.state === 'dialing' || call.state === 'active';
}
