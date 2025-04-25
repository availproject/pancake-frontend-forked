import { ReactNode } from 'react'
import { SwapFeaturesProvider } from './SwapFeaturesContext'

function SwapLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SwapFeaturesProvider>{children}</SwapFeaturesProvider>
}

export default SwapLayout
