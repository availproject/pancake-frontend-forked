import { ChainId, Currency } from '@pancakeswap/sdk'
import { USDC, USDT } from '@pancakeswap/tokens'
import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { swapReducerAtom } from 'state/swap/reducer'
import { Field, selectCurrency, setDisplayCurrency, setRecipient, switchCurrencies, typeInput } from './actions'

const CURRENCY_MAP = {
  [ChainId.LINEA]: {
    USDT: USDT[ChainId.LINEA],
    USDC: USDC[ChainId.LINEA],
  },
  [ChainId.ARBITRUM_ONE]: {
    USDT: USDT[ChainId.LINEA],
    USDC: USDC[ChainId.LINEA],
  },
  [ChainId.BASE]: {
    USDT: USDT[ChainId.LINEA],
    USDC: USDC[ChainId.LINEA],
  },
}

export function useSwapActionHandlers(activeChainId?: ChainId): {
  onCurrencySelection: (field: Field, currency?: Currency, chainId?: ChainId) => void
  onSwitchTokens: () => void
  onUserInput: (field: Field, typedValue: string) => void
  onChangeRecipient: (recipient: string | null) => void
} {
  const [, dispatch] = useAtom(swapReducerAtom)

  const onSwitchTokens = useCallback(() => {
    dispatch(switchCurrencies())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCurrencySelection = useCallback((field: Field, currency?: Currency, chainId?: ChainId) => {
    // Set the display currency
    console.log('onCurrencySelection', { field, currency, chainId })
    const associatedCurrency = CURRENCY_MAP[ChainId.LINEA]?.[currency?.symbol ?? '']
    dispatch(
      setDisplayCurrency({
        field,
        currencyId: associatedCurrency?.isToken
          ? associatedCurrency.address
          : associatedCurrency?.isNative
          ? associatedCurrency.symbol
          : '',
      }),
    )

    // Set the actual currency on the input chain
    dispatch(
      selectCurrency({
        field,
        currencyId: currency?.isToken ? currency.address : currency?.isNative ? currency.symbol : '',
        chainId: chainId ?? ChainId.ARBITRUM_ONE,
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onUserInput = useCallback((field: Field, typedValue: string) => {
    dispatch(typeInput({ field, typedValue }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChangeRecipient = useCallback((recipient: string | null) => {
    dispatch(setRecipient({ recipient }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    onSwitchTokens,
    onCurrencySelection,
    onUserInput,
    onChangeRecipient,
  }
}
