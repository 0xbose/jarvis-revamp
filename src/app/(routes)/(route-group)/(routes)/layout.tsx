import React from 'react'

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="container mx-auto">
        {children}
    </div>
  )
}

export default layout