import { useTranslation } from '@pancakeswap/localization'
import {
  Box,
  Button,
  CopyAddress,
  Flex,
  FlexGap,
  InfoFilledIcon,
  InjectedModalProps,
  Skeleton,
  Text,
  TooltipText,
  useTooltip,
} from '@pancakeswap/uikit'
import InternalLink from 'components/Links'
import useActiveWeb3React from 'hooks/useActiveWeb3React'
import useAuth from 'hooks/useAuth'
import { useDomainNameForAddress } from 'hooks/useDomain'
import { useEffect, useMemo, useState } from 'react'
import { isMobile } from 'react-device-detect'

interface WalletInfoProps {
  hasLowNativeBalance: boolean
  switchView: (newIndex: number) => void
  onDismiss: InjectedModalProps['onDismiss']
}

const WalletInfo: React.FC<WalletInfoProps> = ({ hasLowNativeBalance, onDismiss }) => {
  const { t } = useTranslation()
  const { account, chain } = useActiveWeb3React()
  const { domainName } = useDomainNameForAddress(account ?? '')
  const { logout } = useAuth()
  const [allBalances, setAllBalances] = useState<any>([])
  const [mobileTooltipShow, setMobileTooltipShow] = useState(false)

  const currentBalance = useMemo(() => {
    const filteredBalances = allBalances?.filter((balance) => balance.symbol === 'USDT')
    console.log('filteredBalances', filteredBalances)
    return filteredBalances
  }, [allBalances])

  useEffect(() => {
    const fetchBalances = async () => {
      if (ca) {
        const balances = await ca.getUnifiedBalances()
        console.log('balances', balances)
        setAllBalances(balances || [])
      }
    }
    fetchBalances()
  }, [])

  const handleLogout = () => {
    onDismiss?.()
    logout()
  }

  const {
    tooltip: buyCryptoTooltip,
    tooltipVisible: buyCryptoTooltipVisible,
    targetRef: buyCryptoTargetRef,
  } = useTooltip(
    <Box maxWidth="140px">
      <FlexGap gap="8px" flexDirection="column" justifyContent="space-between">
        <Text as="p">
          {t('%currency% Balance Low. You need %currency% for transaction fees.', {
            currency: currentBalance?.[0]?.symbol,
          })}
        </Text>
        <InternalLink href="/buy-crypto" onClick={() => onDismiss?.()}>
          <Button height="30px">{t('Buy %currency%', { currency: currentBalance?.[0]?.symbol })}</Button>
        </InternalLink>
      </FlexGap>
    </Box>,
    {
      isInPortal: false,
      placement: isMobile ? 'top' : 'bottom',
      trigger: isMobile ? 'focus' : 'hover',
      ...(isMobile && { manualVisible: mobileTooltipShow }),
    },
  )
  const showNativeEntryPoint = Number(currentBalance?.[0]?.value) === 0

  return (
    <>
      <Text color="secondary" fontSize="12px" textTransform="uppercase" fontWeight="bold" mb="8px">
        {t('Your Address')}
      </Text>
      <FlexGap flexDirection="column" mb="24px" gap="8px">
        <CopyAddress tooltipMessage={t('Copied')} account={account ?? undefined} />
        {domainName ? <Text color="textSubtle">{domainName}</Text> : null}
      </FlexGap>
      {chain && (
        <Box mb="16px">
          <Flex alignItems="center" justifyContent="space-between">
            <Text color="textSubtle">
              {currentBalance?.[0]?.symbol} {t('Balance')}
            </Text>
            {!allBalances ? (
              <Skeleton height="22px" width="60px" />
            ) : (
              <Flex>
                <Text color="text" fontWeight="normal">
                  {currentBalance?.[0]?.balance}
                </Text>
                {showNativeEntryPoint ? (
                  <TooltipText
                    ref={buyCryptoTargetRef}
                    onClick={() => setMobileTooltipShow(false)}
                    display="flex"
                    style={{ justifyContent: 'center' }}
                  >
                    <InfoFilledIcon pl="2px" fill="#000" color="#D67E0A" width="22px" />
                  </TooltipText>
                ) : null}
                {buyCryptoTooltipVisible && !isMobile && buyCryptoTooltip}
              </Flex>
            )}
          </Flex>
        </Box>
      )}
      <Button variant="secondary" width="100%" minHeight={48} onClick={handleLogout}>
        {t('Disconnect Wallet')}
      </Button>
    </>
  )
}

export default WalletInfo
