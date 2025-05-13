import { ChainId } from '@pancakeswap/chains'
import { createReducer } from '@reduxjs/toolkit'
import { atomWithReducer } from 'jotai/utils'
import { buildSwapOrder } from 'views/Swap/V3Swap/hooks/useSwapBestTrade'
import {
  Field,
  replaceSwapState,
  selectCurrency,
  setDisplayCurrency,
  setRecipient,
  switchCurrencies,
  syncDisplayWithActual,
  typeInput,
  updateDerivedPairData,
  updatePairData,
} from './actions'
import { DerivedPairDataNormalized, PairDataNormalized } from './types'

export interface SwapState {
  readonly independentField: Field
  readonly typedValue: string
  readonly [Field.INPUT]: {
    readonly currencyId: string | undefined
    readonly chainId: ChainId | undefined
    readonly displayCurrencyId?: string | undefined
  }
  readonly [Field.OUTPUT]: {
    readonly currencyId: string | undefined
    readonly chainId: ChainId | undefined
    readonly displayCurrencyId?: string | undefined
  }
  readonly recipient: string | null
  readonly pairDataById: Record<number, Record<string, PairDataNormalized>> | null
  readonly derivedPairDataById: Record<number, Record<string, DerivedPairDataNormalized>> | null
}

const initialState: SwapState = {
  independentField: Field.INPUT,
  typedValue: '',
  [Field.INPUT]: {
    currencyId: 'USDT',
    chainId: ChainId.ARBITRUM_ONE,
    displayCurrencyId: undefined,
  },
  [Field.OUTPUT]: {
    currencyId: 'USDC',
    chainId: ChainId.BASE,
    displayCurrencyId: undefined,
  },
  pairDataById: {},
  derivedPairDataById: {},
  recipient: null,
}

const reducer = createReducer<SwapState>(initialState, (builder) =>
  builder
    .addCase(
      replaceSwapState,
      (
        state,
        {
          payload: {
            typedValue,
            recipient,
            field,
            inputCurrencyId,
            displayInputCurrencyId,
            outputCurrencyId,
            displayOutputCurrencyId,
            inputCurrencyChainId,
            outputCurrencyChainId,
          },
        },
      ) => {
        const inputSwapOrder = buildSwapOrder(inputCurrencyId, inputCurrencyChainId, Field.INPUT)
        return {
          [Field.INPUT]: {
            currencyId: inputSwapOrder?.inputCurrencyId,
            chainId: inputSwapOrder?.inputCurrencyChainId,
            displayCurrencyId: displayInputCurrencyId,
          },
          [Field.OUTPUT]: {
            currencyId: inputSwapOrder?.outputCurrencyId,
            chainId: inputSwapOrder?.outputCurrencyChainId,
            displayCurrencyId: displayOutputCurrencyId,
          },
          independentField: field,
          typedValue,
          recipient,
          pairDataById: state.pairDataById,
          derivedPairDataById: state.derivedPairDataById,
        }
      },
    )
    .addCase(selectCurrency, (state, { payload: { currencyId, chainId, field } }) => {
      const otherField = field === Field.INPUT ? Field.OUTPUT : Field.INPUT
      const currentSwapOrder = buildSwapOrder(currencyId, chainId, field)

      if (currencyId === state[otherField].currencyId) {
        // If currencies would be the same, we swap them
        const otherSwapOrder = buildSwapOrder(state[field].currencyId, state[field].chainId, field)
        return {
          ...state,
          independentField: state.independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT,
          [field]: {
            currencyId: currentSwapOrder?.inputCurrencyId,
            chainId: currentSwapOrder?.inputCurrencyChainId,
            displayCurrencyId: state[field].displayCurrencyId,
          },
          [otherField]: {
            currencyId: otherSwapOrder?.outputCurrencyId,
            chainId: otherSwapOrder?.outputCurrencyChainId,
            displayCurrencyId: state[otherField].displayCurrencyId,
          },
        }
      }
      return {
        ...state,
        [field]: {
          currencyId: field === Field.INPUT ? currentSwapOrder?.inputCurrencyId : currentSwapOrder?.outputCurrencyId,
          chainId:
            field === Field.INPUT ? currentSwapOrder?.inputCurrencyChainId : currentSwapOrder?.outputCurrencyChainId,
          displayCurrencyId: state[field].displayCurrencyId,
        },
      }
    })
    .addCase(switchCurrencies, (state) => {
      console.log('switchCurrencies in reducer', {
        ...state,
        independentField: state.independentField,
        [Field.INPUT]: { currencyId: state[Field.INPUT].currencyId, chainId: state[Field.INPUT].chainId },
        [Field.OUTPUT]: { currencyId: state[Field.OUTPUT].currencyId, chainId: state[Field.OUTPUT].chainId },
      })
      return {
        ...state,
        independentField: state.independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT,
        [Field.INPUT]: {
          currencyId: state[Field.OUTPUT].currencyId,
          chainId: state[Field.OUTPUT].chainId,
          displayCurrencyId: state[Field.OUTPUT].displayCurrencyId,
        },
        [Field.OUTPUT]: {
          currencyId: state[Field.INPUT].currencyId,
          chainId: state[Field.INPUT].chainId,
          displayCurrencyId: state[Field.INPUT].displayCurrencyId,
        },
      }
    })
    .addCase(typeInput, (state, { payload: { field, typedValue } }) => {
      return {
        ...state,
        independentField: field,
        typedValue,
      }
    })
    .addCase(setRecipient, (state, { payload: { recipient } }) => {
      state.recipient = recipient
    })
    .addCase(updatePairData, (state, { payload: { pairData, pairId, timeWindow } }) => {
      if (!state.pairDataById) state.pairDataById = {}
      if (!state.pairDataById?.[pairId]) {
        state.pairDataById[pairId] = {}
      }
      state.pairDataById[pairId][timeWindow] = pairData
    })
    .addCase(updateDerivedPairData, (state, { payload: { pairData, pairId, timeWindow } }) => {
      if (!state.derivedPairDataById) state.derivedPairDataById = {}
      if (!state.derivedPairDataById[pairId]) {
        state.derivedPairDataById[pairId] = {}
      }
      state.derivedPairDataById[pairId][timeWindow] = pairData
    })
    .addCase(setDisplayCurrency, (state, { payload: { field, currencyId } }) => {
      console.log('setDisplayCurrency', { field, currencyId })
      return {
        ...state,
        [field]: {
          ...state[field],
          displayCurrencyId: currencyId,
        },
      }
    })
    .addCase(syncDisplayWithActual, (state) => {
      return {
        ...state,
        [Field.INPUT]: {
          ...state[Field.INPUT],
          displayCurrencyId: state[Field.INPUT].currencyId,
        },
        [Field.OUTPUT]: {
          ...state[Field.OUTPUT],
          displayCurrencyId: state[Field.OUTPUT].currencyId,
        },
      }
    }),
)

export const swapReducerAtom = atomWithReducer(initialState, reducer)
