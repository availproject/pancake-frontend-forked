import { useTranslation } from '@pancakeswap/localization'
import { ChainId, Currency, CurrencyAmount, Percent } from '@pancakeswap/sdk'
import { Text } from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import replaceBrowserHistoryMultiple from '@pancakeswap/utils/replaceBrowserHistoryMultiple'
import { ReactNode, useCallback, useMemo } from 'react'

import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { CommonBasesType } from 'components/SearchModal/types'
import { useCurrency, useSwapChain } from 'hooks/Tokens'
import { Field } from 'state/swap/actions'
import { useDefaultsFromURLSearch, useSwapState } from 'state/swap/hooks'
import { useSwapActionHandlers } from 'state/swap/useSwapActionHandlers'
import { useCurrencyBalances } from 'state/wallet/hooks'
import { currencyId } from 'utils/currencyId'
import { maxAmountSpend } from 'utils/maxAmountSpend'

import { useAccount } from 'wagmi'
import useWarningImport from '../../Swap/hooks/useWarningImport'
import { useIsWrapping } from '../../Swap/V3Swap/hooks'
import { AssignRecipientButton, FlipButton } from './FlipButton'
import { FormContainer } from './FormContainer'
import { Recipient } from './Recipient'

interface Props {
  inputAmount?: CurrencyAmount<Currency>
  outputAmount?: CurrencyAmount<Currency>
  tradeLoading?: boolean
  pricingAndSlippage?: ReactNode
  swapCommitButton?: ReactNode
  isUserInsufficientBalance?: boolean
}

export function FormMain({ inputAmount, outputAmount, tradeLoading, isUserInsufficientBalance }: Readonly<Props>) {
  const { address: account } = useAccount()
  const { t } = useTranslation()
  const warningSwapHandler = useWarningImport()
  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputCurrencyChainId },
  } = useSwapState()
  const { chain: inputChain } = useSwapChain(inputCurrencyChainId, 'input')
  const { chain: outputChain } = useSwapChain(outputCurrencyChainId, 'output')
  const isWrapping = useIsWrapping()
  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)
  const { onCurrencySelection, onUserInput } = useSwapActionHandlers()
  const [inputBalance] = useCurrencyBalances(account, [inputCurrency, outputCurrency])
  const maxAmountInput = useMemo(() => maxAmountSpend(inputBalance), [inputBalance])
  const loadedUrlParams = useDefaultsFromURLSearch()
  const handleTypeInput = useCallback((value: string) => onUserInput(Field.INPUT, value), [onUserInput])
  const handleTypeOutput = useCallback((value: string) => onUserInput(Field.OUTPUT, value), [onUserInput])

  const handlePercentInput = useCallback(
    (percent: number) => {
      if (maxAmountInput) {
        onUserInput(Field.INPUT, maxAmountInput.multiply(new Percent(percent, 100)).toExact())
      }
    },
    [maxAmountInput, onUserInput],
  )

  const handleMaxInput = useCallback(() => {
    if (maxAmountInput) {
      onUserInput(Field.INPUT, maxAmountInput.toExact())
    }
  }, [maxAmountInput, onUserInput])

  const handleCurrencySelect = useCallback(
    (
      newCurrency: Currency,
      newChainId: ChainId | undefined,
      field: Field,
      currentInputCurrencyId: string | undefined,
      currentInputChainId: ChainId | undefined,
      currentOutputCurrencyId: string | undefined,
      currentOutputChainId: ChainId | undefined,
    ) => {
      onCurrencySelection(field, newCurrency, newChainId)
      warningSwapHandler(newCurrency)
      const isInput = field === Field.INPUT
      const oldCurrencyId = isInput ? currentInputCurrencyId : currentOutputCurrencyId
      const otherCurrencyId = isInput ? currentOutputCurrencyId : currentInputCurrencyId
      const newCurrencyId = currencyId(newCurrency)
      const oldChainId = isInput ? currentOutputChainId : currentInputChainId
      const otherChainId = isInput ? currentInputChainId : currentOutputChainId
      replaceBrowserHistoryMultiple({
        ...(newCurrencyId === otherCurrencyId && { [isInput ? 'outputCurrency' : 'inputCurrency']: oldCurrencyId }),
        ...(newChainId === otherChainId && {
          [isInput ? 'outputCurrencyChainId' : 'inputCurrencyChainId']: oldChainId,
        }),
        [isInput ? 'inputCurrency' : 'outputCurrency']: newCurrencyId,
        [isInput ? 'inputCurrencyChainId' : 'outputCurrencyChainId']: newChainId,
      })
    },
    [onCurrencySelection, warningSwapHandler],
  )
  const handleInputSelect = useCallback(
    (newCurrency: Currency, newChainId?: ChainId) =>
      handleCurrencySelect(
        newCurrency,
        newChainId ?? undefined,
        Field.INPUT,
        inputCurrencyId ?? '',
        inputCurrencyChainId ?? undefined,
        outputCurrencyId ?? '',
        outputCurrencyChainId ?? undefined,
      ),
    [handleCurrencySelect, inputCurrencyId, inputCurrencyChainId, outputCurrencyId, outputCurrencyChainId],
  )
  const handleOutputSelect = useCallback(
    (newCurrency: Currency, newChainId?: ChainId) =>
      handleCurrencySelect(
        newCurrency,
        newChainId ?? undefined,
        Field.OUTPUT,
        inputCurrencyId ?? '',
        inputCurrencyChainId ?? undefined,
        outputCurrencyId ?? '',
        outputCurrencyChainId ?? undefined,
      ),
    [handleCurrencySelect, inputCurrencyId, inputCurrencyChainId, outputCurrencyId, outputCurrencyChainId],
  )

  const isTypingInput = independentField === Field.INPUT
  const inputValue = useMemo(
    () => typedValue && (isTypingInput ? typedValue : formatAmount(inputAmount) || ''),
    [typedValue, isTypingInput, inputAmount],
  )
  const outputValue = useMemo(
    () => typedValue && (isTypingInput ? formatAmount(outputAmount) || '' : typedValue),
    [typedValue, isTypingInput, outputAmount],
  )
  const inputLoading = typedValue ? !isTypingInput && tradeLoading : false
  const outputLoading = typedValue ? isTypingInput && tradeLoading : false

  return (
    <FormContainer>
      <CurrencyInputPanelSimplify
        id="swap-currency-input"
        showUSDPrice
        showMaxButton
        showCommonBases
        inputLoading={!isWrapping && inputLoading}
        chainId={inputChain?.id}
        currencyLoading={!loadedUrlParams}
        label={!isTypingInput && !isWrapping ? t('From (estimated)') : t('From')}
        defaultValue={isWrapping ? typedValue : inputValue}
        maxAmount={maxAmountInput}
        showQuickInputButton
        currency={inputCurrency}
        onUserInput={handleTypeInput}
        onPercentInput={handlePercentInput}
        onMax={handleMaxInput}
        onCurrencySelect={handleInputSelect}
        otherCurrency={outputCurrency}
        commonBasesType={CommonBasesType.SWAP_LIMITORDER}
        title={
          <Text color="textSubtle" fontSize={12} bold>
            {t('From')}
          </Text>
        }
        isUserInsufficientBalance={isUserInsufficientBalance}
      />
      <FlipButton />
      <CurrencyInputPanelSimplify
        id="swap-currency-output"
        showUSDPrice
        showCommonBases
        showMaxButton={false}
        chainId={outputChain?.id}
        inputLoading={!isWrapping && outputLoading}
        currencyLoading={!loadedUrlParams}
        label={isTypingInput && !isWrapping ? t('To (estimated)') : t('To')}
        defaultValue={isWrapping ? typedValue : outputValue}
        currency={outputCurrency}
        onUserInput={handleTypeOutput}
        onCurrencySelect={handleOutputSelect}
        otherCurrency={inputCurrency}
        commonBasesType={CommonBasesType.SWAP_LIMITORDER}
        title={
          <Text color="textSubtle" fontSize={12} bold>
            {t('To')}
          </Text>
        }
      />
      <AssignRecipientButton />
      <Recipient />
    </FormContainer>
  )
}
