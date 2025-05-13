import { useTranslation } from '@pancakeswap/localization'
import { ButtonMenu, ButtonMenuItem, Text, useMatchBreakpoints, useTooltip } from '@pancakeswap/uikit'
import GlobalSettings from 'components/Menu/GlobalSettings'
import { useActiveChainId } from 'hooks/useActiveChainId'
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

  const onSelect = useCallback(
    (value: SwapType) => {
      let url = ''
      switch (value) {
        case SwapType.MARKET:
          url = '/'
          break
        default:
          break
      }
      router.push(url)
    },
    [router],
  )
  const { chainId } = useActiveChainId()
  const { isMobile } = useMatchBreakpoints()

  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    <Text>
      {t(
        'TWAP (Time-Weighted Average Price) helps minimises market impact from large orders by averaging the asset price over a set time period.',
      )}
    </Text>,
    { placement: 'top' },
  )

  // NOTE: Commented out until charts are supported again
  // const { isChartSupported, isChartDisplayed, setIsChartDisplayed, isHotTokenSupported } =
  //   useContext(SwapFeaturesContext)
  // const [isSwapHotTokenDisplay, setIsSwapHotTokenDisplay] = useSwapHotTokenDisplay()
  // const toggleChartDisplayed = () => {
  //   setIsChartDisplayed?.((currentIsChartDisplayed) => !currentIsChartDisplayed)
  // }

  const tSwapProps = useMemo(() => {
    const isTSwapSupported = isTwapSupported(chainId)
    return {
      disabled: !isTSwapSupported,
      style: {
        cursor: isTSwapSupported ? 'pointer' : 'not-allowed',
        pointerEvents: isTSwapSupported ? 'auto' : 'none',
        color: !isTSwapSupported ? 'rgba(0, 0, 0, 0.15)' : undefined,
        userSelect: 'none',
      } as React.CSSProperties,
    }
  }, [chainId])

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
      {withToolkit && (
        <GlobalSettings
          color="textSubtle"
          mr="0"
          mode={SettingsMode.SWAP_LIQUIDITY}
          data-dd-action-name="Swap settings button"
          width="24px"
        />
      )}
    </SwapSelectionWrapper>
  )
}
