import { Currency } from '@pancakeswap/sdk'
import { UnsafeCurrency } from 'config/constants/types'
import { useCurrency } from 'hooks/Tokens'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'

export function useDisplayCurrencies(): {
  inputCurrency: Currency | UnsafeCurrency | null
  outputCurrency: Currency | UnsafeCurrency | null
  actualInputCurrencyId: string | undefined
  actualOutputCurrencyId: string | undefined
} {
  const {
    [Field.INPUT]: { displayCurrencyId: inputDisplayCurrencyId, currencyId: inputCurrencyId },
    [Field.OUTPUT]: { displayCurrencyId: outputDisplayCurrencyId, currencyId: outputCurrencyId },
  } = useSwapState()

  // For UI display, use displayCurrencyId if available, otherwise fall back to actual currencyId
  const inputCurrency = useCurrency(inputDisplayCurrencyId ?? inputCurrencyId)
  const outputCurrency = useCurrency(outputDisplayCurrencyId ?? outputCurrencyId)

  return {
    inputCurrency,
    outputCurrency,
    actualInputCurrencyId: inputCurrencyId,
    actualOutputCurrencyId: outputCurrencyId,
  }
}
