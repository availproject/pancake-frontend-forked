import { useTranslation } from '@pancakeswap/localization'
import { Box, Loading, Text, useModal } from '@pancakeswap/uikit'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { CommitButton } from 'components/CommitButton'
import { useArcana } from 'contexts/ArcanaProvider'
import Decimal from 'decimal.js'
import { useCurrency, useSwapChain } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppDispatch } from 'state'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { useSwapActionHandlers } from 'state/swap/useSwapActionHandlers'
import { useAllTypeBestTrade } from 'views/Swap/V3Swap/hooks/useAllTypeBestTrade'
import { useSwapCallback } from 'views/Swap/V3Swap/hooks/useSwapCallback'
import { useAccount } from 'wagmi'
import { ArcanaConfirmBridgeModal } from './ArcanaBridgeModal'
import { ExtendedBridgingState } from './types'
import { waitForBalanceUpdate } from './utils/util'

interface ArcanaSwapButtonProps {
  order: any
  refreshOrder?: () => void
}

const ArcanaSwapButton: React.FC<ArcanaSwapButtonProps> = ({ order, refreshOrder }) => {
  const { t } = useTranslation()
  const { address } = useAccount()
  const { chainId: sourceChainId } = useActiveChainId()
  const dispatch = useAppDispatch()
  const { ca, bridgingState, setBridgingState: setBaseBridgingState, allowanceModal, intentModal } = useArcana()
  const executionBridgingState = bridgingState as ExtendedBridgingState
  const setBridgingState = setBaseBridgingState as React.Dispatch<React.SetStateAction<ExtendedBridgingState>>

  const [balanceLoading, setBalanceLoading] = useState(true)
  const [unifiedBalances, setUnifiedBalances] = useState<any[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [tradeForExecution, setTradeForExecution] = useState<any>(null)
  const [isReadyToSwap, setIsReadyToSwap] = useState(false)
  const { bestOrder } = useAllTypeBestTrade()

  const { slippageTolerance: allowedSlippage } = useAutoSlippageWithFallback()

  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputCurrencyChainId },
    typedValue,
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)
  const { chain: inputChainInUI } = useSwapChain(inputCurrencyChainId)
  const { chain: outputChainInUI } = useSwapChain(outputCurrencyChainId, 'output')
  const { chain: sourceChain } = useSwapChain(sourceChainId)

  const initialInputCurrencyAmount = useMemo(() => {
    if (order?.trade?.inputAmount) {
      return order.trade.inputAmount
    }
    if (inputCurrency && typedValue) {
      try {
        return tryParseAmount(typedValue, inputCurrency)
      } catch (error) {
        console.warn('Error parsing typed value:', error)
      }
    }
    return undefined
  }, [order?.trade?.inputAmount, inputCurrency, typedValue])

  const initialInputAmountExact = useMemo(() => initialInputCurrencyAmount?.toExact(), [initialInputCurrencyAmount])

  const initialOutputAmount = order?.trade?.outputAmount

  const { onUserInput } = useSwapActionHandlers()
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
  }, [ca, order])

  const getTotalAssetBalance = useCallback(
    (symbol?: string) => {
      if (!symbol || !unifiedBalances) return undefined
      const upperSymbol = symbol.toUpperCase()
      return unifiedBalances.find((b) => b.symbol.toUpperCase() === upperSymbol)
    },
    [unifiedBalances],
  )

  const executeBridgeAndInitiateSwapInputUpdate = useCallback(async (): Promise<boolean> => {
    if (!initialInputAmountExact || initialInputAmountExact === '0') {
      console.error('Initial input amount is missing or zero.')
      setErrorMessage(t('Please enter an amount to swap.'))
      setBridgingState('error')
      return false
    }

    if (!ca || !inputCurrency?.symbol || !inputChainInUI || !outputChainInUI || !outputCurrency || !refreshOrder) {
      console.error('Missing initial required data or connection for executeBridgeAndInitiateSwapInputUpdate')
      setErrorMessage(t('Internal error: Missing initial data or connection.'))
      setBridgingState('error')
      return false
    }

    const inputTokenSymbol = inputCurrency.symbol
    const initialInputAmountDecimal = new Decimal(initialInputAmountExact)
    const minimumExpectedBalanceDecimal = initialInputAmountDecimal.mul(0.999)

    setTxHash(null)
    setBridgingState('pending')
    setErrorMessage(null)
    setTradeForExecution(null)
    setIsReadyToSwap(false)

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
      setBridgingState('waiting_for_balance_update')
      const updatedBalanceInfo = await waitForBalanceUpdate(
        ca,
        inputTokenSymbol,
        inputChainInUI.id,
        minimumExpectedBalanceDecimal,
      )

      if (!updatedBalanceInfo || updatedBalanceInfo.balance.isZero()) {
        throw new Error(`Failed to receive sufficient ${inputTokenSymbol} on chain ${inputChainInUI.id}`)
      }

      console.log(`Balance confirmed: ${updatedBalanceInfo.balanceStr}. Proceeding to update swap input.`)
      onUserInput(Field.INPUT, updatedBalanceInfo.balanceStr)
      setBridgingState('updating_swap_input')
      setTimeout(() => {
        console.log('Moving to fetching quote state...')
        setBridgingState('fetching_quote')
        console.log('order updated', { order, bestOrder })
        setTradeForExecution(order?.trade)
      }, 2000)

      return true
    } catch (error: any) {
      console.error('Arcana operation failed during initial bridge or balance check:', error)
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
    initialInputAmountExact,
    ca,
    inputCurrency,
    outputCurrency,
    inputChainInUI,
    outputChainInUI,
    refreshOrder,
    t,
    setBridgingState,
    setErrorMessage,
    setTxHash,
  ])

  const executeSecondBridge = useCallback(async () => {
    if (!ca || !outputCurrency || !outputChainInUI) {
      console.error('Missing required dependencies for second bridge')
      return
    }

    try {
      console.log('Executing second bridge...')
      setBridgingState('bridging_out')
      setTxHash(null)

      const amountToBridge = order?.trade?.outputAmount?.toExact() ?? '0'

      const bridgeResult = await ca
        .bridge()
        .token(outputCurrency.symbol)
        .amount(amountToBridge)
        .chain(outputChainInUI.id)
        .exec()

      console.log('Second bridge completed:', bridgeResult)

      const finalMinAmountDecimal = new Decimal(amountToBridge).mul(0.998)
      await waitForBalanceUpdate(ca, outputCurrency.symbol, outputChainInUI.id, finalMinAmountDecimal)

      console.log('Second bridge process successful')
      setBridgingState('success')
    } catch (error: any) {
      console.error('Failed to execute second bridge:', error)
      setErrorMessage(error?.message ?? 'Failed to execute second bridge')
      setBridgingState('error')
    }
  }, [ca, outputCurrency, outputChainInUI, order, setBridgingState])

  useEffect(() => {
    if (bridgingState === 'bridging_out') {
      executeSecondBridge()
    }
  }, [bridgingState, executeSecondBridge])

  const handleConfirmAndExecute = useCallback(async () => {
    if (
      !ca ||
      !address ||
      !initialInputCurrencyAmount ||
      initialInputCurrencyAmount.equalTo(0) ||
      !inputCurrency?.symbol ||
      !sourceChain ||
      !inputChainInUI ||
      !outputChainInUI ||
      !outputCurrency
    ) {
      console.error('Missing required data before starting flow', {
        ca: !!ca,
        address: !!address,
        initialInputAmount: initialInputCurrencyAmount?.toExact(),
        inputCurrency: !!inputCurrency,
        sourceChain: !!sourceChain,
        inputChainInUI: !!inputChainInUI,
        outputChainInUI: !!outputChainInUI,
        outputCurrency: !!outputCurrency,
      })
      setErrorMessage(t('Missing required data. Please ensure amount, chains are selected and wallet is connected.'))
      setBridgingState('idle')
      return
    }
    setErrorMessage(null)
    await executeBridgeAndInitiateSwapInputUpdate()
  }, [
    ca,
    address,
    initialInputCurrencyAmount,
    inputCurrency,
    sourceChain,
    inputChainInUI,
    outputChainInUI,
    outputCurrency,
    t,
    executeBridgeAndInitiateSwapInputUpdate,
    setBridgingState,
    setErrorMessage,
  ])

  const hasEnoughBalance = useMemo(() => {
    if (balanceLoading || !inputCurrency?.symbol || !initialInputCurrencyAmount) return false
    const balanceInfo = getTotalAssetBalance(inputCurrency.symbol)
    const totalBalanceStr = balanceInfo?.balance
    if (!totalBalanceStr) return false
    try {
      return new Decimal(totalBalanceStr).gte(new Decimal(initialInputCurrencyAmount.toExact()))
    } catch (e) {
      console.error('Error comparing balances:', e)
      return false
    }
  }, [balanceLoading, getTotalAssetBalance, inputCurrency?.symbol, initialInputCurrencyAmount])

  const handleDismissModal = useCallback(() => {
    const interruptibleStates: ExtendedBridgingState[] = ['idle', 'success', 'error']
    if (interruptibleStates.includes(executionBridgingState) || !executionBridgingState) {
      setBridgingState('idle')
      setErrorMessage(null)
      setTxHash(null)
      setTradeForExecution(null)
      setIsReadyToSwap(false)
    } else {
      console.log('Dismissal prevented during active operation:', executionBridgingState)
    }
  }, [executionBridgingState, setBridgingState, setErrorMessage, setTxHash])

  const [onPresentConfirmModal] = useModal(
    <ArcanaConfirmBridgeModal
      onConfirm={handleConfirmAndExecute}
      onDismiss={handleDismissModal}
      inputAmount={initialInputCurrencyAmount}
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
    onPresentConfirmModal()
  }, [onPresentConfirmModal, setBridgingState, setErrorMessage, setTxHash])

  const buttonText = useMemo(() => {
    if (!ca) return t('Initializing Arcana...')
    if (balanceLoading && !unifiedBalances) return t('Loading Balance...')
    if (!initialInputCurrencyAmount || initialInputCurrencyAmount.equalTo(0)) return t('Enter an amount')

    if (!hasEnoughBalance) return t('Insufficient %symbol% Balance', { symbol: inputCurrency?.symbol ?? '...' })

    switch (executionBridgingState) {
      case 'pending':
        return t('Starting...')
      case 'bridging_in':
        return t('Bridging funds...')
      case 'waiting_for_balance_update':
        return t('Confirming bridge...')
      case 'updating_swap_input':
        return t('Preparing swap...')
      case 'fetching_quote':
        return t('Fetching latest price...')
      case 'waiting_for_swap_trigger':
        return t('Ready for Swap...')
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

    if (swapCallbackError && (executionBridgingState as ExtendedBridgingState) === 'waiting_for_swap_trigger') {
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
    initialInputCurrencyAmount,
    hasEnoughBalance,
    inputCurrency,
    outputCurrency,
    executionBridgingState,
    allowanceModal,
    intentModal,
    t,
    outputChainInUI,
    swapCallbackError,
  ])

  const isDisabled = useMemo(() => {
    const isProcessing = !['idle', 'success', 'error', 'waiting_for_swap_trigger'].includes(executionBridgingState)

    const missingCoreData =
      !ca ||
      !initialInputCurrencyAmount ||
      initialInputCurrencyAmount.equalTo(0) ||
      !inputCurrency ||
      !outputCurrency ||
      !inputChainInUI ||
      !outputChainInUI ||
      !sourceChain

    const balanceIssue = balanceLoading || !hasEnoughBalance

    const arcanaModalActive = !!(allowanceModal || intentModal)

    const swapPrepFailed = executionBridgingState === 'waiting_for_swap_trigger' && !!swapCallbackError

    return Boolean(isProcessing || missingCoreData || balanceIssue || arcanaModalActive || swapPrepFailed)
  }, [
    executionBridgingState,
    allowanceModal,
    intentModal,
    ca,
    balanceLoading,
    initialInputCurrencyAmount,
    hasEnoughBalance,
    inputCurrency,
    outputCurrency,
    inputChainInUI,
    outputChainInUI,
    sourceChain,
    swapCallbackError,
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
        {(balanceLoading && !unifiedBalances) || !ca ? <Loading /> : buttonText}
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
