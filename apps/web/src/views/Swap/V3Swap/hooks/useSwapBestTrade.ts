import { ChainId, TradeType } from '@pancakeswap/sdk'
import { USDC, USDT } from '@pancakeswap/tokens'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { useUserSingleHopOnly } from '@pancakeswap/utils/user'

import { useCurrency } from 'hooks/Tokens'
import { useBestAMMTrade, useBestTradeFromApi, useBestTradeFromApiShadow } from 'hooks/useBestAMMTrade'
import { usePCSXEnabledOnChain } from 'hooks/usePCSX'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import {
  useUserSplitRouteEnable,
  useUserStableSwapEnable,
  useUserV2SwapEnable,
  useUserV3SwapEnable,
} from 'state/user/smartRouter'

interface Options {
  maxHops?: number
}

interface SwapOrder {
  inputCurrencyId: string
  inputCurrencyChainId: ChainId
  outputCurrencyId: string
  outputCurrencyChainId: ChainId
}

export const buildSwapOrder = (
  inputCurrencyId: string | undefined,
  inputChainId: ChainId | undefined,
): SwapOrder | undefined => {
  // For Arbitrum chain
  if (inputChainId === ChainId.ARBITRUM_ONE) {
    // If input is USDT on Arbitrum, set output as USDC on Arbitrum
    if (inputCurrencyId === USDT[ChainId.ARBITRUM_ONE].symbol) {
      return {
        inputCurrencyId: USDT[ChainId.ARBITRUM_ONE].address,
        inputCurrencyChainId: ChainId.ARBITRUM_ONE,
        outputCurrencyId: USDC[ChainId.ARBITRUM_ONE].address,
        outputCurrencyChainId: ChainId.ARBITRUM_ONE,
      }
    }
    return {
      inputCurrencyId: USDC[ChainId.ARBITRUM_ONE].address,
      inputCurrencyChainId: ChainId.ARBITRUM_ONE,
      outputCurrencyId: USDT[ChainId.ARBITRUM_ONE].address,
      outputCurrencyChainId: ChainId.ARBITRUM_ONE,
    }
  }
  // For Base chain
  if (inputCurrencyId === USDT[ChainId.BASE].symbol) {
    return {
      inputCurrencyId: USDT[ChainId.BASE].address,
      inputCurrencyChainId: ChainId.BASE,
      outputCurrencyId: USDC[ChainId.BASE].address,
      outputCurrencyChainId: ChainId.BASE,
    }
  }
  return {
    inputCurrencyId: USDC[ChainId.BASE].address,
    inputCurrencyChainId: ChainId.BASE,
    outputCurrencyId: USDT[ChainId.BASE].address,
    outputCurrencyChainId: ChainId.BASE,
  }
}

export function useSwapBestOrder({ maxHops }: Options = {}) {
  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()
  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)
  const enabled = usePCSXEnabledOnChain(inputCurrency?.chainId)
  const isExactIn = independentField === Field.INPUT
  const independentCurrency = isExactIn ? inputCurrency : outputCurrency
  const dependentCurrency = isExactIn ? outputCurrency : inputCurrency
  const tradeType = isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT
  const amount = tryParseAmount(typedValue, independentCurrency ?? undefined)

  const [singleHopOnly] = useUserSingleHopOnly()
  const [split] = useUserSplitRouteEnable()
  const [v2Swap] = useUserV2SwapEnable()
  const [v3Swap] = useUserV3SwapEnable()
  const [stableSwap] = useUserStableSwapEnable()
  // stable swap only support exact in
  const stableSwapEnable = useMemo(() => {
    return stableSwap && isExactIn
  }, [stableSwap, isExactIn])

  const bestTradeOptions = {
    enabled,
    amount,
    currency: dependentCurrency,
    baseCurrency: independentCurrency,
    tradeType,
    maxHops: singleHopOnly ? 1 : maxHops,
    maxSplits: split ? undefined : 0,
    v2Swap,
    v3Swap,
    stableSwap: stableSwapEnable,
    trackPerf: true,
    retry: 1,
  }
  const { fetchStatus, data, isStale, error, refetch } = useBestTradeFromApi(bestTradeOptions)
  useBestTradeFromApiShadow(bestTradeOptions, 'quote-api-ori')
  useBestTradeFromApiShadow(bestTradeOptions, 'quote-api-opt')

  const [loading, setLoading] = useState(false)
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await refetch()
      return res
    } finally {
      setLoading(false)
    }
  }, [refetch])

  const isValidQuote = useMemo(
    () =>
      amount &&
      inputCurrency &&
      outputCurrency &&
      data?.trade &&
      amount.toExact() === (isExactIn ? data.trade.inputAmount.toExact() : data.trade.outputAmount.toExact()) &&
      data.trade.inputAmount.currency.equals(inputCurrency) &&
      data.trade.outputAmount.currency.equals(outputCurrency),
    [amount, data?.trade, isExactIn, inputCurrency, outputCurrency],
  )

  const isAutoRefetch = useMemo(
    () => !loading && fetchStatus === 'fetching' && isValidQuote,
    [loading, fetchStatus, isValidQuote],
  )

  return {
    enabled,
    refresh,
    isStale,
    isValidQuote,
    error,
    isLoading: useDeferredValue(
      Boolean((fetchStatus === 'fetching' && !isAutoRefetch) || (typedValue && !data && !error)),
    ),
    order: typedValue ? data : undefined,
  }
}

export function useSwapBestTrade({ maxHops }: Options = {}) {
  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()
  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)
  const isExactIn = independentField === Field.INPUT
  const independentCurrency = isExactIn ? inputCurrency : outputCurrency
  const dependentCurrency = isExactIn ? outputCurrency : inputCurrency
  const tradeType = isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT
  const amount = tryParseAmount(typedValue, independentCurrency ?? undefined)

  const [singleHopOnly] = useUserSingleHopOnly()
  const [split] = useUserSplitRouteEnable()
  const [v2Swap] = useUserV2SwapEnable()
  const [v3Swap] = useUserV3SwapEnable()
  const [stableSwap] = useUserStableSwapEnable()
  // stable swap only support exact in
  const stableSwapEnable = useMemo(() => {
    return stableSwap && isExactIn
  }, [stableSwap, isExactIn])

  const {
    isLoading,
    trade,
    refresh: refreshQuote,
    syncing,
    isStale,
    error,
  } = useBestAMMTrade({
    amount,
    currency: dependentCurrency,
    baseCurrency: independentCurrency,
    tradeType,
    maxHops: singleHopOnly ? 1 : maxHops,
    maxSplits: split ? undefined : 0,
    v2Swap,
    v3Swap,
    stableSwap: stableSwapEnable,
    type: 'auto',
    trackPerf: true,
  })
  const [loading, setLoading] = useState(false)
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await refreshQuote()
      return res
    } finally {
      setLoading(false)
    }
  }, [refreshQuote])

  const isAutoRefetch = useMemo(
    () =>
      !loading &&
      (isLoading || syncing) &&
      amount &&
      inputCurrency &&
      outputCurrency &&
      trade &&
      amount.toExact() === (isExactIn ? trade.inputAmount.toExact() : trade.outputAmount.toExact()) &&
      trade.inputAmount.currency.equals(inputCurrency) &&
      trade.outputAmount.currency.equals(outputCurrency),
    [loading, isLoading, syncing, amount, trade, isExactIn, inputCurrency, outputCurrency],
  )

  return {
    refresh,
    syncing,
    isStale,
    error,
    isLoading: useDeferredValue(
      Boolean(((isLoading || syncing) && !isAutoRefetch) || (typedValue && !trade && !error)),
    ),
    trade: typedValue ? trade : undefined,
  }
}
