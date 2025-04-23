import { ContextApi } from '@pancakeswap/localization'
import { DropdownMenuItems, DropdownMenuItemType, MenuItemsType, SwapFillIcon, SwapIcon } from '@pancakeswap/uikit'
import { getPerpetualUrl } from 'utils/getPerpetualUrl'

export type ConfigMenuDropDownItemsType = DropdownMenuItems & {
  hideSubNav?: boolean
  overrideSubNavItems?: DropdownMenuItems['items']
  matchHrefs?: string[]
}
export type ConfigMenuItemsType = Omit<MenuItemsType, 'items'> & {
  hideSubNav?: boolean
  image?: string
  items?: ConfigMenuDropDownItemsType[]
  overrideSubNavItems?: ConfigMenuDropDownItemsType[]
}

export const addMenuItemSupported = (item, chainId) => {
  if (!chainId || !item.supportChainIds) {
    return item
  }
  if (item.supportChainIds?.includes(chainId)) {
    return item
  }
  return {
    ...item,
    disabled: true,
  }
}

const config: (
  t: ContextApi['t'],
  isDark: boolean,
  languageCode?: string,
  chainId?: number,
) => ConfigMenuItemsType[] = (t, isDark, languageCode, chainId) =>
  [
    {
      label: t('Trade'),
      icon: SwapIcon,
      fillIcon: SwapFillIcon,
      href: '/swap',
      hideSubNav: true,
      items: [
        {
          label: t('Swap'),
          href: '/swap',
        },
        {
          label: t('Perps'),
          href: getPerpetualUrl({
            chainId,
            languageCode,
            isDark,
          }),
          confirmModalId: 'perpConfirmModal',
          type: DropdownMenuItemType.EXTERNAL_LINK,
        },
        {
          label: t('Buy Crypto'),
          href: '/buy-crypto',
        },
      ].map((item) => addMenuItemSupported(item, chainId)),
    },
  ].map((item) => addMenuItemSupported(item, chainId))

export default config
