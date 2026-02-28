'use client'

import { useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react'

export interface StudioCodeEditorHandle {
  insertAtCursor: (snippet: string) => void
  getTextarea: () => HTMLTextAreaElement | null
}

interface StudioCodeEditorProps {
  code: string
  onChange: (code: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  editorRef: React.RefObject<HTMLDivElement | null>
}

const StudioCodeEditor = forwardRef<StudioCodeEditorHandle, StudioCodeEditorProps>(
  function StudioCodeEditor({ code, onChange, onKeyDown, canvasRef, editorRef }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const lineCount = useMemo(() => code.split('\n').length, [code])

    const insertAtCursor = useCallback(
      (snippet: string) => {
        const ta = textareaRef.current
        if (!ta) return
        const s = ta.selectionStart
        const next = code.substring(0, s) + snippet + code.substring(s)
        onChange(next)
        setTimeout(() => {
          ta.focus()
          ta.selectionStart = ta.selectionEnd = s + snippet.length
        }, 0)
      },
      [code, onChange],
    )

    useImperativeHandle(ref, () => ({
      insertAtCursor,
      getTextarea: () => textareaRef.current,
    }))

    return (
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Visualization Canvas (overlays behind code) */}
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full pointer-events-none opacity-70"
          style={{ zIndex: 0 }}
        />

        {/* Code Editor */}
        <div ref={editorRef} className="flex-1 relative overflow-hidden" style={{ zIndex: 1 }}>
          <div className="absolute inset-0 flex overflow-auto">
            {/* Line numbers */}
            <div className="shrink-0 pt-3 pb-16 px-2 text-right select-none bg-[#0a0a0e]/80">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[11px] leading-[1.6] font-mono text-white/10 h-[17.6px]">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              className="flex-1 resize-none bg-transparent text-[13px] leading-[1.6] font-mono text-cyan-100 caret-cyan-400 outline-none p-3 pb-16 min-w-0 whitespace-pre"
              style={{
                tabSize: 2,
                fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace',
                textShadow: '0 0 20px rgba(34,211,238,0.08)',
              }}
            />
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="h-6 shrink-0 flex items-center justify-between px-3 border-t border-white/[0.06] bg-[#0c0c10]">
          <span className="text-[8px] text-white/15 font-mono">
            {lineCount} lines · {code.length} chars
          </span>
          <span className="text-[8px] text-white/15 font-mono">
            Strudel Live Coding · ._scope() ._pianoroll() .punchcard() for inline visuals
          </span>
        </div>
      </div>
    )
  },
)

export default StudioCodeEditor
