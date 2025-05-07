import { ChainId, Token, TradeType } from '@pancakeswap/sdk'
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

// Helper function to check if a currency identifier matches a specific token type (USDT or USDC) on its chain
const isTokenOfType = (
  identifier: string | undefined, // User's selected currency ID in UI (symbol or address)
  selectedChainId: ChainId | undefined, // Chain of the user's selection in UI
  expectedTokenType: 'USDT' | 'USDC',
): boolean => {
  if (!identifier || selectedChainId === undefined) return false

  const tokenMap = expectedTokenType === 'USDT' ? USDT : USDC
  const targetTokenDefinition = tokenMap[selectedChainId] as Token | undefined // Type assertion if your map returns a more general type

  if (!targetTokenDefinition) return false

  const lowerIdentifier = identifier.toLowerCase()
  return (
    lowerIdentifier === targetTokenDefinition.symbol?.toLowerCase() ||
    lowerIdentifier === targetTokenDefinition.address.toLowerCase()
  )
}

export const buildSwapOrder = (
  selectedCurrencyIdInUI: string | undefined,
  selectedChainIdInUI: ChainId | undefined,
  independentField: Field,
): SwapOrder | undefined => {
  console.log('buildSwapOrder CALLED WITH:', {
    selectedCurrencyIdInUI,
    selectedChainIdInUI,
    independentField,
  })

  if (!selectedCurrencyIdInUI || selectedChainIdInUI === undefined) {
    console.warn('buildSwapOrder: Missing selectedCurrencyIdInUI or selectedChainIdInUI')
    return undefined
  }

  if (independentField === Field.INPUT) {
    const swapChainId = selectedChainIdInUI
    const usdtOnThisChain = USDT[swapChainId] as Token | undefined
    const usdcOnThisChain = USDC[swapChainId] as Token | undefined

    if (!usdtOnThisChain || !usdcOnThisChain) {
      console.warn(`buildSwapOrder: USDT or USDC not defined for Field.INPUT chain: ${swapChainId}`)
      return undefined
    }

    if (isTokenOfType(selectedCurrencyIdInUI, swapChainId, 'USDT')) {
      // User selected USDT as input on swapChainId
      return {
        inputCurrencyId: usdtOnThisChain.address,
        inputCurrencyChainId: swapChainId,
        outputCurrencyId: usdcOnThisChain.address,
        outputCurrencyChainId: swapChainId,
      }
    }
    if (isTokenOfType(selectedCurrencyIdInUI, swapChainId, 'USDC')) {
      // User selected USDC as input on swapChainId
      return {
        inputCurrencyId: usdcOnThisChain.address,
        inputCurrencyChainId: swapChainId,
        outputCurrencyId: usdtOnThisChain.address,
        outputCurrencyChainId: swapChainId,
      }
    }

    console.warn(
      `buildSwapOrder: Unmatched token for Field.INPUT scenario: ${selectedCurrencyIdInUI} on chain ${swapChainId}`,
    )
    return undefined
  }

  if (independentField === Field.OUTPUT) {
    if (selectedChainIdInUI === ChainId.ARBITRUM_ONE) {
      const swapChainId = ChainId.BASE
      const baseUsdt = USDT[ChainId.BASE] as Token
      const baseUsdc = USDC[ChainId.BASE] as Token
      if (isTokenOfType(selectedCurrencyIdInUI, swapChainId, 'USDT')) {
        return {
          inputCurrencyId: baseUsdc.address,
          inputCurrencyChainId: ChainId.BASE,
          outputCurrencyId: baseUsdt.address,
          outputCurrencyChainId: ChainId.ARBITRUM_ONE,
        }
      }
      if (isTokenOfType(selectedCurrencyIdInUI, swapChainId, 'USDC')) {
        // User selected USDC as input on swapChainId
        return {
          inputCurrencyId: baseUsdt.address,
          inputCurrencyChainId: ChainId.BASE,
          outputCurrencyId: baseUsdc.address,
          outputCurrencyChainId: ChainId.ARBITRUM_ONE,
        }
      }
    }
    if (selectedChainIdInUI === ChainId.BASE) {
      const swapChainId = ChainId.ARBITRUM_ONE
      const arbitrumUsdt = USDT[ChainId.ARBITRUM_ONE] as Token
      const arbitrumUsdc = USDC[ChainId.ARBITRUM_ONE] as Token

      console.log('match USDT', isTokenOfType(selectedCurrencyIdInUI, swapChainId, 'USDC'))

      if (isTokenOfType(selectedCurrencyIdInUI, swapChainId, 'USDT')) {
        return {
          inputCurrencyId: arbitrumUsdc.address,
          inputCurrencyChainId: ChainId.ARBITRUM_ONE,
          outputCurrencyId: arbitrumUsdt.address,
          outputCurrencyChainId: ChainId.BASE,
        }
      }
      if (isTokenOfType(selectedCurrencyIdInUI, swapChainId, 'USDC')) {
        // User selected USDC as input on swapChainId
        return {
          inputCurrencyId: arbitrumUsdt.address,
          inputCurrencyChainId: ChainId.ARBITRUM_ONE,
          outputCurrencyId: arbitrumUsdc.address,
          outputCurrencyChainId: ChainId.BASE,
        }
      }
    }

    console.warn(`buildSwapOrder: Unmatched token for Field.OUTPUT scenario: ${selectedCurrencyIdInUI}`)
    return undefined
  }

  console.warn('buildSwapOrder: Unmatched independentField type', independentField)
  return undefined
}

export function useSwapBestOrder({ maxHops }: Options = {}) {
  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()
  const inputCurrency = useCurrency(inputCurrencyId, inputCurrencyChainId)
  const outputCurrency = useCurrency(outputCurrencyId, inputCurrencyChainId)

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
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()
  const inputCurrency = useCurrency(inputCurrencyId, inputCurrencyChainId)
  const outputCurrency = useCurrency(outputCurrencyId, inputCurrencyChainId)
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
