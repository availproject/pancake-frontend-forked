import { CAProvider } from '@arcana/ca-wagmi'
import { useEffect, useState } from 'react'

const ArcanaProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const provider = window.ethereum
    const ca = new CA()
    setIsMounted(true)
  }, [])

  if (!isMounted) return <>{children}</>

  return <CAProvider>{children}</CAProvider>
}

export default ArcanaProvider
