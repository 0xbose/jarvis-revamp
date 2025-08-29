import React from 'react'

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="container mx-auto overflow-y-hidden">
        {children}
    </div>
  )
}

export default layout