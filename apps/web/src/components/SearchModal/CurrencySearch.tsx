/* eslint-disable no-restricted-syntax */
import { ChainId, Currency } from '@pancakeswap/sdk'
import { AutoColumn, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useAudioPlay } from '@pancakeswap/utils/user'
import { useCallback, useEffect, useRef } from 'react'

import { useActiveChainId } from 'hooks/useActiveChainId'

import CommonBases from './CommonBases'
import { getSwapSound } from './swapSound'

interface CurrencySearchProps {
  selectedCurrency?: Currency | null
  selectedChainId?: ChainId | undefined
  onCurrencySelect: (currency: Currency, chainId?: ChainId) => void
  showCommonBases?: boolean
  commonBasesType?: string
  enableChainIdSelect?: boolean
}

function CurrencySearch({
  selectedCurrency,
  onCurrencySelect,
  showCommonBases,
  commonBasesType,
  selectedChainId,
  enableChainIdSelect = false,
}: Readonly<CurrencySearchProps>) {
  const { chainId: activeChainId } = useActiveChainId()

  const { isMobile } = useMatchBreakpoints()
  const [audioPlay] = useAudioPlay()

  const handleCurrencySelect = useCallback(
    (currency: Currency, chainId?: ChainId) => {
      onCurrencySelect(currency, chainId)
      if (audioPlay) {
        getSwapSound().play()
      }
    },
    [audioPlay, onCurrencySelect],
  )

  // manage focus on modal show
  const inputRef = useRef<HTMLInputElement>()

  useEffect(() => {
    if (!isMobile) inputRef.current?.focus()
  }, [isMobile])

  return (
    <AutoColumn gap="16px" marginBottom="16px">
      {showCommonBases && (
        <CommonBases
          chainId={activeChainId}
          onSelect={handleCurrencySelect}
          selectedCurrency={selectedCurrency}
          selectedChainId={selectedChainId}
          commonBasesType={commonBasesType}
          enableChainIdSelect={enableChainIdSelect}
        />
      )}
    </AutoColumn>
  )
}

export default CurrencySearch
