/**
 * AudioWorklet Processor for low-latency audio processing
 * Place in public/ directory
 */

// Guard: only execute in AudioWorklet context
if (typeof AudioWorkletProcessor === 'undefined') {
  // Silent skip - this file should only run in AudioWorklet context
} else {

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'gain':
        this.gain = data;
        break;
      case 'pan':
        this.pan = data;
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) return true;

    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        outputChannel[i] = inputChannel[i];
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);

} // End AudioWorkletProcessor guard
