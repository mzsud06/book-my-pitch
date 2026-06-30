import React from 'react'
import type { ReactNode } from 'react'

interface ContainerProps {
  children: ReactNode
  className?: string
  as?: keyof React.JSX.IntrinsicElements
}

export function Container({ children, className = '', as: Tag = 'div' }: ContainerProps) {
  return (
    <Tag
      style={{
        maxWidth: '1180px',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: 'clamp(1.25rem, 4vw, 2rem)',
        paddingRight: 'clamp(1.25rem, 4vw, 2rem)',
      }}
      className={className}
    >
      {children}
    </Tag>
  )
}
