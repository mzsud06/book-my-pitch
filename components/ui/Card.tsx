import React from 'react'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  hover?: boolean
  className?: string
  style?: React.CSSProperties
  as?: keyof React.JSX.IntrinsicElements
}

export function Card({ children, hover = false, className = '', style, as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={`bmp-card${hover ? ' bmp-card-hover' : ''} ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}
