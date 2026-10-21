import { describe, expect, it } from 'vitest';
import {
  createCall,
  idleCall,
  isCallBlocking,
  reduceCall,
  tickCall,
} from '@/engine/callMachine';

describe('call state machine', () => {
  it('starts idle', () => {
    expect(idleCall().state).toBe('idle');
    expect(isCallBlocking(idleCall())).toBe(false);
  });

  it('moves from idle to ringing on an incoming call', () => {
    const result = reduceCall(idleCall(), { type: 'RING_IN' });
    expect(result.changed).toBe(true);
    expect(result.call.state).toBe('ringing');
    expect(isCallBlocking(result.call)).toBe(true);
  });

  it('answers a ringing call', () => {
    const ringing = reduceCall(idleCall(), { type: 'RING_IN' }).call;
    const answered = reduceCall(ringing, { type: 'ANSWER' });
    expect(answered.call.state).toBe('active');
    expect(answered.outcome).toBe('answered');
  });

  it('declines a ringing call', () => {
    const ringing = reduceCall(idleCall(), { type: 'RING_IN' }).call;
    const declined = reduceCall(ringing, { type: 'DECLINE' });
    expect(declined.call.state).toBe('ended');
    expect(declined.outcome).toBe('declined');
  });

  it('turns a timeout into a missed call', () => {
    const ringing = reduceCall(idleCall(), { type: 'RING_IN' }).call;
    const missed = reduceCall(ringing, { type: 'TIMEOUT' });
    expect(missed.call.state).toBe('ended');
    expect(missed.outcome).toBe('missed');
  });

  it('rejects illegal transitions instead of throwing', () => {
    const idle = idleCall();
    expect(reduceCall(idle, { type: 'ANSWER' }).changed).toBe(false);
    expect(reduceCall(idle, { type: 'DECLINE' }).changed).toBe(false);
    const ended = reduceCall(idleCall(), { type: 'RING_IN' }).call;
    const declined = reduceCall(ended, { type: 'DECLINE' }).call;
    expect(reduceCall(declined, { type: 'ANSWER' }).changed).toBe(false);
  });

  it('dials outgoing and connects', () => {
    const dialing = reduceCall(idleCall(), { type: 'DIAL_OUT' }).call;
    expect(dialing.state).toBe('dialing');
    const active = reduceCall(dialing, { type: 'CONNECT' });
    expect(active.call.state).toBe('active');
  });

  it('ends an active call as completed', () => {
    const active = reduceCall(createCall('incoming'), { type: 'ANSWER' }).call;
    const ended = reduceCall(active, { type: 'END' });
    expect(ended.call.state).toBe('ended');
    expect(ended.outcome).toBe('completed');
  });

  it('counts the call duration only while it runs', () => {
    const ringing = reduceCall(idleCall(), { type: 'RING_IN' }).call;
    const ticked = tickCall(ringing, 5);
    expect(ticked.duration).toBe(5);
    expect(ticked.elapsedInState).toBe(5);
    const ended = reduceCall(ticked, { type: 'DECLINE' }).call;
    expect(tickCall(ended, 5).duration).toBe(5);
  });
});
