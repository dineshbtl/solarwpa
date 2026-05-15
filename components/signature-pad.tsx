"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  className?: string
  height?: number
}

export function SignaturePad({ onSave, className, height = 160 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasSignature, setHasSignature] = useState(false)

  const getPoint = (e: PointerEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY }
    }
    return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY }
  }

  const startDraw = useCallback((e: PointerEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawingRef.current = true
    lastPointRef.current = getPoint(e, canvas)
  }, [])

  const draw = useCallback((e: PointerEvent) => {
    e.preventDefault()
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const point = getPoint(e, canvas)
    const last = lastPointRef.current
    if (last) {
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(point.x, point.y)
      ctx.strokeStyle = "#1a1a1a"
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()
      setHasSignature(true)
    }
    lastPointRef.current = point
  }, [])

  const stopDraw = useCallback(() => {
    isDrawingRef.current = false
    lastPointRef.current = null
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return
    onSave(canvas.toDataURL("image/png"))
  }, [hasSignature, onSave])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onSave("")
  }, [onSave])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio || 600
    canvas.height = height * window.devicePixelRatio || 160
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
  }, [height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener("pointerdown", startDraw)
    canvas.addEventListener("pointermove", draw)
    canvas.addEventListener("pointerup", stopDraw)
    canvas.addEventListener("pointercancel", stopDraw)
    return () => {
      canvas.removeEventListener("pointerdown", startDraw)
      canvas.removeEventListener("pointermove", draw)
      canvas.removeEventListener("pointerup", stopDraw)
      canvas.removeEventListener("pointercancel", stopDraw)
    }
  }, [startDraw, draw, stopDraw])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative rounded-lg border-2 border-dashed border-solar bg-white">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height, display: "block" }}
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Sign here (touch or mouse)
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Clear Signature
        </Button>
        {hasSignature && (
          <span className="text-xs text-green-600 font-medium">Signature captured</span>
        )}
      </div>
    </div>
  )
}
