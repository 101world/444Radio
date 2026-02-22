// Type declarations for Strudel packages
declare module '@strudel/core' {
  export function evalScope(...imports: any[]): void
  export function repl(options: any): { evaluate: (code: string) => Promise<any> }
  export function ref(accessor: () => any): any
  export const Pattern: any
  export const s: any
  export const sound: any
  export const note: any
  export const chord: any
  export const stack: any
}

declare module '@strudel/transpiler' {
  export const transpiler: any
  export function evaluate(code: string, options?: any): Promise<any>
}

declare module '@strudel/webaudio' {
  export function getAudioContext(): AudioContext
  export function webaudioOutput(options?: any): any
  export function initAudioOnFirstClick(): Promise<void>
  export function registerSynthSounds(): Promise<void>
  export function registerZZFXSounds(): Promise<void>
  export function samples(mapOrUrl: any, baseUrl?: string, options?: any): Promise<void>
  export function aliasBank(pathOrMap: any, ...args: any[]): Promise<void>
  export function connectToDestination(node: any): void
  export const soundMap: {
    get(): Record<string, any>
    set(value: any): void
    setKey(key: string, value: any): void
    subscribe(cb: (value: any) => void): () => void
  }
}

declare module '@strudel/soundfonts' {
  export function registerSoundfonts(): Promise<void>
}

declare module '@strudel/tonal' {
  export function registerVoicings(): Promise<void>
  export const voicings: any
  export const chord: any
  export const tonal: any
}

declare module '@strudel/mini' {
  export const mini: any
  export const s: any
  export const sound: any
  export const note: any
}

declare module '@codemirror/lang-javascript' {
  export function javascript(config?: any): any
}

declare module '@codemirror/commands' {
  export const defaultKeymap: any
}
