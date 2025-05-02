import { PriceOrder } from '@pancakeswap/price-api-sdk'
import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import { InjectedModalProps } from '@pancakeswap/uikit'
import { ArcanaBridgingState } from 'contexts/ArcanaProvider'
import { Chain } from 'wagmi/chains'

export interface ArcanaConfirmBridgeModalProps extends InjectedModalProps {
  inputCurrency?: Currency | null
  outputCurrency?: Currency | null
  inputChain?: Chain | null
  outputChain?: Chain | null
  sourceChain?: Chain | null
  inputAmount?: CurrencyAmount<Currency> | null
  outputAmount?: CurrencyAmount<Currency> | null
  bridgingState: ExtendedBridgingState
  errorMessage?: string | null
  allowanceModal?: any
  intentModal?: any
  txHash?: string | null
  onConfirm: () => void
}

export interface ArcanaSwapButtonPropsType {
  order?: PriceOrder
  refreshOrder?: () => void
}

export type ExtendedBridgingState = ArcanaBridgingState
