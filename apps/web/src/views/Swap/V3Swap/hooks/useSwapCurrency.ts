import { ChainId } from '@pancakeswap/chains'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { useCurrency } from 'hooks/Tokens'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'

export const useSwapCurrencyIds = (): [
  string | undefined,
  string | undefined,
  ChainId | undefined,
  ChainId | undefined,
] => {
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputCurrencyChainId },
  } = useSwapState()

  return [inputCurrencyId, outputCurrencyId, inputCurrencyChainId, outputCurrencyChainId]
}

export const useSwapCurrency = (): [
  Currency | undefined,
  Currency | undefined,
  ChainId | undefined,
  ChainId | undefined,
] => {
  const [inputCurrencyId, outputCurrencyId, inputCurrencyChainId, outputCurrencyChainId] = useSwapCurrencyIds()

  const inputCurrency = useCurrency(inputCurrencyId) as Currency
  const outputCurrency = useCurrency(outputCurrencyId) as Currency

  return [inputCurrency, outputCurrency, inputCurrencyChainId, outputCurrencyChainId]
}
