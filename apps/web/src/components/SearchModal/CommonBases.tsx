import { ChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, WETH9 } from '@pancakeswap/sdk'
import { AutoColumn, Button, QuestionHelper, Text } from '@pancakeswap/uikit'
import { ChainLogo, CurrencyLogo } from '@pancakeswap/widgets-internal'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { styled } from 'styled-components'

import { USDT } from '@pancakeswap/tokens'
import { SUGGESTED_BASES } from 'config/constants/exchange'
import { useSwapChain } from 'hooks/Tokens'
import { useCallback, useMemo, useState } from 'react'
import { AutoRow } from '../Layout/Row'
import { CommonBasesType } from './types'

const ButtonWrapper = styled.div`
  display: inline-block;
  vertical-align: top;
  margin-right: 10px;
`

const BaseWrapper = styled.div<{ disable?: boolean; isSelected?: boolean }>`
  border: 1px solid
    ${({ theme, disable, isSelected }) => {
      if (disable) return 'transparent'
      if (isSelected) return theme.colors.primary // Highlight border for selected state
      return theme.colors.dropdown
    }};
  border-radius: ${({ theme }) => theme.radii['20px']};
  padding-left: 2px;
  display: flex;
  align-items: center;
  &:hover {
    cursor: ${({ disable }) => !disable && 'pointer'};
    background-color: ${({ theme, disable }) => !disable && theme.colors.background};
  }
  background-color: ${({ theme, isSelected }) => (isSelected ? `${theme.colors.primary}1a` : theme.colors.tertiary)};
  opacity: ${({ disable }) => disable && '0.4'};
  transition: background-color 0.15s, border-color 0.15s;
`

const RowWrapper = styled.div`
  white-space: nowrap;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    display: none;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
`

const ConfirmButtonWrapper = styled.div`
  margin-top: 16px;
  width: 100%;
  text-align: center;
`

export const SUPPORTED_CHAIN_IDS = [ChainId.BASE, ChainId.ARBITRUM_ONE]
const SUPPORTED_TOKENS = [...SUGGESTED_BASES[ChainId.ETHEREUM]]

export default function CommonBases({
  chainId,
  onSelect,
  selectedCurrency,
  selectedChainId,
  commonBasesType,
  enableChainIdSelect = false,
}: Readonly<{
  chainId?: ChainId
  selectedChainId?: ChainId | undefined
  commonBasesType
  selectedCurrency?: Currency | null
  onSelect: (currency: Currency, chainId?: ChainId) => void
  enableChainIdSelect?: boolean
}>) {
  const native = useNativeCurrency()
  const [selectedToken, setSelectedToken] = useState(selectedCurrency ?? native?.wrapped)
  const [selectedNewChainId, setSelectedNewChainId] = useState<ChainId | undefined>(selectedChainId)
  const selectedChain = useSwapChain(selectedChainId, 'input')

  const supportedTokens = useMemo(() => {
    if (native) {
      return [...SUPPORTED_TOKENS, native?.wrapped]
    }
    return SUPPORTED_TOKENS
  }, [native])
  const { t } = useTranslation()
  const pinTokenDescText = commonBasesType === CommonBasesType.SWAP_LIMITORDER ? t('Select token') : t('Common bases')

  const handleSelectToken = useCallback((token: Currency) => {
    console.log('handleSelectToken', token)
    setSelectedToken(token)
  }, [])

  const handleSelectChainId = useCallback((newChainId: ChainId) => {
    setSelectedNewChainId(newChainId)
  }, [])

  const handleConfirm = useCallback(() => {
    if (selectedToken && selectedNewChainId) {
      let parsedToken: Currency
      if (selectedToken?.symbol === 'USDT') {
        parsedToken = USDT[selectedNewChainId]
      } else {
        parsedToken = WETH9[selectedNewChainId]
      }
      onSelect(selectedToken, selectedNewChainId)
    }
  }, [selectedToken, selectedNewChainId, onSelect])

  return (
    <AutoColumn gap="lg">
      <AutoRow>
        <Text color="textSubtle" fontSize="14px">
          {pinTokenDescText}
        </Text>
        {commonBasesType === CommonBasesType.LIQUIDITY && (
          <QuestionHelper text={t('These tokens are commonly paired with other tokens.')} ml="4px" />
        )}
      </AutoRow>
      <RowWrapper>
        {supportedTokens.map((token) => {
          const selected = selectedToken?.equals(token)
          return (
            <ButtonWrapper key={`buttonBase#${token.name}`}>
              <BaseWrapper onClick={() => !selected && handleSelectToken(token)} isSelected={selected}>
                <CurrencyLogo currency={token} style={{ borderRadius: '50%' }} />
                <Text p="2px 6px">{token.symbol}</Text>
              </BaseWrapper>
            </ButtonWrapper>
          )
        })}
      </RowWrapper>
      {enableChainIdSelect && (
        <>
          <AutoRow>
            <Text color="textSubtle" fontSize="14px">
              {t('Select chain')}
            </Text>
          </AutoRow>
          <RowWrapper>
            {SUPPORTED_CHAIN_IDS.map((supportedChainId) => {
              const isSelected = selectedNewChainId === supportedChainId
              return (
                <ButtonWrapper key={`buttonChainId#${supportedChainId}`}>
                  <BaseWrapper
                    onClick={() => !isSelected && handleSelectChainId(supportedChainId)}
                    isSelected={isSelected}
                  >
                    <ChainLogo chainId={supportedChainId} width={20} height={20} />
                    <Text p="2px 6px">{supportedChainId === ChainId.BASE ? 'Base' : 'Arbitrum'}</Text>
                  </BaseWrapper>
                </ButtonWrapper>
              )
            })}
          </RowWrapper>
        </>
      )}
      <ConfirmButtonWrapper>
        <Button disabled={!selectedToken} onClick={handleConfirm} width="100%">
          {t('Confirm Selection')}
        </Button>
      </ConfirmButtonWrapper>
    </AutoColumn>
  )
}
