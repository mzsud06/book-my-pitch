'use client'
import { useEffect, useRef } from 'react'

// Plays the page-reveal animation only on the first load of this session.
// Subsequent navigations back to the page skip it via sessionStorage flag.
export default function PageReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sessionStorage.getItem('bmp-revealed')) return
    sessionStorage.setItem('bmp-revealed', '1')
    ref.current?.classList.add('page-reveal')
  }, [])

  return <div ref={ref}>{children}</div>
}
