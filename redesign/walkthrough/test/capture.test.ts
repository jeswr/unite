/* eslint-disable @typescript-eslint/no-explicit-any -- the tests reach into private state */
import { describe, expect, it, vi } from 'vitest';
import { Capture } from '../lib/capture.ts';

describe('capture back-pressure', () => {
  it('never queues more than the cap for a stalled encoder', () => {
    const queued: Buffer[] = [];
    const stdin = {
      writable: true,
      destroyed: false,
      get writableLength() {
        return queued.reduce((n, b) => n + b.length, 0);
      },
      write(b: Buffer) {
        queued.push(b); // a stalled encoder: nothing is ever drained
        return false;
      },
      destroy() {
        this.destroyed = true;
      },
    };
    const saved = Capture.maxBacklogBytes;
    Capture.maxBacklogBytes = 1000;
    try {
      const cap = new Capture({} as any, 'x.mp4', { fps: 30, width: 1, height: 1, quality: 50, crf: 20 }) as any;
      cap.ffmpeg = { stdin };
      cap.last = Buffer.alloc(100);
      cap.t0 = performance.now() - 10_000; // 300 frames are due
      cap.pump();
      expect(stdin.writableLength).toBeLessThanOrEqual(1000);
      expect(stdin.destroyed).toBe(true);
      expect(() => cap.check()).toThrow(/fell more than/);
    } finally {
      Capture.maxBacklogBytes = saved;
    }
  });
});

describe('capture timeline', () => {
  // Frames used to be placed when they reached the recorder, so on a busy machine the
  // picture lagged the narration by however long frames took to arrive.
  it('places each frame at the time Chromium painted it, not when it arrived', () => {
    const written: string[] = [];
    const cap = new Capture({} as any, 'x.mp4', { fps: 10, width: 1, height: 1, quality: 50, crf: 20 }) as any;
    cap.ffmpeg = { stdin: { writable: true, writableLength: 0, write: (b: Buffer) => written.push(b.toString()) } };
    let now = 0;
    cap.now = () => now;
    cap.receive(Buffer.from('A')); // the opening picture, before start
    cap.t0 = 1;
    const wall = 1_000_000;
    const spy = vi.spyOn(Date, 'now').mockReturnValue(wall);
    try {
      now = 1.0;
      cap.receive(Buffer.from('B'), (wall - 500) / 1000); // painted at 0.5 s, arrived at 1.0 s
      now = 1.3;
      cap.pump(); // writes up to 1.0 s (0.3 s behind real time)
      expect(written.join('')).toBe('AAAAABBBBB');
      now = 2.0;
      cap.receive(Buffer.from('C'), (wall - 1500) / 1000); // painted at 0.5 s: its place is already written
      cap.pump(0);
      expect(written.join('')).toBe('AAAAABBBBB' + 'CCCCCCCCCC');
      expect(cap.latency()).toMatchObject({ frames: 2, maxMs: 1500, tooLate: 1 });
    } finally {
      spy.mockRestore();
    }
  });
});
