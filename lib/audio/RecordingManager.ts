/**
 * Real-Time Recording System
 * Features: microphone input, level meters, punch-in/out, loop recording
 */

export interface RecordingConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export class RecordingManager {
  private context: AudioContext;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder | null = null;
  private analyser: AnalyserNode;
  private chunks: Blob[] = [];
  private isRecording = false;
  private isPaused = false;
  private recordingStartTime = 0;
  private punchInTime: number | null = null;
  private punchOutTime: number | null = null;

  constructor(context: AudioContext) {
    this.context = context;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
  }

  /**
   * Initialize microphone input
   */
  async initialize(config: RecordingConfig = {}): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        sampleRate: config.sampleRate,
        channelCount: config.channelCount || 1,
        echoCancellation: config.echoCancellation ?? true,
        noiseSuppression: config.noiseSuppression ?? true,
        autoGainControl: config.autoGainControl ?? true
      }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.source = this.context.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
    } catch (error) {
      throw new Error(`Failed to access microphone: ${error}`);
    }
  }

  /**
   * Start recording
   */
  startRecording(mimeType: string = 'audio/webm'): void {
    if (!this.stream) {
      throw new Error('Microphone not initialized');
    }

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType });
    
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.recorder.start(100); // Collect data every 100ms
    this.isRecording = true;
    this.recordingStartTime = Date.now();
  }

  /**
   * Stop recording and return audio blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder!.mimeType });
        this.isRecording = false;
        resolve(blob);
      };

      this.recorder.stop();
    });
  }

  /**
   * Pause/resume recording
   */
  pauseRecording(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.pause();
      this.isPaused = true;
    }
  }

  resumeRecording(): void {
    if (this.recorder && this.recorder.state === 'paused') {
      this.recorder.resume();
      this.isPaused = false;
    }
  }

  /**
   * Set punch-in/out points for recording
   */
  setPunchIn(time: number): void {
    this.punchInTime = time;
  }

  setPunchOut(time: number): void {
    this.punchOutTime = time;
  }

  /**
   * Check if currently in punch range
   */
  isInPunchRange(currentTime: number): boolean {
    if (this.punchInTime === null || this.punchOutTime === null) {
      return true; // No punch points set
    }
    return currentTime >= this.punchInTime && currentTime <= this.punchOutTime;
  }

  /**
   * Get input level (0-1)
   */
  getInputLevel(): number {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    
    return Math.sqrt(sum / dataArray.length);
  }

  /**
   * Get peak level (0-1)
   */
  getPeakLevel(): number {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    
    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = Math.abs((dataArray[i] - 128) / 128);
      peak = Math.max(peak, normalized);
    }
    
    return peak;
  }

  /**
   * Enable monitoring (hear input through speakers)
   */
  enableMonitoring(destination: AudioNode): void {
    if (this.source) {
      this.source.connect(destination);
    }
  }

  /**
   * Disable monitoring
   */
  disableMonitoring(destination: AudioNode): void {
    if (this.source) {
      this.source.disconnect(destination);
    }
  }

  /**
   * Get recording duration in seconds
   */
  getRecordingDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.recordingStartTime) / 1000;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    if (this.source) {
      this.source.disconnect();
    }
  }

  getState(): { isRecording: boolean; isPaused: boolean; duration: number } {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      duration: this.getRecordingDuration()
    };
  }
}
