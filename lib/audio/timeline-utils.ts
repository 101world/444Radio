/**
 * Timeline Utilities - Time/position conversion and snapping
 * Handles coordinate transformations, BPM grid, and snap calculations
 */

export interface TimelineConfig {
  pixelsPerSecond: number;
  bpm?: number;
  beatsPerBar?: number;
  snapEnabled?: boolean;
  snapSubdivision?: 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';
}

/**
 * Convert time (seconds) to pixels
 */
export function timeToPx(timeSec: number, pixelsPerSecond: number): number {
  return Math.round(timeSec * pixelsPerSecond);
}

/**
 * Convert pixels to time (seconds)
 */
export function pxToTime(px: number, pixelsPerSecond: number): number {
  return px / pixelsPerSecond;
}

/**
 * Snap time to grid interval
 */
export function snapTime(time: number, snapInterval: number): number {
  if (snapInterval <= 0) return time;
  return Math.round(time / snapInterval) * snapInterval;
}

/**
 * Calculate beat duration in seconds from BPM
 */
export function beatDuration(bpm: number): number {
  return 60 / bpm;
}

/**
 * Calculate snap interval based on BPM and subdivision
 */
export function calculateSnapInterval(
  bpm: number,
  subdivision: TimelineConfig['snapSubdivision'] = 'quarter'
): number {
  const beat = beatDuration(bpm);
  
  switch (subdivision) {
    case 'whole':
      return beat * 4; // Whole note (4 beats)
    case 'half':
      return beat * 2; // Half note (2 beats)
    case 'quarter':
      return beat; // Quarter note (1 beat)
    case 'eighth':
      return beat / 2; // Eighth note
    case '16th':
      return beat / 4; // 16th note
    case '32nd':
      return beat / 8; // 32nd note
    default:
      return beat;
  }
}

/**
 * Snap time to BPM grid
 */
export function snapToBPM(
  time: number,
  bpm: number,
  subdivision: TimelineConfig['snapSubdivision'] = 'quarter'
): number {
  const interval = calculateSnapInterval(bpm, subdivision);
  return snapTime(time, interval);
}

/**
 * Get nearest beat to a given time
 */
export function getNearestBeat(time: number, bpm: number): number {
  const beat = beatDuration(bpm);
  return Math.round(time / beat) * beat;
}

/**
 * Calculate grid lines for timeline display
 * Returns array of { time, isBarLine, label }
 */
export function calculateGridLines(
  startTime: number,
  endTime: number,
  bpm: number,
  beatsPerBar: number = 4,
  pixelsPerSecond: number
): Array<{ time: number; isBarLine: boolean; isMajor: boolean; label?: string }> {
  const beat = beatDuration(bpm);
  const bar = beat * beatsPerBar;
  
  const lines: Array<{ time: number; isBarLine: boolean; isMajor: boolean; label?: string }> = [];
  
  // Start from first bar before visible window
  const startBar = Math.floor(startTime / bar);
  const endBar = Math.ceil(endTime / bar) + 1;
  
  for (let barNum = startBar; barNum <= endBar; barNum++) {
    const barTime = barNum * bar;
    
    // Add bar line (major)
    if (barTime >= startTime - bar && barTime <= endTime + bar) {
      lines.push({
        time: barTime,
        isBarLine: true,
        isMajor: true,
        label: `${barNum + 1}`
      });
      
      // Add beat lines within this bar (minor)
      for (let beatNum = 1; beatNum < beatsPerBar; beatNum++) {
        const beatTime = barTime + (beatNum * beat);
        if (beatTime >= startTime && beatTime <= endTime) {
          lines.push({
            time: beatTime,
            isBarLine: false,
            isMajor: false
          });
        }
      }
    }
  }
  
  return lines;
}

/**
 * Calculate time markers (seconds-based grid for non-BPM view)
 */
export function calculateTimeMarkers(
  startTime: number,
  endTime: number,
  pixelsPerSecond: number
): Array<{ time: number; label: string; isMajor: boolean }> {
  const markers: Array<{ time: number; label: string; isMajor: boolean }> = [];
  
  // Determine interval based on zoom level
  let interval: number;
  let majorInterval: number;
  
  if (pixelsPerSecond > 100) {
    interval = 1; // 1 second
    majorInterval = 5;
  } else if (pixelsPerSecond > 50) {
    interval = 2; // 2 seconds
    majorInterval = 10;
  } else if (pixelsPerSecond > 20) {
    interval = 5; // 5 seconds
    majorInterval = 30;
  } else {
    interval = 10; // 10 seconds
    majorInterval = 60;
  }
  
  const start = Math.floor(startTime / interval) * interval;
  const end = Math.ceil(endTime / interval) * interval;
  
  for (let t = start; t <= end; t += interval) {
    const isMajor = t % majorInterval === 0;
    markers.push({
      time: t,
      label: formatTime(t),
      isMajor
    });
  }
  
  return markers;
}

/**
 * Format time in mm:ss or hh:mm:ss format
 */
export function formatTime(seconds: number, showHours: boolean = false): string {
  const isNegative = seconds < 0;
  const abs = Math.abs(seconds);
  
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const secs = Math.floor(abs % 60);
  const ms = Math.floor((abs % 1) * 100);
  
  const sign = isNegative ? '-' : '';
  
  if (showHours || hours > 0) {
    return `${sign}${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${sign}${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Format time with milliseconds
 */
export function formatTimeDetailed(seconds: number): string {
  const isNegative = seconds < 0;
  const abs = Math.abs(seconds);
  
  const minutes = Math.floor(abs / 60);
  const secs = Math.floor(abs % 60);
  const ms = Math.floor((abs % 1) * 1000);
  
  const sign = isNegative ? '-' : '';
  return `${sign}${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Calculate visible time window from scroll position
 */
export function calculateVisibleWindow(
  scrollLeft: number,
  containerWidth: number,
  pixelsPerSecond: number
): { startTime: number; endTime: number } {
  const startTime = pxToTime(scrollLeft, pixelsPerSecond);
  const endTime = pxToTime(scrollLeft + containerWidth, pixelsPerSecond);
  
  return { startTime, endTime };
}

/**
 * Auto-zoom to fit content
 */
export function calculateFitZoom(
  contentDuration: number,
  containerWidth: number,
  padding: number = 50
): number {
  if (contentDuration <= 0) return 50; // Default
  const availableWidth = containerWidth - (padding * 2);
  return availableWidth / contentDuration;
}

/**
 * Clamp zoom to reasonable limits
 */
export function clampZoom(zoom: number, min: number = 10, max: number = 500): number {
  return Math.max(min, Math.min(max, zoom));
}

/**
 * Calculate playhead position from current time
 */
export function calculatePlayheadPosition(
  currentTime: number,
  pixelsPerSecond: number,
  offset: number = 0
): number {
  return timeToPx(currentTime, pixelsPerSecond) + offset;
}

/**
 * Detect if time is within loop region
 */
export function isInLoopRegion(
  time: number,
  loopStart: number,
  loopEnd: number
): boolean {
  return time >= loopStart && time < loopEnd;
}

/**
 * Calculate loop wrap time
 */
export function calculateLoopWrap(
  time: number,
  loopStart: number,
  loopEnd: number
): number {
  if (time < loopEnd) return time;
  const loopDuration = loopEnd - loopStart;
  if (loopDuration <= 0) return time;
  return loopStart + ((time - loopStart) % loopDuration);
}
