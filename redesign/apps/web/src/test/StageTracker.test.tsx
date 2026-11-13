import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageTracker } from '../ui/StageTracker';

describe('StageTracker', () => {
  it('lists ten stages and expands the current one with its checklist', () => {
    render(
      <StageTracker
        stage="listening"
        checklist={{
          stage: 'listening',
          next: 'picture',
          clear: false,
          items: [
            { key: 'enough_people', text: 'At least 40 people have finished their conversation', met: true, detail: '41 of 40' },
            { key: 'group_young', text: 'Under 25: at least half of the 10 hoped for have been heard', met: false },
          ],
        }}
      />,
    );
    const items = screen.getAllByRole('listitem').filter((li) => li.parentElement?.getAttribute('aria-label') === 'Stages of this assembly');
    expect(items).toHaveLength(10);
    const now = items.find((li) => li.getAttribute('aria-current') === 'step')!;
    expect(now.textContent).toMatch(/Listening/);
    expect(within(now).getByText('To move on to picture:')).toBeTruthy();
    expect(within(now).getByText(/At least 40 people/).textContent).toMatch(/done/);
    expect(within(now).getByText(/Under 25/).textContent).toMatch(/not yet/);
    expect(items[0]!.textContent).toMatch(/Proposed \(done\)/);
    expect(items[9]!.textContent).toMatch(/Review \(later\)/);
  });

  it('shows no checklist when none is given', () => {
    render(<StageTracker stage="review" />);
    expect(screen.queryByText(/To move on/)).toBeNull();
  });
});
