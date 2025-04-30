import { useCAFn, useUnifiedBalance } from '@arcana/ca-wagmi'
import { ALLOWED_TOKENS } from '@arcana/ca-wagmi/dist/types/utils/constants'
import { useTranslation } from '@pancakeswap/localization'
import { PriceOrder } from '@pancakeswap/price-api-sdk'
import { Box, Loading, useModal } from '@pancakeswap/uikit'
import { CommitButton } from 'components/CommitButton'
import Decimal from 'decimal.js'
import { useCurrency, useSwapChain } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useCallback, useMemo, useState } from 'react'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { useAccount, useSwitchChain } from 'wagmi'
import { CommitButtonProps } from '../../Swap/V3Swap/types'
import { ArcanaBridgingState, ArcanaConfirmBridgeModal } from './ArcanaBridgeModal'

interface ArcanaSwapButtonPropsType {
  order?: PriceOrder
}

const ArcanaSwapButton: React.FC<ArcanaSwapButtonPropsType & CommitButtonProps> = ({ order }) => {
  const { t } = useTranslation()
  const { address } = useAccount()
  const { chainId: sourceChainId } = useActiveChainId()
  const { loading: balanceLoading, getAssetBalance } = useUnifiedBalance()
  const { bridge } = useCAFn()
  const { switchChainAsync } = useSwitchChain()

  const [bridgingState, setBridgingState] = useState<ArcanaBridgingState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputCurrencyChainId },
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)

  const inputAmount = order?.trade?.inputAmount
  const outputAmount = order?.trade?.outputAmount

  const { chain: inputChainInUI } = useSwapChain(inputCurrencyChainId)
  const { chain: outputChainInUI } = useSwapChain(outputCurrencyChainId, 'output')
  const { chain: sourceChain } = useSwapChain(sourceChainId)

  const hasEnoughBalance = useMemo(() => {
    if (balanceLoading || !inputCurrency?.symbol || !inputAmount) return false
    const balance = getAssetBalance(inputCurrency.symbol)?.balance
    return balance ? new Decimal(balance).gte(new Decimal(inputAmount.toExact())) : false
  }, [balanceLoading, getAssetBalance, inputCurrency?.symbol, inputAmount])

  const handleConfirmBridge = useCallback(async () => {
    if (
      !address ||
      !inputAmount ||
      !inputCurrency?.symbol ||
      !sourceChain ||
      !inputChainInUI ||
      !outputChainInUI ||
      !outputAmount ||
      !outputCurrency
    ) {
      console.error('Missing required data for bridging', {
        address,
        inputAmount,
        outputAmount,
        inputChainInUI,
        inputCurrency,
        sourceChain,
        outputChainInUI,
      })
      setErrorMessage(t('Missing required data. Please ensure amount and chains are selected.'))
      setBridgingState('error')
      return
    }

    // setBridgingState('checking_chains')
    // setErrorMessage(null)
    // let switchedChain = false

    // try {
    //   if (inputChainInUI.id !== sourceChainId) {
    //     console.log(`Attempting to add/switch wallet chain: ${inputChainInUI.id}`)
    //     await switchChainAsync({ chainId: inputChainInUI.id })
    //     switchedChain = true
    //   }
    //   if (outputChainInUI.id !== sourceChainId && outputChainInUI.id !== inputChainInUI.id) {
    //     console.log(`Attempting to add/switch wallet chain: ${outputChainInUI.id}`)
    //     await switchChainAsync({ chainId: outputChainInUI.id })
    //     switchedChain = true
    //   }

    //   if (switchedChain) {
    //     console.log(`Switching wallet back to source chain: ${sourceChainId}`)
    //     await switchChainAsync({ chainId: sourceChainId })
    //   }
    // } catch (error: any) {
    //   console.error('Failed to add or switch chain:', error)
    //   try {
    //     console.log(`Attempting to switch wallet back to source chain after error: ${sourceChainId}`)
    //     await switchChainAsync({ chainId: sourceChainId })
    //   } catch (switchBackError: any) {
    //     console.error('Failed to switch back to source chain after error:', switchBackError)
    //     setErrorMessage(t('Failed to ensure correct chain in wallet. Please check wallet connection and try again.'))
    //     setBridgingState('error')
    //     return
    //   }

    //   setErrorMessage(error?.shortMessage ?? t('Failed to add chain to wallet. Please try again.'))
    //   setBridgingState('error')
    //   return
    // }

    const tokenSymbolLower = inputCurrency.symbol as ALLOWED_TOKENS
    const amountExact = inputAmount.toExact()

    setBridgingState('pending')
    setTxHash(null)

    try {
      console.log(
        `Starting Arcana bridge: ${amountExact} ${tokenSymbolLower} from Source Chain (${sourceChain.name} - ID: ${sourceChainId}) to Target Chain ID ${inputChainInUI?.id} (${outputChainInUI.name})`,
      )
      let bridgeTx: any
      console.log('data for bridge', {
        address,
        inputAmount,
        outputAmount,
        inputChainInUI,
        inputCurrency,
        sourceChain,
        outputChainInUI,
      })
      try {
        bridgeTx = await bridge({
          token: 'USDT',
          amount: amountExact,
          chain: inputChainInUI.id,
        })
      } catch (error: any) {
        console.error('Arcana Bridge (Source -> Input) failed:', error)
        setErrorMessage(error?.message ?? t('An unknown error occurred during the first bridge step.'))
        setBridgingState('error')
        return
      }

      console.log('Arcana Bridge Tx Response (Source -> Input):', bridgeTx)
      if (bridgeTx) {
        console.log('Bridge transaction 1 successful, moved funds from Source chain to Input Chain')

        const outputTokenSymbolLower = outputCurrency.symbol.toLowerCase() as ALLOWED_TOKENS
        const secondBridgeAmount = amountExact

        const outputBridgeTx = await bridge({
          token: 'ETH',
          amount: secondBridgeAmount,
          chain: outputChainInUI.id,
        })

        console.log('Arcana Bridge Tx Response (Input -> Output):', outputBridgeTx)
        console.log('Bridge transaction 2 successful, moved funds from Input Chain to Output Chain')
        if (typeof outputBridgeTx === 'object' && outputBridgeTx !== null && 'hash' in outputBridgeTx) {
          setTxHash(outputBridgeTx.hash as string)
        } else if (typeof outputBridgeTx === 'string') {
          setTxHash(outputBridgeTx)
        }
        setBridgingState('success')
      } else {
        setErrorMessage(t('First bridge step failed or returned no confirmation.'))
        setBridgingState('error')
      }
    } catch (error: any) {
      console.error('Arcana Bridge process failed:', error)
      if (!errorMessage) {
        setErrorMessage(error?.message ?? t('An unknown error occurred during bridging.'))
      }
      if (bridgingState !== 'error') {
        setBridgingState('error')
      }
    }
  }, [
    address,
    inputAmount,
    inputCurrency?.symbol,
    sourceChain,
    inputChainInUI,
    outputChainInUI,
    outputAmount,
    outputCurrency,
    bridge,
    t,
    sourceChainId,
    switchChainAsync,
    errorMessage,
    bridgingState,
  ])

  const handleDismiss = useCallback(() => {
    if (bridgingState !== 'pending') {
      setBridgingState('idle')
      setErrorMessage(null)
      setTxHash(null)
    }
  }, [bridgingState])

  const [onPresentConfirmModal] = useModal(
    <ArcanaConfirmBridgeModal
      onConfirm={handleConfirmBridge}
      onDismiss={handleDismiss}
      inputAmount={inputAmount}
      outputAmount={outputAmount}
      inputCurrency={inputCurrency}
      outputCurrency={outputCurrency}
      inputChain={inputChainInUI}
      outputChain={outputChainInUI}
      sourceChain={sourceChain}
      bridgingState={bridgingState}
      errorMessage={errorMessage}
      txHash={txHash}
    />,
    true,
    true,
    'arcanaConfirmBridgeModal',
  )

  const handleBridgeClick = useCallback(() => {
    setBridgingState('idle')
    setErrorMessage(null)
    setTxHash(null)
    onPresentConfirmModal()
  }, [onPresentConfirmModal])

  const buttonText = useMemo(() => {
    if (balanceLoading) return t('Loading Balance...')
    if (!inputAmount) return t('Enter an amount')
    if (!hasEnoughBalance) return t('Insufficient Balance')
    if (inputCurrency && outputChainInUI) {
      return t('Swap %symbol% for %outputSymbol%', {
        symbol: inputCurrency.symbol,
        outputSymbol: outputCurrency?.symbol,
      })
    }
    return t('Bridge Assets')
  }, [balanceLoading, hasEnoughBalance, inputCurrency, outputChainInUI, t])

  const isDisabled = useMemo(
    () =>
      Boolean(
        bridgingState === 'pending' ||
          balanceLoading ||
          !hasEnoughBalance ||
          !inputAmount ||
          !inputCurrency ||
          !outputChainInUI ||
          !sourceChain,
      ),
    [balanceLoading, hasEnoughBalance, bridgingState, inputAmount, inputCurrency, outputChainInUI, sourceChain],
  )

  return (
    <Box mt="0.25rem">
      <CommitButton
        id="arcana-bridge-button"
        width="100%"
        data-dd-action-name="Arcana bridge button"
        variant="primary"
        disabled={isDisabled}
        onClick={handleBridgeClick}
      >
        {balanceLoading ? <Loading /> : buttonText}
      </CommitButton>
    </Box>
  )
}

export default ArcanaSwapButton
