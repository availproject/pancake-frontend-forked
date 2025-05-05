import { useTranslation } from '@pancakeswap/localization'
import {
  Box,
  Button,
  CopyAddress,
  Flex,
  FlexGap,
  InfoFilledIcon,
  InjectedModalProps,
  LinkExternal,
  Skeleton,
  Text,
  TooltipText,
  useTooltip,
} from '@pancakeswap/uikit'
import { ChainLogo } from 'components/Logo/ChainLogo'
import useActiveWeb3React from 'hooks/useActiveWeb3React'
import useAuth from 'hooks/useAuth'

import { CA } from '@arcana/ca-sdk'
import InternalLink from 'components/Links'
import { useDomainNameForAddress } from 'hooks/useDomain'
import { useEffect, useMemo, useState } from 'react'
import { isMobile } from 'react-device-detect'
import { getBlockExploreLink, getBlockExploreName } from 'utils'
import { useBalance } from 'wagmi'

const COLORS = {
  ETH: '#627EEA',
  BNB: '#14151A',
}

interface WalletInfoProps {
  ca?: CA | null
  hasLowNativeBalance: boolean
  switchView: (newIndex: number) => void
  onDismiss: InjectedModalProps['onDismiss']
}

const WalletInfo: React.FC<WalletInfoProps> = ({ hasLowNativeBalance, onDismiss, ca }) => {
  const { t } = useTranslation()
  const { account, chainId, chain } = useActiveWeb3React()
  const { domainName } = useDomainNameForAddress(account ?? '')
  const nativeBalance = useBalance({ address: account ?? undefined, query: { enabled: !!ca } })
  const [mobileTooltipShow, setMobileTooltipShow] = useState(false)
  const { logout } = useAuth()
  const [allBalances, setAllBalances] = useState<any>([])

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
  }, [ca, account, chainId])

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

  const showNativeEntryPoint = Number(nativeBalance?.data?.value) === 0

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
          <Flex justifyContent="space-between" alignItems="center" mb="8px">
            <Flex bg={COLORS.ETH} borderRadius="16px" pl="4px" pr="8px" py="2px">
              <ChainLogo chainId={chain.id} />
              <Text color="white" ml="4px">
                {chain.name}
              </Text>
            </Flex>
            <LinkExternal href={getBlockExploreLink(account, 'address', chainId)}>
              {getBlockExploreName(chainId)}
            </LinkExternal>
          </Flex>
          <Flex alignItems="center" justifyContent="space-between">
            <Text color="textSubtle">
              {currentBalance?.[0]?.symbol} {t('Balance')}
            </Text>
            {!nativeBalance.isFetched ? (
              <Skeleton height="22px" width="60px" />
            ) : (
              <Flex>
                <Text
                  color={showNativeEntryPoint ? 'warning' : 'text'}
                  fontWeight={showNativeEntryPoint ? 'bold' : 'normal'}
                >
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
                {buyCryptoTooltipVisible && (!isMobile || mobileTooltipShow) && buyCryptoTooltip}
              </Flex>
            )}
          </Flex>
        </Box>
      )}
      <Button variant="secondary" width="100%" minHeight={48} mt="16px" onClick={handleLogout}>
        {t('Disconnect Wallet')}
      </Button>
    </>
  )
}

export default WalletInfo
