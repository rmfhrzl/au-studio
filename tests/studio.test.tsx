// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from '@/App';

beforeAll(() => {
  // React Flow measures its container with ResizeObserver, which jsdom lacks.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
});

afterEach(cleanup);

describe('studio smoke test', () => {
  it('boots the studio and lists the demo story', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('Sinyal Terakhir').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Buat cerita baru').length).toBeGreaterThan(0);
  });

  it('opens the visual editor without crashing', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('Sinyal Terakhir').length).toBeGreaterThan(0);
    });
    const editButtons = screen.getAllByText('Edit');
    editButtons[0].click();
    await waitFor(() => {
      expect(screen.getAllByText('Validasi').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Properti').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Node (27)').length).toBeGreaterThan(0);
  });
});
