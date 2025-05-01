import { CA } from '@arcana/ca-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { CurrencyAmount, Fraction, ONE, TradeType } from '@pancakeswap/sdk'
import { V4TradeWithoutGraph } from '@pancakeswap/smart-router/dist/evm/v4-router'
import { Box, Loading, Text, useModal } from '@pancakeswap/uikit'
import { CommitButton } from 'components/CommitButton'
import { useArcana } from 'contexts/ArcanaProvider'
import Decimal from 'decimal.js'
import { useCurrency, useSwapChain } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { useSwapCallback } from 'views/Swap/V3Swap/hooks/useSwapCallback'
import { isClassicOrder } from 'views/Swap/utils'
import { useAccount } from 'wagmi'
import { CommitButtonProps } from '../../Swap/V3Swap/types'
import { ArcanaConfirmBridgeModal } from './ArcanaBridgeModal'
import { ArcanaSwapButtonPropsType, ExtendedBridgingState } from './types'
import { getBalanceOnChain, retryWaitForTransaction } from './utils/util'

async function waitForBalanceUpdate(
  ca: CA,
  tokenSymbol: string,
  targetChainId: number,
  expectedMinimumAmount: Decimal,
  timeoutMs: number = 120000,
  pollIntervalMs: number = 5000,
): Promise<{ balance: Decimal; balanceStr: string } | null> {
  const startTime = Date.now()
  const initialBalanceInfo = await getBalanceOnChain(ca, tokenSymbol, targetChainId)
  console.log(
    `Polling for balance update: ${tokenSymbol} on chain ${targetChainId}. Initial: ${
      initialBalanceInfo?.balanceStr ?? 'N/A'
    }. Expecting >= ${expectedMinimumAmount.toString()}`,
  )

  while (Date.now() - startTime < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    // eslint-disable-next-line no-await-in-loop
    const currentBalanceInfo = await getBalanceOnChain(ca, tokenSymbol, targetChainId)

    if (currentBalanceInfo && currentBalanceInfo.balance.gte(expectedMinimumAmount)) {
      console.log(`Balance confirmed for ${tokenSymbol} on chain ${targetChainId}: ${currentBalanceInfo.balanceStr}`)
      return currentBalanceInfo
    }
    console.log(
      `Polling balance for ${tokenSymbol} on chain ${targetChainId}... Current: ${
        currentBalanceInfo?.balanceStr ?? 'N/A'
      }`,
    )
  }
  console.error(`Timeout waiting for balance update for ${tokenSymbol} on chain ${targetChainId}`)
  return null
}

const ArcanaSwapButton: React.FC<ArcanaSwapButtonPropsType & CommitButtonProps> = ({ order, refreshOrder }) => {
  const { t } = useTranslation()
  const { address } = useAccount()
  const { chainId: sourceChainId } = useActiveChainId()
  const { ca, bridgingState, setBridgingState: setBaseBridgingState, allowanceModal, intentModal } = useArcana()
  const executionBridgingState = bridgingState as ExtendedBridgingState
  const setBridgingState = setBaseBridgingState as React.Dispatch<React.SetStateAction<ExtendedBridgingState>>

  const [balanceLoading, setBalanceLoading] = useState(true)
  const [unifiedBalances, setUnifiedBalances] = useState<any[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const [tradeForExecution, setTradeForExecution] = useState<V4TradeWithoutGraph<TradeType> | null>(null)
  const [isReadyToSwap, setIsReadyToSwap] = useState(false)
  const [isWaitingForRefresh, setIsWaitingForRefresh] = useState(false)

  const previousOrderRef = useRef(order)
  useEffect(() => {
    previousOrderRef.current = order
  }, [order])

  const { slippageTolerance: allowedSlippage } = useAutoSlippageWithFallback()

  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputCurrencyChainId },
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)

  const initialInputAmount = order?.trade?.inputAmount
  const initialOutputAmount = order?.trade?.outputAmount

  const { chain: inputChainInUI } = useSwapChain(inputCurrencyChainId)
  const { chain: outputChainInUI } = useSwapChain(outputCurrencyChainId, 'output')
  const { chain: sourceChain } = useSwapChain(sourceChainId)

  const [deadline] = useTransactionDeadline()

  const { callback: swapCallback, error: swapCallbackError } = useSwapCallback({
    trade: tradeForExecution,
    deadline,
    permitSignature: undefined,
  })

  useEffect(() => {
    const fetchBalances = async () => {
      if (!ca) {
        setUnifiedBalances(null)
        setBalanceLoading(false)
        return
      }
      setBalanceLoading(true)
      try {
        const balances = await ca.getUnifiedBalances()
        setUnifiedBalances(balances || [])
      } catch (error) {
        console.error('Failed to fetch unified balances:', error)
        setUnifiedBalances(null)
      } finally {
        setBalanceLoading(false)
      }
    }

    fetchBalances()
  }, [ca])

  const getTotalAssetBalance = useCallback(
    (symbol?: string) => {
      if (!symbol || !unifiedBalances) return undefined
      const upperSymbol = symbol.toUpperCase()
      return unifiedBalances.find((b) => b.symbol.toUpperCase() === upperSymbol)
    },
    [unifiedBalances],
  )

  const executeBridgeAndTriggerRefresh = useCallback(async (): Promise<boolean> => {
    if (
      !ca ||
      !initialInputAmount ||
      !inputCurrency?.symbol ||
      !inputChainInUI ||
      !outputChainInUI ||
      !initialOutputAmount ||
      !outputCurrency ||
      !refreshOrder
    ) {
      console.error('Missing initial required data or refresh function for executeBridgeAndTriggerRefresh')
      setErrorMessage(t('Internal error: Missing initial data or connection.'))
      setBridgingState('error')
      return false
    }

    const inputTokenSymbol = inputCurrency.symbol
    const initialInputAmountExact = initialInputAmount.toExact()
    const initialInputAmountDecimal = new Decimal(initialInputAmountExact)

    setTxHash(null)
    setBridgingState('pending')
    setErrorMessage(null)
    setTradeForExecution(null)
    setIsReadyToSwap(false)
    setIsWaitingForRefresh(false)

    try {
      console.log(`Executing Arcana Bridge 1: ${initialInputAmountExact} ${inputTokenSymbol}...`)
      setBridgingState('bridging_in')
      const bridgeResult1 = await ca
        .bridge()
        .token(inputTokenSymbol)
        .amount(initialInputAmountExact)
        .chain(inputChainInUI.id)
        .exec()
      console.log('Arcana Bridge 1 exec() completed:', bridgeResult1)

      console.log(`Waiting for balance of ${inputTokenSymbol} on chain ${inputChainInUI.id}...`)
      const updatedBalanceInfo = await waitForBalanceUpdate(
        ca,
        inputTokenSymbol,
        inputChainInUI.id,
        initialInputAmountDecimal,
      )

      if (!updatedBalanceInfo || updatedBalanceInfo.balance.lt(initialInputAmountDecimal)) {
        throw new Error(`Failed to receive sufficient ${inputTokenSymbol} on chain ${inputChainInUI.id}`)
      }

      console.log('Triggering order refresh...')
      setBridgingState('fetching_quote')
      refreshOrder()
      setIsWaitingForRefresh(true)

      return true
    } catch (error: any) {
      console.error('Arcana operation failed during bridge or triggering refresh:', error)
      const rejectionMessage = t('Transaction rejected')
      const isUserRejection =
        error?.message?.includes('rejected') || error?.message?.includes('denied') || error?.code === 4001
      setErrorMessage(
        isUserRejection
          ? rejectionMessage
          : error?.shortMessage ?? error?.message ?? t('An unknown error occurred during the initial bridge.'),
      )
      setBridgingState('error')
      return false
    }
  }, [
    ca,
    initialInputAmount,
    inputCurrency,
    outputCurrency,
    inputChainInUI,
    outputChainInUI,
    initialOutputAmount,
    refreshOrder,
    t,
    setBridgingState,
    setErrorMessage,
    setTxHash,
  ])

  useEffect(() => {
    if (!isWaitingForRefresh) {
      return
    }
    if (order && order !== previousOrderRef.current) {
      console.log('Detected refreshed order via prop change:', order)
      if (isClassicOrder(order) && order.trade) {
        setTradeForExecution(order.trade as unknown as V4TradeWithoutGraph<TradeType>)
        setIsReadyToSwap(true)
        setBridgingState('waiting_for_swap_trigger')
        console.log('Set state to trigger swap execution.')
      } else if (!order.trade) {
        console.error('Refreshed order has no valid trade.')
        setErrorMessage(t('Could not find a valid route after refresh.'))
        setBridgingState('error')
      } else {
        console.error('Refreshed order is not a classic order, cannot proceed with swap.', order)
        setErrorMessage(t('Unsupported order type received after refresh.'))
        setBridgingState('error')
      }
      setIsWaitingForRefresh(false)
    }
  }, [order, isWaitingForRefresh, setTradeForExecution, setIsReadyToSwap, setBridgingState, setErrorMessage, t])

  useEffect(() => {
    const executeSwapAndSecondBridge = async () => {
      if (
        !isReadyToSwap ||
        !tradeForExecution ||
        !swapCallback ||
        !ca ||
        !inputChainInUI ||
        !outputChainInUI ||
        !outputCurrency
      ) {
        if (isReadyToSwap && swapCallbackError) {
          console.error('Swap callback preparation error (useEffect):', swapCallbackError)
          setErrorMessage(swapCallbackError ?? t('Swap preparation failed.'))
          setBridgingState('error')
          setIsReadyToSwap(false)
          setTradeForExecution(null)
        }
        return
      }

      const outputTokenSymbol = outputCurrency.symbol
      const slippageAdjustedAmountOut = new Fraction(ONE)
        .add(allowedSlippage)
        .invert()
        .multiply(tradeForExecution.outputAmount.quotient).quotient
      const expectedMinimumOutputAmount = CurrencyAmount.fromRawAmount(
        tradeForExecution.outputAmount.currency,
        slippageAdjustedAmountOut,
      )
      const expectedMinimumOutputAmountDecimal = new Decimal(expectedMinimumOutputAmount.toExact())

      try {
        console.log(
          `Executing PancakeSwap V3 Swap via useEffect: ${tradeForExecution.inputAmount.currency.symbol} for ${tradeForExecution.outputAmount.currency.symbol}`,
        )
        setBridgingState('swapping')
        setTxHash(null)
        const swapResult = await swapCallback()

        if (!swapResult?.hash) throw new Error('Swap transaction failed to return a hash.')
        const swapTxHash = swapResult.hash
        setTxHash(swapTxHash)
        console.log('PancakeSwap V3 Swap Submitted. Tx Hash:', swapTxHash)

        console.log(`Waiting for swap transaction confirmation: ${swapTxHash}`)
        const swapReceipt = await retryWaitForTransaction({ hash: swapTxHash, chainId: inputChainInUI.id })
        if (!swapReceipt || swapReceipt.status !== 'success')
          throw new Error(`Swap transaction failed or reverted. Hash: ${swapTxHash}`)
        console.log('PancakeSwap V3 Swap Confirmed.')

        console.log(`Fetching balance of ${outputTokenSymbol} on chain ${inputChainInUI.id} after swap...`)
        const swappedBalanceInfo = await getBalanceOnChain(ca, outputTokenSymbol, inputChainInUI.id)

        if (!swappedBalanceInfo || swappedBalanceInfo.balance.lt(expectedMinimumOutputAmountDecimal)) {
          console.warn(
            `Received ${outputTokenSymbol} balance (${
              swappedBalanceInfo?.balanceStr ?? '0'
            }) is less than minimum expected (${expectedMinimumOutputAmountDecimal.toString()}) or zero.`,
          )
          if (!swappedBalanceInfo || swappedBalanceInfo.balance.isZero())
            throw new Error(`Failed to receive any ${outputTokenSymbol} after swap.`)
        }
        console.log(`Balance of ${outputTokenSymbol} on chain ${inputChainInUI.id}: ${swappedBalanceInfo.balanceStr}`)
        const amountToBridge = swappedBalanceInfo.balanceStr

        console.log(
          `Executing Arcana Bridge 2: ${amountToBridge} ${outputTokenSymbol} from ${inputChainInUI.id} to ${outputChainInUI.id}`,
        )
        setBridgingState('bridging_out')
        setTxHash(null)
        const bridgeResult2 = await ca
          .bridge()
          .token(outputTokenSymbol)
          .amount(amountToBridge)
          .chain(outputChainInUI.id)
          .exec()
        console.log('Arcana Bridge 2 exec() completed:', bridgeResult2)

        console.log(`Waiting for final balance of ${outputTokenSymbol} on chain ${outputChainInUI.id}...`)
        await waitForBalanceUpdate(ca, outputTokenSymbol, outputChainInUI.id, new Decimal(amountToBridge).mul(0.98))

        console.log('Arcana bridge-swap-bridge process successful.')
        setBridgingState('success')
      } catch (error: any) {
        console.error('Arcana operation failed during swap or second bridge:', error)
        const rejectionMessage = t('Transaction rejected')
        const isUserRejection =
          error?.message?.includes('rejected') ||
          error?.message?.includes('denied') ||
          error?.code === 4001 ||
          error?.code === 'ACTION_REJECTED'
        setErrorMessage(
          isUserRejection
            ? rejectionMessage
            : error?.shortMessage ?? error?.message ?? t('An unknown error occurred during swap or final bridge.'),
        )
        setBridgingState('error')
      } finally {
        setIsReadyToSwap(false)
        setTradeForExecution(null)
      }
    }

    executeSwapAndSecondBridge()
  }, [
    isReadyToSwap,
    tradeForExecution,
    swapCallback,
    swapCallbackError,
    ca,
    inputChainInUI,
    outputChainInUI,
    outputCurrency,
    allowedSlippage,
    setBridgingState,
    setErrorMessage,
    setTxHash,
    t,
  ])

  const handleConfirmAndExecute = useCallback(async () => {
    if (
      !ca ||
      !address ||
      !initialInputAmount ||
      !inputCurrency?.symbol ||
      !sourceChain ||
      !inputChainInUI ||
      !outputChainInUI ||
      !initialOutputAmount ||
      !outputCurrency ||
      !isClassicOrder(order)
    ) {
      console.error('Missing required data before starting flow')
      setErrorMessage(t('Missing required data. Please ensure amount, chains are selected and wallet is connected.'))
      setBridgingState('error')
      return
    }
    setErrorMessage(null)
    setBridgingState('pending')
    await executeBridgeAndTriggerRefresh()
  }, [
    ca,
    address,
    initialInputAmount,
    inputCurrency,
    sourceChain,
    inputChainInUI,
    outputChainInUI,
    initialOutputAmount,
    outputCurrency,
    order,
    t,
    executeBridgeAndTriggerRefresh,
    setBridgingState,
    setErrorMessage,
  ])

  const hasEnoughBalance = useMemo(() => {
    if (balanceLoading || !inputCurrency?.symbol || !initialInputAmount) return false
    const balanceInfo = getTotalAssetBalance(inputCurrency.symbol)
    const totalBalance = balanceInfo?.balance
    if (!totalBalance) return false
    try {
      return new Decimal(totalBalance).gte(new Decimal(initialInputAmount.toExact()))
    } catch (e) {
      console.error('Error comparing balances:', e)
      return false
    }
  }, [balanceLoading, getTotalAssetBalance, inputCurrency?.symbol, initialInputAmount])

  const handleDismissModal = useCallback(() => {
    const interruptibleStates: ExtendedBridgingState[] = ['idle', 'success', 'error']
    if (interruptibleStates.includes(executionBridgingState) || !executionBridgingState) {
      setBridgingState('idle')
      setErrorMessage(null)
      setTxHash(null)
      setTradeForExecution(null)
      setIsReadyToSwap(false)
      setIsWaitingForRefresh(false)
    } else {
      console.log('Dismissal prevented during active operation:', executionBridgingState)
    }
  }, [executionBridgingState, setBridgingState, setErrorMessage, setTxHash])

  const [onPresentConfirmModal] = useModal(
    <ArcanaConfirmBridgeModal
      onConfirm={handleConfirmAndExecute}
      onDismiss={handleDismissModal}
      inputAmount={initialInputAmount}
      outputAmount={initialOutputAmount}
      inputCurrency={inputCurrency}
      outputCurrency={outputCurrency}
      inputChain={inputChainInUI}
      outputChain={outputChainInUI}
      sourceChain={sourceChain}
      bridgingState={executionBridgingState}
      errorMessage={errorMessage}
      txHash={txHash}
      allowanceModal={allowanceModal}
      intentModal={intentModal}
    />,
    true,
    true,
    'arcanaConfirmBridgeAndSwapModal',
  )

  const handleButtonClick = useCallback(() => {
    setBridgingState('idle')
    setErrorMessage(null)
    setTxHash(null)
    setTradeForExecution(null)
    setIsReadyToSwap(false)
    setIsWaitingForRefresh(false)
    onPresentConfirmModal()
  }, [onPresentConfirmModal, setBridgingState, setErrorMessage, setTxHash])

  const buttonText = useMemo(() => {
    if (!ca) return t('Initializing Arcana...')
    if (balanceLoading) return t('Loading Balance...')
    if (!initialInputAmount || initialInputAmount.equalTo(0)) return t('Enter an amount')
    if (!isClassicOrder(order)) return t('X Orders not supported yet')

    if (!hasEnoughBalance) return t('Insufficient %symbol% Balance', { symbol: inputCurrency?.symbol ?? '...' })

    switch (executionBridgingState) {
      case 'pending':
        return t('Starting...')
      case 'bridging_in':
        return t('Bridging funds...')
      case 'fetching_quote':
        return t('Fetching latest price...')
      case 'waiting_for_swap_trigger':
        return t('Preparing swap...')
      case 'swapping':
        return t('Executing swap...')
      case 'bridging_out':
        return t('Bridging result...')
      case 'error':
      case 'success':
      case 'idle':
        break
      default:
        if (allowanceModal || intentModal) return t('Processing...')
    }

    if (swapCallbackError && tradeForExecution && executionBridgingState !== 'error') {
      return t('Swap route error')
    }

    if (inputCurrency && outputCurrency && outputChainInUI) {
      return t('Swap %symbol% for %outputSymbol%', {
        symbol: inputCurrency.symbol,
        outputSymbol: outputCurrency.symbol,
      })
    }
    return t('Swap via Nexus')
  }, [
    ca,
    balanceLoading,
    initialInputAmount,
    order,
    hasEnoughBalance,
    inputCurrency,
    outputCurrency,
    executionBridgingState,
    allowanceModal,
    intentModal,
    t,
    outputChainInUI,
    swapCallbackError,
    tradeForExecution,
  ])

  const isDisabled = useMemo(() => {
    const isProcessing = [
      'pending',
      'bridging_in',
      'fetching_quote',
      'waiting_for_swap_trigger',
      'swapping',
      'bridging_out',
    ].includes(executionBridgingState)

    const swapPrepFailed = executionBridgingState !== 'error' && !!swapCallbackError && !!tradeForExecution

    return Boolean(
      isProcessing ||
        swapPrepFailed ||
        allowanceModal ||
        intentModal ||
        !ca ||
        balanceLoading ||
        !initialInputAmount ||
        initialInputAmount.equalTo(0) ||
        !hasEnoughBalance ||
        !inputCurrency ||
        !outputCurrency ||
        !inputChainInUI ||
        !outputChainInUI ||
        !sourceChain ||
        !isClassicOrder(order),
    )
  }, [
    executionBridgingState,
    allowanceModal,
    intentModal,
    ca,
    balanceLoading,
    initialInputAmount,
    hasEnoughBalance,
    inputCurrency,
    outputCurrency,
    inputChainInUI,
    outputChainInUI,
    sourceChain,
    order,
    swapCallbackError,
    tradeForExecution,
  ])

  return (
    <Box mt="0.25rem">
      <CommitButton
        id="arcana-swap-button"
        width="100%"
        data-dd-action-name="Arcana bridge and swap button"
        variant={!isDisabled ? 'primary' : 'secondary'}
        disabled={isDisabled}
        onClick={handleButtonClick}
      >
        {(balanceLoading || !ca) && executionBridgingState === 'idle' ? <Loading /> : buttonText}
      </CommitButton>
      {errorMessage && executionBridgingState === 'error' && (
        <Text color="failure" mt="8px" fontSize="14px" textAlign="center">
          {errorMessage}
        </Text>
      )}
    </Box>
  )
}

export default ArcanaSwapButton
