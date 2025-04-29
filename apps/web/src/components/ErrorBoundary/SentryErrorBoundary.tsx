import { useTranslation } from '@pancakeswap/localization'
import { Button, Flex, LogoIcon, Text } from '@pancakeswap/uikit'
import Page from 'components/Layout/Page'
import { useCallback } from 'react'

export function SentryErrorBoundary({ children }) {
  const { t } = useTranslation()
  const handleOnClick = useCallback(() => window.location.reload(), [])
  return (
    <Page>
      <Flex flexDirection="column" justifyContent="center" alignItems="center">
        <LogoIcon width="64px" mb="8px" />
        <Text mb="16px">{t('Oops, something wrong.')}</Text>
        {children}
        <Button onClick={handleOnClick}>{t('Click here to reset!')}</Button>
      </Flex>
    </Page>
  )
}
