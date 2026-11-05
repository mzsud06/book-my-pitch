import Image from 'next/image'

interface PhotoProps {
  src?: string | null
  alt: string
  /** Shown inside the neutral placeholder when there is no photo yet. */
  emptyLabel?: string
  priority?: boolean
  sizes?: string
  className?: string
}

/**
 * One real photo per venue. With no photo we show a plain neutral
 * placeholder, never another venue's image.
 */
export function Photo({ src, alt, emptyLabel = 'Photo coming soon', priority, sizes = '(max-width: 768px) 100vw, 640px', className = '' }: PhotoProps) {
  if (!src) {
    return (
      <div className={`photo-slot photo-slot-empty ${className}`} role="img" aria-label={`${alt}: ${emptyLabel}`}>
        <span>{emptyLabel}</span>
      </div>
    )
  }
  return (
    <div className={`photo-slot ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} style={{ objectFit: 'cover' }} />
    </div>
  )
}
