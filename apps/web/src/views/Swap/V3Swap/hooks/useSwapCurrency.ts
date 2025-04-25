import { ChainId } from '@pancakeswap/chains'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { useCurrency, useSwapChain } from 'hooks/Tokens'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { Chain } from 'viem/chains'

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
  Chain | undefined,
  Chain | undefined,
] => {
  const [inputCurrencyId, outputCurrencyId, inputCurrencyChainId, outputCurrencyChainId] = useSwapCurrencyIds()

  const inputCurrency = useCurrency(inputCurrencyId) as Currency
  const outputCurrency = useCurrency(outputCurrencyId) as Currency
  const { chain: inputCurrencyChain } = useSwapChain(inputCurrencyChainId)
  const { chain: outputCurrencyChain } = useSwapChain(outputCurrencyChainId)

  return [inputCurrency, outputCurrency, inputCurrencyChain, outputCurrencyChain]
}
