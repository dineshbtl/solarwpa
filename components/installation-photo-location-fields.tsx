"use client"

import { useEffect, useState } from "react"
import { MapPin, Loader2, Crosshair, Navigation, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { getDeviceGpsOnly } from "@/lib/geolocation"
import type { InstallationPhotoGpsSource } from "@/lib/installation-photo-gps"

export type PhotoLocationState = {
  latitude?: number
  longitude?: number
  gpsAccuracyMeters?: number
  gpsSource?: InstallationPhotoGpsSource
}

type Props = {
  value: PhotoLocationState
  onChange: (next: PhotoLocationState) => void
  disabled?: boolean
}

const sourceLabel: Record<InstallationPhotoGpsSource, string> = {
  exif: "From photo (EXIF)",
  device: "Device GPS",
  manual: "Manual",
}

export function InstallationPhotoLocationFields({ value, onChange, disabled }: Props) {
  const [latInput, setLatInput] = useState("")
  const [lngInput, setLngInput] = useState("")
  const [loadingGps, setLoadingGps] = useState(false)

  useEffect(() => {
    setLatInput(value.latitude != null && Number.isFinite(value.latitude) ? String(value.latitude) : "")
    setLngInput(value.longitude != null && Number.isFinite(value.longitude) ? String(value.longitude) : "")
  }, [value.latitude, value.longitude])

  const applyParsedManual = () => {
    const lat = parseFloat(latInput.trim())
    const lng = parseFloat(lngInput.trim())
    const hasLat = latInput.trim() !== ""
    const hasLng = lngInput.trim() !== ""
    if (!hasLat && !hasLng) {
      onChange({
        latitude: undefined,
        longitude: undefined,
        gpsAccuracyMeters: undefined,
        gpsSource: undefined,
      })
      return
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
    onChange({
      latitude: lat,
      longitude: lng,
      gpsAccuracyMeters: undefined,
      gpsSource: "manual",
    })
  }

  const clearLocation = () => {
    setLatInput("")
    setLngInput("")
    onChange({
      latitude: undefined,
      longitude: undefined,
      gpsAccuracyMeters: undefined,
      gpsSource: undefined,
    })
  }

  const captureDeviceGps = async () => {
    setLoadingGps(true)
    try {
      const pos = await getDeviceGpsOnly()
      if (!pos) {
        toast({
          title: "Could not get GPS",
          description: "Allow location access (HTTPS) or enter coordinates manually.",
          variant: "destructive",
        })
        return
      }
      const next: PhotoLocationState = {
        latitude: pos.lat,
        longitude: pos.lng,
        gpsAccuracyMeters: pos.accuracyMeters,
        gpsSource: "device",
      }
      onChange(next)
    } finally {
      setLoadingGps(false)
    }
  }

  const hasCoords =
    value.latitude != null &&
    value.longitude != null &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  const statusLabel = hasCoords ? "Connected" : "Not Connected"
  const statusClasses = hasCoords
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700"

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <Navigation className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">GPS Location Status</p>
            <p className="truncate text-sm text-muted-foreground">
              {hasCoords
                ? `Lat: ${value.latitude?.toFixed(6)}, Lng: ${value.longitude?.toFixed(6)}`
                : "Location not captured yet"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {value.gpsSource ? sourceLabel[value.gpsSource] : "Use device GPS or enter coordinates manually"}
              {hasCoords && value.gpsAccuracyMeters != null && value.gpsSource === "device"
                ? ` • Accuracy ~${value.gpsAccuracyMeters} m`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses}`}>{statusLabel}</span>
          <Button type="button" variant="ghost" size="icon" disabled={disabled || loadingGps} onClick={captureDeviceGps}>
            {loadingGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-solar"
          disabled={disabled || loadingGps}
          onClick={captureDeviceGps}
        >
          {loadingGps ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
          Use device GPS
        </Button>
        {hasCoords && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clearLocation}>
            Clear
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Latitude</Label>
          <Input
            className="mt-1 border-solar bg-background font-mono text-sm"
            value={latInput}
            disabled={disabled}
            placeholder="e.g. 12.9716"
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={applyParsedManual}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Longitude</Label>
          <Input
            className="mt-1 border-solar bg-background font-mono text-sm"
            value={lngInput}
            disabled={disabled}
            placeholder="e.g. 77.5946"
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={applyParsedManual}
          />
        </div>
      </div>
      {hasCoords && (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`https://www.google.com/maps?q=${encodeURIComponent(String(value.latitude))},${encodeURIComponent(String(value.longitude))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-medium text-solar-dark underline-offset-2 hover:underline"
          >
            Open in Google Maps
          </a>
          <div className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <MapPin className="h-3.5 w-3.5" />
            Location captured
          </div>
        </div>
      )}
    </div>
  )
}
