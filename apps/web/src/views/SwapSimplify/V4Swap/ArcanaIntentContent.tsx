import { useTranslation } from '@pancakeswap/localization'
import { Box, Button, Flex, Heading, RefreshIcon, Spinner, Text, useToast } from '@pancakeswap/uikit'
import { useCallback, useEffect, useState } from 'react'

export default function ArcanaIntentContent({ intentModal }: Readonly<{ intentModal: any }>) {
  const { t } = useTranslation()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toastSuccess, toastError } = useToast()

  const handleAllow = () => {
    if (!intentModal) return
    intentModal.resolve()
    toastSuccess(t('Intent Approved'))
  }

  const handleDeny = () => {
    if (!intentModal) return
    intentModal.reject('User denied intent request')
    toastError(t('Intent Denied'))
  }

  const handleRefresh = useCallback(async () => {
    if (!intentModal) return
    setIsRefreshing(true)
    try {
      await intentModal.data.refresh()
      toastSuccess(t('Intent details refreshed'))
    } catch (e) {
      console.error('Failed to refresh intent:', e)
      toastError(t('Failed to refresh intent details'))
    } finally {
      setIsRefreshing(false)
    }
  }, [intentModal, toastError, toastSuccess])

  useEffect(() => {
    const interval = setInterval(() => {
      if (intentModal && !isRefreshing) {
        handleRefresh()
      }
    }, 6000)
    return () => clearInterval(interval)
  }, [intentModal, handleRefresh, isRefreshing])

  if (!intentModal) return null

  const intentData = intentModal.data.intent
  console.log('intentData', intentData)

  return (
    <Box>
      <Heading size="md" mb="16px">
        {t('Confirm Transaction')}
      </Heading>
      <Text mb="16px">
        {t('Please review the details of this transaction.')}
        <br />
        {t('Fees and routes may change if not confirmed promptly.')}
      </Text>
      <Box mb="16px" p="8px" border="1px solid" borderColor="cardBorder" borderRadius="4px">
        <Text bold mb="8px">
          {t('Details:')}
        </Text>
        {intentData?.sources?.map((source: any, index: number) => (
          <Text key={source?.amount} fontSize="14px">
            -{' '}
            {t('Use %amount% on %chainName%', {
              amount: source.amount,
              chainName: source.chainName,
            })}
          </Text>
        ))}
        <Text fontSize="14px" mt="4px">
          - {t('Total Gas: %gas% ', { gas: intentData.fees.caGas })}
        </Text>
        <Text fontSize="14px" mt="4px">
          - {t('Total Fee: %amount%', { amount: intentData.fees.total })}
        </Text>
      </Box>

      <Flex justifyContent="space-between" mt="24px">
        <Button variant="secondary" onClick={handleDeny}>
          {t('Deny')}
        </Button>
        <Flex>
          <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing} mr="8px">
            {isRefreshing ? <Spinner size={20} /> : <RefreshIcon width="20px" />}
          </Button>
          <Button onClick={handleAllow}>{t('Proceed')}</Button>
        </Flex>
      </Flex>
    </Box>
  )
}
