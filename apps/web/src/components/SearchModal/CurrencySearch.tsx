/* eslint-disable no-restricted-syntax */
import { ChainId, Currency, Token } from '@pancakeswap/sdk'
import { createFilterToken } from '@pancakeswap/token-lists'
import { AutoColumn, Input, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useAudioPlay } from '@pancakeswap/utils/user'
import { useCallback, useEffect, useRef } from 'react'

import { useActiveChainId } from 'hooks/useActiveChainId'
import { safeGetAddress } from 'utils'

import { useTokenComparator } from 'hooks/useTokenComparator'
import { useAllTokens } from '../../hooks/Tokens'
import Row from '../Layout/Row'
import CommonBases from './CommonBases'
import { getSwapSound } from './swapSound'

interface CurrencySearchProps {
  selectedCurrency?: Currency | null
  selectedChainId?: ChainId | null
  onCurrencySelect: (currency: Currency, chainId?: ChainId) => void
  otherSelectedCurrency?: Currency | null
  showSearchInput?: boolean
  showCommonBases?: boolean
  commonBasesType?: string
  enableChainIdSelect?: boolean
}

function CurrencySearch({
  selectedCurrency,
  onCurrencySelect,
  showCommonBases,
  commonBasesType,
  showSearchInput = true,
  showImportView,
  setImportToken,
  height,
  tokensToShow,
  selectedChainId,
}: Readonly<CurrencySearchProps>) {
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()

  // refs for fixed size lists
  const fixedList = useRef<FixedSizeList>()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const debouncedQuery = useDebounce(searchQuery, 200)

  const [invertSearchOrder] = useState<boolean>(false)

  const allTokens = useAllTokens()

  const { isMobile } = useMatchBreakpoints()
  const [audioPlay] = useAudioPlay()

  const filteredTokens: Token[] = useMemo(() => {
    const filterToken = createFilterToken(debouncedQuery, (address) => isAddress(address))
    return Object.values(tokensToShow || allTokens).filter(filterToken)
  }, [tokensToShow, allTokens, debouncedQuery])

  const filteredQueryTokens = useSortedTokensByQuery(filteredTokens, debouncedQuery)
  const tokenComparator = useTokenComparator(invertSearchOrder)

  const filteredSortedTokens: Token[] = useMemo(
    () => [...filteredQueryTokens].sort(tokenComparator),
    [filteredQueryTokens, tokenComparator],
  )

  const handleCurrencySelect = useCallback(
    (currency: Currency, newChainId?: ChainId) => {
      onCurrencySelect(currency, newChainId)
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

  const handleInput = useCallback((event) => {
    const input = event.target.value
    const checksummedInput = safeGetAddress(input)
    setSearchQuery(checksummedInput || input)
    fixedList.current?.scrollTo(0)
  }, [])

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const s = debouncedQuery.toLowerCase().trim()
        if (filteredSortedTokens.length > 0) {
          if (
            filteredSortedTokens[0].symbol?.toLowerCase() === debouncedQuery.trim().toLowerCase() ||
            filteredSortedTokens.length === 1
          ) {
            handleCurrencySelect(filteredSortedTokens[0])
          }
        }
      }
    },
    [debouncedQuery, filteredSortedTokens, handleCurrencySelect],
  )

  return (
    <AutoColumn gap="16px">
      {showSearchInput && (
        <Row>
          <Input
            id="token-search-input"
            placeholder={t('Search by name or paste address')}
            scale="lg"
            autoComplete="off"
            value={searchQuery}
            ref={inputRef as RefObject<HTMLInputElement>}
            onChange={handleInput}
            onKeyDown={handleEnter}
          />
        </Row>
      )}
      {showCommonBases && (
        <CommonBases
          chainId={chainId}
          onSelect={handleCurrencySelect}
          selectedCurrency={selectedCurrency}
          commonBasesType={commonBasesType}
          selectedChainId={selectedChainId}
        />
      )}
    </AutoColumn>
  )
}

export default CurrencySearch
