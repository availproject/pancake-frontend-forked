import { CA } from '@arcana/ca-sdk'
import { useTranslation } from '@pancakeswap/localization'
import {
  Box,
  Flex,
  LogoutIcon,
  UserMenu as UIKitUserMenu,
  UserMenuDivider,
  UserMenuItem,
  UserMenuVariant,
  useModal,
} from '@pancakeswap/uikit'
import ConnectWalletButton from 'components/ConnectWalletButton'
import Trans from 'components/Trans'
import { useArcana } from 'contexts/ArcanaProvider'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useAuth from 'hooks/useAuth'
import { useDomainNameForAddress } from 'hooks/useDomain'
import { useCallback, useEffect, useState } from 'react'
import { useProfile } from 'state/profile/hooks'
import { useAccount } from 'wagmi'
import WalletModal, { WalletView } from './WalletModal'
import WalletUserMenuItem from './WalletUserMenuItem'

const UserMenuItems = ({ ca }: { ca: CA | null }) => {
  const { t } = useTranslation()
  const { isWrongNetwork } = useActiveChainId()
  const { logout } = useAuth()
  const { isInitialized, profile } = useProfile()

  const [onPresentWalletModal] = useModal(<WalletModal initialView={WalletView.WALLET_INFO} ca={ca} />)

  const [onPresentWrongNetworkModal] = useModal(<WalletModal initialView={WalletView.WRONG_NETWORK} ca={ca} />)
  const hasProfile = isInitialized && !!profile

  const onClickWalletMenu = useCallback((): void => {
    if (isWrongNetwork) {
      onPresentWrongNetworkModal()
    } else {
      onPresentWalletModal()
    }
  }, [isWrongNetwork, onPresentWalletModal, onPresentWrongNetworkModal])

  return (
    <>
      <WalletUserMenuItem isWrongNetwork={isWrongNetwork} onPresentWalletModal={onClickWalletMenu} />

      <UserMenuDivider />

      <UserMenuDivider />
      <UserMenuItem as="button" onClick={logout}>
        <Flex alignItems="center" justifyContent="space-between" width="100%">
          {t('Disconnect')}
          <LogoutIcon />
        </Flex>
      </UserMenuItem>
    </>
  )
}

const UserMenu = () => {
  const { t } = useTranslation()
  const { address: account } = useAccount()
  const { domainName, avatar } = useDomainNameForAddress(account)
  const { isWrongNetwork } = useActiveChainId()

  const { profile } = useProfile()
  const avatarSrc = profile?.nft?.image?.thumbnail ?? avatar
  const [userMenuText, setUserMenuText] = useState<string>('')
  const [userMenuVariable, setUserMenuVariable] = useState<UserMenuVariant>('default')
  const { ca, initArcana } = useArcana()

  useEffect(() => {
    if (!ca && account) {
      initArcana()
    }
  }, [ca, account])

  if (account) {
    return (
      <UIKitUserMenu
        account={domainName || account}
        ellipsis={!domainName}
        avatarSrc={avatarSrc}
        text={userMenuText}
        variant={userMenuVariable}
      >
        {({ isOpen }) => (isOpen ? <UserMenuItems ca={ca} /> : null)}
      </UIKitUserMenu>
    )
  }

  if (isWrongNetwork) {
    return (
      <UIKitUserMenu text={t('Network')} variant="danger">
        {({ isOpen }) => (isOpen ? <UserMenuItems ca={ca} /> : null)}
      </UIKitUserMenu>
    )
  }

  return (
    <ConnectWalletButton scale="sm">
      <Box display={['none', null, null, 'block']}>
        <Trans>Connect Wallet</Trans>
      </Box>
      <Box display={['block', null, null, 'none']}>
        <Trans>Connect</Trans>
      </Box>
    </ConnectWalletButton>
  )
}

export default UserMenu
