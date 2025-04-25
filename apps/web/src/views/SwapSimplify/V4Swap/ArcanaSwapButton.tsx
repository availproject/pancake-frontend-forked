import { useCAFn, useSendTransaction, useUnifiedBalance, useWriteContract } from '@arcana/ca-wagmi'
import { ALLOWED_TOKENS } from '@arcana/ca-wagmi/dist/types/utils/constants'
import { Box, Loading, useToast } from '@pancakeswap/uikit'
import { CommitButton } from 'components/CommitButton'
import Decimal from 'decimal.js'
import { useCurrency, useSwapChain } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useEffect, useMemo, useState } from 'react'
import { Field } from 'state/swap/actions'
import { useDerivedSwapInfo, useSwapState } from 'state/swap/hooks'
import { useAccount } from 'wagmi'

const ArcanaSwapButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const { address } = useAccount()
  const { chainId: sourceChainId } = useActiveChainId()
  const { sendTransaction } = useSendTransaction()
  const { writeContract } = useWriteContract()
  const { loading: balanceLoading, getAssetBalance } = useUnifiedBalance()
  const { toastSuccess, toastError } = useToast()
  const { bridge } = useCAFn()
  // Get swap state
  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputCurrencyChainId },
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)

  // Get derived swap info
  const {
    parsedAmount: inputAmount,
    currencyBalances,
    currencies,
    inputError,
  } = useDerivedSwapInfo(
    independentField,
    typedValue,
    inputCurrency ?? undefined,
    outputCurrency ?? undefined,
    '', // recipient
  )

  const { chain: inputChain } = useSwapChain(inputCurrencyChainId)
  const { chain: outputChain } = useSwapChain(outputCurrencyChainId, 'output')
  const { chain: sourceChain } = useSwapChain(sourceChainId)

  // Check if user has enough balance
  const hasEnoughBalance = useMemo(() => {
    if (balanceLoading || !inputCurrency || !inputAmount) return false
    const balance = getAssetBalance(inputCurrency.symbol)?.balance
    return balance ? new Decimal(balance).gte(new Decimal(inputAmount.toExact())) : false
  }, [balanceLoading, getAssetBalance, inputCurrency, inputAmount])

  const bridgeToInputChain = async () => {
    if (!address || !inputAmount || !inputCurrency || !outputCurrency || !inputChain || !outputChain) return
    setIsLoading(true)
    try {
      const souceToInputChainTx = await bridge({
        token: inputCurrency.symbol.toLowerCase() as ALLOWED_TOKENS,
        amount: inputAmount.toExact(),
        chain: inputChain.id,
      })

      if (souceToInputChainTx) {
        const inputToOutputChainTx = await bridge({
          token: inputCurrency.symbol.toLowerCase() as ALLOWED_TOKENS,
          amount: inputAmount.toExact(),
          chain: outputChain.id,
        })
        if (inputToOutputChainTx) {
          toastSuccess(
            'Bridge Successful',
            `Assests successfully moved from ${inputChain?.name} to ${outputChain?.name} via ${sourceChain?.name}`,
          )
        }
      }
    } catch (error: any) {
      console.error('Bridge to input chain failed:', error)
      toastError('Bridge Failed', error?.message || 'Please try again')
      setIsLoading(false)
    }
  }

  // Update button text to include chain information
  const buttonText = useMemo(() => {
    if (balanceLoading) return 'Loading Balance...'
    if (!hasEnoughBalance) return 'Insufficient Balance'
    if (isLoading) return <Loading />
    if (inputError) return inputError
    if (inputChain?.id !== outputChain?.id) {
      return `Swap ${inputCurrency?.symbol || ''} (${inputChain?.name || ''}) for ${outputCurrency?.symbol || ''} (${
        outputChain?.name || ''
      })`
    }
    return `Swap ${inputCurrency?.symbol || ''} for ${outputCurrency?.symbol || ''}`
  }, [balanceLoading, hasEnoughBalance, isLoading, inputError, inputCurrency, outputCurrency, inputChain, outputChain])

  // Update disabled state to consider chain information
  const isDisabled = useMemo(
    () =>
      Boolean(
        isLoading ||
          balanceLoading ||
          !hasEnoughBalance ||
          !inputAmount ||
          !inputCurrency ||
          !outputCurrency ||
          !inputChain ||
          !outputChain ||
          inputError,
      ),
    [
      balanceLoading,
      hasEnoughBalance,
      isLoading,
      inputAmount,
      inputCurrency,
      outputCurrency,
      inputChain,
      outputChain,
      inputError,
    ],
  )

  useEffect(() => {
    const assetBalance = getAssetBalance('ETH')
    console.log('info', {
      inputChain,
      outputChain,
      inputCurrency,
      outputCurrency,
      inputAmount,
      hasEnoughBalance,
      balanceLoading,
      assetBalance,
      currencyBalances,
      currencies,
    })
  }, [inputChain, outputChain, inputCurrency, outputCurrency, inputAmount, hasEnoughBalance, isLoading])

  return (
    <Box mt="0.25rem">
      <CommitButton
        id="swap-button"
        width="100%"
        data-dd-action-name="Swap commit button"
        variant="primary"
        disabled={isDisabled}
        onClick={bridgeToInputChain}
      >
        {buttonText}
      </CommitButton>
    </Box>
  )
}

export default ArcanaSwapButton
