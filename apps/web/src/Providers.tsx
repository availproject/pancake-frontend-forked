import { isInBinance } from '@binance/w3w-utils'
import { LanguageProvider } from '@pancakeswap/localization'
import { DialogProvider, ModalProvider, UIKitProvider, dark, light } from '@pancakeswap/uikit'
import { Store } from '@reduxjs/toolkit'
import { HydrationBoundary, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ArcanaProvider from 'contexts/ArcanaProvider'
import { HistoryManagerProvider } from 'contexts/HistoryContext'
import { W3WConfigProvider } from 'contexts/W3WConfigContext'
import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes'
import { useMemo } from 'react'
import { Provider } from 'react-redux'
import { createW3WWagmiConfig, createWagmiConfig } from 'utils/wagmi'
import { WagmiProvider } from 'wagmi'

// Create a client
const queryClient = new QueryClient()

const StyledUIKitProvider: React.FC<React.PropsWithChildren> = ({ children, ...props }) => {
  const { resolvedTheme } = useNextTheme()
  return (
    <UIKitProvider theme={resolvedTheme === 'dark' ? dark : light} {...props}>
      {children}
    </UIKitProvider>
  )
}

const Providers: React.FC<
  React.PropsWithChildren<{
    store: Store
    children: React.ReactNode
    dehydratedState: any
  }>
> = ({ children, store, dehydratedState }) => {
  const wagmiConfig = useMemo(
    () => (typeof window !== 'undefined' && isInBinance() ? createW3WWagmiConfig() : createWagmiConfig()),
    [],
  )
  return (
    <WagmiProvider reconnectOnMount config={wagmiConfig}>
      <W3WConfigProvider value={isInBinance()}>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={dehydratedState}>
            <Provider store={store}>
              <NextThemeProvider>
                <LanguageProvider>
                  <StyledUIKitProvider>
                    <HistoryManagerProvider>
                      <ModalProvider portalProvider={DialogProvider}>
                        <ArcanaProvider>{children}</ArcanaProvider>
                      </ModalProvider>
                    </HistoryManagerProvider>
                  </StyledUIKitProvider>
                </LanguageProvider>
              </NextThemeProvider>
            </Provider>
          </HydrationBoundary>
        </QueryClientProvider>
      </W3WConfigProvider>
    </WagmiProvider>
  )
}

export default Providers
