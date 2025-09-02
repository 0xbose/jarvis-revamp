"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import Image from "next/image"

type ImageOption = {
  id: string
  src: string
  label?: string
}

export type ImageQuickSelectProps = {
  options: ImageOption[]
  value?: string
  onChange: (src: string) => void
  className?: string
  showUrlInput?: boolean
  label?: string
}

export function ImageQuickSelect({
  options,
  value,
  onChange,
  className,
  showUrlInput = true,
  label = "Quick images",
}: ImageQuickSelectProps) {
  const [url, setUrl] = React.useState(value ?? "")

  React.useEffect(() => {
    setUrl(value ?? "")
  }, [value])

  const isSelected = (src: string) => value === src

  const handlePick = (src: string) => {
    const selectedUrl = src.trim()
    setUrl(selectedUrl)
    onChange(selectedUrl)
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.trim()
    setUrl(e.target.value) // Keep the input value as-is for typing
    onChange(next) // Pass trimmed value to parent
  }

  const handleUrlBlur = () => {
    // Trim the URL when user finishes typing
    const trimmedUrl = url.trim()
    setUrl(trimmedUrl)
    onChange(trimmedUrl)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div role="listbox" aria-label="Select an image" className="grid grid-cols-6 gap-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={isSelected(opt.src)}
              tabIndex={0}
              onClick={() => handlePick(opt.src)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handlePick(opt.src)
                }
              }}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-md ring-1 ring-border transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected(opt.src) ? "ring-2 ring-primary" : "hover:ring-foreground/30",
                "bg-background",
              )}
            >
              <img
                src={opt.src || "/placeholder.svg"}
                alt={opt.label ? `Select ${opt.label}` : "Select image"}
                className="h-full w-full object-cover"
                style={{ background: "#18181b" }}
                draggable={false}
              />
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition",
                  isSelected(opt.src) ? "bg-black/30" : "group-hover:bg-black/10",
                )}
              >
                {isSelected(opt.src) && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-6 w-6 text-primary-foreground"
                    fill="currentColor"
                  >
                    <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {showUrlInput && (
        <div className="space-y-2">
          <Label htmlFor="custom-image-url" className="text-sm font-medium">
            Image URL
          </Label>
          <Input
            id="custom-image-url"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={url}
            onChange={handleUrlChange}
            onBlur={handleUrlBlur}
            className={cn(
              "w-full rounded-md bg-background px-3 py-2 text-sm",
              "ring-1 ring-input focus:outline-none focus:ring-2 focus:ring-ring",
            )}
            aria-describedby="custom-image-help"
          />
          <p id="custom-image-help" className="text-xs text-muted-foreground">
            Pick a thumbnail above or paste any image URL.
          </p>

          {url && (
            <div className="mt-1 flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-md ring-1 ring-border bg-background">
                <img
                  src={url || "/placeholder.svg"}
                  alt="Selected image preview"
                  className="h-full w-full object-cover"
                  crossOrigin="anonymous"
                  style={{ background: "#18181b" }}
                  draggable={false}
                />
              </div>
              {/* <div className="flex-1 min-w-0">
                <code className="line-clamp-1 break-all text-xs text-muted-foreground">{url}</code>
                {options.some((opt) => opt.src === url) && (
                  <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Predefined image selected
                  </div>
                )}
              </div> */}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ImageQuickSelect
