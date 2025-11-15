import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Timeline from '../Timeline';
import { StudioProvider } from '@/app/contexts/StudioContext';

describe('Timeline', () => {
  it('renders playhead using CSS variable for left column width', () => {
    // Set CSS variable on document root
    document.documentElement.style.setProperty('--studio-left-column-width', '14rem');

    render(
      <StudioProvider>
        <Timeline snapEnabled={false} bpm={120} activeTool={'select'} playheadLocked={false} />
      </StudioProvider>
    );

    const playhead = screen.getByTestId('timeline-playhead');
    expect(playhead).toBeInTheDocument();
    // Ensure style.left uses CSS var calc expression
    expect(playhead.getAttribute('style') || '').toContain('calc(var(--studio-left-column-width');
  });

  it('updates computed playhead position when left column width changes', () => {
    // Set default left column width
    document.documentElement.style.setProperty('--studio-left-column-width', '14rem');

    const { rerender } = render(
      <StudioProvider>
        <Timeline snapEnabled={false} bpm={120} activeTool={'select'} playheadLocked={false} />
      </StudioProvider>
    );

    const playhead = screen.getByTestId('timeline-playhead');
    const before = window.getComputedStyle(playhead).left;
    // Change css var and re-render
    document.documentElement.style.setProperty('--studio-left-column-width', '18rem');
    rerender(
      <StudioProvider>
        <Timeline snapEnabled={false} bpm={120} activeTool={'select'} playheadLocked={false} />
      </StudioProvider>
    );
    const after = window.getComputedStyle(playhead).left;
    // Values should differ when computed
    expect(before).not.toEqual(after);
    // Ruler playhead should be aligned with timeline playhead
    const rulerPlayhead = screen.getByTestId('ruler-playhead');
    expect(window.getComputedStyle(rulerPlayhead).left).toEqual(window.getComputedStyle(playhead).left);
  });

  it('left column uses sticky CSS and responds to CSS var changes', () => {
    // Ensure the left column element receives width from CSS var and is sticky
    document.documentElement.style.setProperty('--studio-left-column-width', '14rem');

    render(
      <StudioProvider>
        <Timeline snapEnabled={false} bpm={120} activeTool={'select'} playheadLocked={false} />
      </StudioProvider>
    );

    const leftCol = document.querySelector('.studio-left-column') as HTMLElement | null;
    expect(leftCol).toBeTruthy();
    const before = window.getComputedStyle(leftCol as Element).width;

    document.documentElement.style.setProperty('--studio-left-column-width', '20rem');
    const after = window.getComputedStyle(leftCol as Element).width;
    expect(before).not.toEqual(after);
    // Ensure sticky is applied (position: sticky) in style
    expect(window.getComputedStyle(leftCol as Element).position).toBe('sticky');
  });
});

export {};
