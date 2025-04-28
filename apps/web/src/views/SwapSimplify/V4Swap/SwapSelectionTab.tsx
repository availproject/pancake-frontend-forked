import { useTranslation } from '@pancakeswap/localization'
import { ButtonMenu, ButtonMenuItem } from '@pancakeswap/uikit'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import { styled } from 'styled-components'
import { SwapType } from '../../Swap/types'

const StyledButtonMenuItem = styled(ButtonMenuItem)`
  height: 40px;
  padding: 0px 16px;
  * ${({ theme }) => theme.mediaQueries.md} {
    width: 124px;
    padding: 0px 24px;
  }
`

const SwapSelectionWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  gap: 4px;
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.backgroundAlt};
  border-radius: 24px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  ${({ theme }) => theme.mediaQueries.md} {
    gap: 16px;
  }
`

export const SwapSelection = ({ swapType, style }: { swapType: SwapType; style?: React.CSSProperties }) => {
  const { t } = useTranslation()
  const router = useRouter()

  const onSelect = useCallback(() => {
    router.push('/')
  }, [router])

  return (
    <SwapSelectionWrapper style={style}>
      <ButtonMenu
        scale="md"
        activeIndex={swapType}
        onItemClick={() => onSelect()}
        variant="subtle"
        noButtonMargin
        fullWidth
        disabled
      >
        <StyledButtonMenuItem>{t('Swap')}</StyledButtonMenuItem>
        <></>
      </ButtonMenu>
    </SwapSelectionWrapper>
  )
}
