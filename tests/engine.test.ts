import { describe, expect, it } from 'vitest';
import { StoryEngine } from '@/engine/engine';
import { demoProject } from '@/data/demoStory';
import { storyProjectSchema } from '@/engine/schema';
import { validateProject } from '@/engine/validate';

/** Ticks the engine until a predicate is true (or the budget runs out). */
function advanceUntil(
  engine: StoryEngine,
  predicate: () => boolean,
  maxSeconds = 60,
  step = 0.1,
): boolean {
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    if (predicate()) return true;
    engine.tick(step);
    elapsed += step;
  }
  return predicate();
}

describe('demo story data', () => {
  it('matches the schema', () => {
    expect(storyProjectSchema.safeParse(demoProject).success).toBe(true);
  });

  it('has no validation errors', () => {
    const errors = validateProject(demoProject).filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('contains at least three characters and four endings', () => {
    expect(demoProject.characters.length).toBeGreaterThanOrEqual(3);
    expect(demoProject.endings.length).toBeGreaterThanOrEqual(4);
  });

  it('contains a phone call, social posts, notes and e-mail', () => {
    expect(demoProject.calls.length).toBeGreaterThan(0);
    expect(demoProject.socialPosts.length).toBeGreaterThan(0);
    expect(demoProject.notes.length).toBeGreaterThan(0);
    expect(demoProject.emails.length).toBeGreaterThan(0);
  });
});

describe('story engine', () => {
  it('starts at the configured start node', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    expect(engine.snapshot().status).toBe('playing');
    expect(engine.snapshot().nodeId).toBe('start');
  });

  it('delivers dialogue lines after the configured delays', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.chatMessages('chat-bagas').length > 17);
    const messages = engine.chatMessages('chat-bagas');
    // 17 static history messages + the first dialogue line.
    expect(messages.length).toBeGreaterThanOrEqual(18);
    expect(messages[messages.length - 1].text).toBe('kamu masih di kampus?');
  });

  it('shows a typing indicator before the message lands', () => {
    const engine = new StoryEngine(demoProject);
    const typingEvents: string[] = [];
    engine.subscribe((event) => {
      if (event.type === 'typing') typingEvents.push(event.chatId);
    });
    engine.start();
    advanceUntil(engine, () => typingEvents.length > 0, 10);
    expect(typingEvents.length).toBeGreaterThan(0);
  });

  it('applies variable effects when a choice is made and follows the graph', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    expect(engine.snapshot().nodeId).toBe('b1-pilihan');

    const before = engine.snapshot().variables;
    const ok = engine.choose('o-b1-datang');
    expect(ok).toBe(true);
    const after = engine.snapshot().variables;
    expect(after.kejujuran).toBe((before.kejujuran as number) + 1);
    expect(after.kepercayaan).toBe((before.kepercayaan as number) + 1);
    expect(engine.snapshot().nodeId).toBe('b1-setelah-datang');
  });

  it('records the player reply as a chat message', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    engine.choose('o-b1-datang');
    const messages = engine.chatMessages('chat-bagas');
    const last = messages[messages.length - 1];
    expect(last.author).toBe('naya');
    expect(last.text).toContain('salah gue');
  });

  it('rejects a choice that is not available', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    expect(engine.choose('o-b1-datang')).toBe(false);
  });

  it('matches free text to an option and ignores unknown text', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');

    expect(engine.sendFreeText('gue cek sekarang. kalau emang hilang, salah gue yang gantiin.')).toBe(
      'matched',
    );
    expect(engine.snapshot().nodeId).toBe('b1-setelah-datang');

    const engine2 = new StoryEngine(demoProject);
    engine2.start();
    advanceUntil(engine2, () => engine2.snapshot().nodeId === 'b1-pilihan');
    expect(engine2.sendFreeText('halo, apa kabar?')).toBe('free');
    // A free reply must not change the story path.
    expect(engine2.snapshot().nodeId).toBe('b1-pilihan');
    expect(engine2.snapshot().freeReplies).toHaveLength(1);
  });

  it('matches free text through keywords', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    expect(engine.sendFreeText('file jam 2 pagi terus hilang? siapa yang nyimpen salinan?')).toBe(
      'matched',
    );
    expect(engine.snapshot().nodeId).toBe('b1-setelah-curiga');
  });

  it('fires scheduled messages at their story time', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    const before = engine.chatMessages('chat-dimas').length;
    advanceUntil(engine, () => engine.chatMessages('chat-dimas').length > before, 80);
    expect(engine.chatMessages('chat-dimas').length).toBe(before + 1);
    expect(engine.chatMessages('chat-dimas')[engine.chatMessages('chat-dimas').length - 1].text).toContain(
      'Kuota',
    );
  });
});

describe('ending routing', () => {
  function playToEnd(optionIds: string[], answerCall = true): StoryEngine {
    const engine = new StoryEngine(demoProject);
    engine.start();
    for (const optionId of optionIds) {
      const reached = advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan'
        || engine.snapshot().nodeId === 'b2-pilihan'
        || engine.snapshot().nodeId === 'b3-pilihan');
      expect(reached).toBe(true);
      engine.choose(optionId);
    }
    const ringing = advanceUntil(engine, () => Boolean(engine.snapshot().call), 90);
    expect(ringing).toBe(true);
    if (answerCall) {
      engine.answerCall();
      advanceUntil(engine, () => (engine.snapshot().call?.captionIndex ?? -1) >= 0, 10);
      engine.endCall();
    } else {
      engine.declineCall();
    }
    advanceUntil(engine, () => engine.snapshot().status === 'ended', 30);
    return engine;
  }

  it('reaches the secret ending with an honest player who answers the call', () => {
    const engine = playToEnd(['o-b1-datang', 'o-b2-jujur', 'o-b3-dengar']);
    expect(engine.snapshot().status).toBe('ended');
    expect(engine.snapshot().endingId).toBe('ending-rahasia');
  });

  it('reaches the happy ending when honest but the call is declined', () => {
    const engine = playToEnd(['o-b1-datang', 'o-b2-jujur', 'o-b3-dengar'], false);
    expect(engine.snapshot().endingId).toBe('ending-bersama');
  });

  it('reaches the neutral ending for a careful player', () => {
    const engine = playToEnd(['o-b1-diam', 'o-b2-diam', 'o-b3-tunda']);
    expect(engine.snapshot().endingId).toBe('ending-archive');
  });

  it('reaches the failure ending when the story is mishandled', () => {
    const engine = playToEnd(['o-b1-diam', 'o-b2-balas', 'o-b3-tutup']);
    expect(engine.snapshot().endingId).toBe('ending-gugur');
  });

  it('reaches the sad ending when the player is careless and ambitious', () => {
    const engine = playToEnd(['o-b1-curiga', 'o-b2-balas', 'o-b3-tutup']);
    expect(engine.snapshot().endingId).toBe('ending-sendiri');
  });

  it('marks the story as ended and remembers the ending', () => {
    const engine = playToEnd(['o-b1-datang', 'o-b2-jujur', 'o-b3-dengar']);
    const snapshot = engine.snapshot();
    expect(snapshot.status).toBe('ended');
    expect(snapshot.endingId).toBe('ending-rahasia');
    expect(snapshot.choices).toHaveLength(3);
  });
});

describe('phone call state machine', () => {
  it('rings, answers and ends a call', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    engine.choose('o-b1-datang');
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b2-pilihan');
    engine.choose('o-b2-jujur');
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b3-pilihan');
    engine.choose('o-b3-dengar');

    const ringing = advanceUntil(engine, () => Boolean(engine.snapshot().call), 90);
    expect(ringing).toBe(true);
    expect(engine.snapshot().call?.snapshot.state).toBe('ringing');

    engine.answerCall();
    expect(engine.snapshot().call?.snapshot.state).toBe('active');

    advanceUntil(engine, () => (engine.snapshot().call?.captions.length ?? 0) >= 2, 20);
    expect((engine.snapshot().call?.captions.length ?? 0)).toBeGreaterThanOrEqual(2);

    engine.endCall();
    expect(engine.snapshot().call).toBeNull();
    expect(engine.snapshot().nodeId).toBe('call-diterima');
  });

  it('routes a declined call to its own node', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    engine.choose('o-b1-datang');
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b2-pilihan');
    engine.choose('o-b2-jujur');
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b3-pilihan');
    engine.choose('o-b3-dengar');
    advanceUntil(engine, () => Boolean(engine.snapshot().call), 90);

    engine.declineCall();
    expect(engine.snapshot().call).toBeNull();
    expect(engine.snapshot().nodeId).toBe('call-ditolak');
  });

  it('turns an unanswered call into a missed call after the timeout', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    engine.choose('o-b1-datang');
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b2-pilihan');
    engine.choose('o-b2-jujur');
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b3-pilihan');
    engine.choose('o-b3-dengar');
    advanceUntil(engine, () => Boolean(engine.snapshot().call), 90);

    advanceUntil(engine, () => engine.snapshot().nodeId === 'call-terlewat', 45);
    expect(engine.snapshot().nodeId).toBe('call-terlewat');
    expect(engine.snapshot().flags.missedCall).toBe(true);
  });
});

describe('progress persistence', () => {
  it('serialises and restores the play state', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    engine.choose('o-b1-datang');
    const progress = engine.serialize();

    const restored = StoryEngine.restore(demoProject, progress);
    expect(restored.snapshot().nodeId).toBe(engine.snapshot().nodeId);
    expect(restored.snapshot().variables).toEqual(engine.snapshot().variables);
    expect(restored.snapshot().choices).toHaveLength(1);
    expect(restored.chatMessages('chat-bagas').length).toBe(engine.chatMessages('chat-bagas').length);
  });

  it('keeps the choice history after a restore', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    engine.choose('o-b1-curiga');
    const restored = StoryEngine.restore(demoProject, engine.serialize());
    expect(restored.snapshot().choices[0].optionId).toBe('o-b1-curiga');
    expect(restored.snapshot().variables.ambisi).toBe(1);
  });

  it('restarts back to the beginning', () => {
    const engine = new StoryEngine(demoProject);
    engine.start();
    advanceUntil(engine, () => engine.snapshot().nodeId === 'b1-pilihan');
    engine.choose('o-b1-datang');
    engine.restart();
    expect(engine.snapshot().nodeId).toBe('start');
    expect(engine.snapshot().choices).toHaveLength(0);
    expect(engine.snapshot().variables.kejujuran).toBe(1);
  });
});
