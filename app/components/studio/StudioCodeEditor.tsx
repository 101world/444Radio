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
      <div className="flex-1 h-full flex flex-col overflow-hidden relative">
        {/* Visualization Canvas (overlays behind code) */}
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
          style={{ zIndex: 0 }}
        />

        {/* Code Editor */}
        <div ref={editorRef} className="flex-1 relative overflow-hidden" style={{ zIndex: 1 }}>
          <div className="absolute inset-0 flex overflow-auto">
            {/* Line numbers â€” clay gutter */}
            <div
              className="shrink-0 pt-3 pb-16 px-2 text-right select-none"
              style={{
                background: '#111318',
                borderRight: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[11px] leading-[1.6] font-mono h-[17.6px]" style={{ color: '#5a616b' }}>
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
              className="flex-1 resize-none bg-transparent text-[13px] leading-[1.6] font-mono outline-none p-3 pb-16 min-w-0 whitespace-pre overflow-x-auto"
              style={{
                tabSize: 2,
                fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace',
                overflowWrap: 'normal',
                wordBreak: 'keep-all',
                color: '#e8ecf0',
                caretColor: '#7fa998',
              }}
            />
          </div>
        </div>

        {/* Bottom status bar â€” clay */}
        <div
          className="h-6 shrink-0 flex items-center justify-between px-3"
          style={{
            background: '#111318',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>
            {lineCount} lines Â· {code.length} chars
          </span>
          <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>
            Strudel Live Â· .scope() .pianoroll()
          </span>
        </div>
      </div>
    )
  },
)

export default StudioCodeEditor
