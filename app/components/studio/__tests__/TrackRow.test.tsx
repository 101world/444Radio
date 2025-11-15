import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Timeline from '../Timeline';
import { vi } from 'vitest';

// Mock StudioContext module
vi.mock('@/app/contexts/StudioContext', () => ({
  useStudio: () => ({
    tracks: [
      { id: 't1', name: 'Track 1', clips: [] },
      { id: 't2', name: 'Track 2', clips: [] },
    ],
    addTrack: vi.fn(),
    addClipToTrack: vi.fn(),
    moveClipToTrack: vi.fn(),
    moveClip: vi.fn(),
    resizeClip: vi.fn(),
    splitClip: vi.fn(),
    removeClip: vi.fn(),
    zoom: 1,
    selectedTrackId: null,
    setSelectedTrack: vi.fn(),
    selectedClipId: null,
    setSelectedClip: vi.fn(),
  }),
}));

describe('TrackRow drop', () => {
  it('calculates drop position using timeline scroller scrollLeft', async () => {
    const { useStudio } = await import('@/app/contexts/StudioContext');
    const studio = useStudio();
    const moveSpy = studio.moveClipToTrack as any;

    // Render timeline
    render(<Timeline snapEnabled={false} bpm={120} activeTool={'select'} playheadLocked={false} />);

    // Find the first track clip area
    const clipArea = screen.getAllByTestId(/track-clips-area-/)[0];

    // Simulate a scroller with scrollLeft set to 200
    const scroller = document.querySelector('.studio-timeline-scroller') as HTMLElement;
    if (scroller) scroller.scrollLeft = 200;

    // Build a DragEvent with application/json payload representing a clip from t1
    const dt = new DataTransfer();
    const payload = JSON.stringify({ clipId: 'c1', trackId: 't1' });
    dt.setData('application/json', payload);

    // Fire drop event at x position 400 px relative to viewport
    const dropEvt = new DragEvent('drop', { clientX: 400, clientY: 10, bubbles: true });
    Object.defineProperty(dropEvt, 'dataTransfer', { value: dt });
    clipArea.dispatchEvent(dropEvt as any);

    // moveClipToTrack should have been called once for move between tracks (t1 -> t2)
    expect(moveSpy).toHaveBeenCalled();
    const args = moveSpy.mock.calls[0];
    // The args are (clipId, targetTrackId, startTime)
    expect(args[0]).toBe('c1');
    expect(args[1]).toBe('t2');
    // startTime should be numeric
    expect(typeof args[2]).toBe('number');
  });
});
