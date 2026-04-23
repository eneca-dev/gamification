'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Palette } from 'lucide-react'

const COLORS = [
  { label: 'Зелёный (начисления)', value: '#16a34a' },
  { label: 'Красный (списания)', value: '#E53935' },
  { label: 'Оранжевый (акцент)', value: '#F57C00' },
  { label: 'Синий (нейтральный)', value: '#1565C0' },
  { label: 'Серый (второстепенный)', value: '#757575' },
]

interface SelectionToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
  onChange: (value: string) => void
}

interface ToolbarPos { x: number; y: number }

export function SelectionToolbar({ textareaRef, content, onChange }: SelectionToolbarProps) {
  const [pos, setPos] = useState<ToolbarPos | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const toolbarRef = useRef<HTMLDivElement | null>(null)

  // слушаем mouseup на document — ловит отпускание мыши вне textarea
  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return

      setTimeout(() => {
        const ta = textareaRef.current
        if (!ta) return
        // показываем плашку только если textarea активна (пользователь работает в ней)
        if (document.activeElement !== ta) return
        const { selectionStart, selectionEnd } = ta
        if (selectionStart === selectionEnd) {
          setPos(null)
          setShowPalette(false)
          return
        }
        setPos({ x: e.clientX, y: e.clientY })
      }, 10)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [textareaRef])

  // клавиатурное выделение
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return

    function handleKeyUp(e: KeyboardEvent) {
      const { selectionStart, selectionEnd } = ta!
      if (selectionStart === selectionEnd) {
        setPos(null)
        setShowPalette(false)
      } else {
        // позиционируем в центре над textarea
        const rect = ta!.getBoundingClientRect()
        setPos({ x: rect.left + rect.width / 2, y: rect.top })
      }
    }

    ta.addEventListener('keyup', handleKeyUp)
    return () => ta.removeEventListener('keyup', handleKeyUp)
  }, [textareaRef])

  // скрывать при клике вне тулбара и вне textarea
  useEffect(() => {
    if (!pos) return

    function handleMouseDown(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return
      if (textareaRef.current?.contains(e.target as Node)) return
      setPos(null)
      setShowPalette(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [pos, textareaRef])

  // расширяет границы выделения чтобы не разрезать {{key}}
  function expandToFullVariables(s: number, e: number): [number, number] {
    const pattern = /\{\{\w+\}\}/g
    let match
    let ns = s
    let ne = e
    while ((match = pattern.exec(content)) !== null) {
      const ms = match.index
      const me = match.index + match[0].length
      if (ns > ms && ns < me) ns = ms
      if (ne > ms && ne < me) ne = me
    }
    return [ns, ne]
  }

  function wrapSelection(before: string, after: string) {
    const ta = textareaRef.current
    if (!ta) return
    const [start, end] = expandToFullVariables(ta.selectionStart, ta.selectionEnd)
    if (start === end) return
    const selected = content.slice(start, end)
    onChange(content.slice(0, start) + before + selected + after + content.slice(end))
    setPos(null)
    setShowPalette(false)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, end + before.length)
    })
  }

  function stripFormatting() {
    const ta = textareaRef.current
    if (!ta) return
    const [start, end] = expandToFullVariables(ta.selectionStart, ta.selectionEnd)
    if (start === end) return
    const stripped = content
      .slice(start, end)
      .replace(/<span[^>]*>/gi, '')
      .replace(/<\/span>/gi, '')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    onChange(content.slice(0, start) + stripped + content.slice(end))
    setPos(null)
    setShowPalette(false)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start, start + stripped.length)
    })
  }

  function getStyle(x: number, y: number): React.CSSProperties {
    const W = showPalette ? 260 : 90
    const H = 38
    const vw = window.innerWidth
    const left = Math.min(Math.max(8, x - W / 2), vw - W - 8)
    const top = y - H - 10
    return {
      position: 'fixed',
      top: top < 8 ? y + 20 : top,
      left,
      zIndex: 9999,
      width: W,
    }
  }

  if (!pos) return null

  return createPortal(
    <div
      ref={toolbarRef}
      className="flex items-center gap-0.5 rounded-xl px-1.5 py-1"
      style={{
        ...getStyle(pos.x, pos.y),
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Жирный */}
      <button
        type="button"
        onClick={() => wrapSelection('**', '**')}
        title="Жирный"
        className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <Bold size={13} strokeWidth={2.5} />
      </button>

      <div className="w-px h-4 mx-0.5 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Кнопка палитры */}
      <button
        type="button"
        onClick={() => setShowPalette(!showPalette)}
        title="Цвет текста"
        className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
        style={{ color: showPalette ? 'var(--apex-primary)' : 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <Palette size={13} />
      </button>

      {showPalette && (
        <>
          <div className="w-px h-4 mx-0.5 shrink-0" style={{ background: 'var(--border)' }} />
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => wrapSelection(`<span style="color:${c.value}">`, '</span>')}
              title={c.label}
              className="w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110"
              style={{ background: c.value, border: '2px solid var(--border)' }}
            />
          ))}
          <div className="w-px h-4 mx-0.5 shrink-0" style={{ background: 'var(--border)' }} />
          <button
            type="button"
            onClick={stripFormatting}
            title="Убрать форматирование"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            ✕
          </button>
        </>
      )}
    </div>,
    document.body
  )
}
