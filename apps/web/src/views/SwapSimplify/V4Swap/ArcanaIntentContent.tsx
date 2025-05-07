import { useTranslation } from '@pancakeswap/localization'
import { Box, Button, Flex, Heading, RefreshIcon, Spinner, Text, useToast } from '@pancakeswap/uikit'
import { useCallback, useEffect, useState } from 'react'

export const ArcanaAllowanceContent = ({ allowanceModal }: { allowanceModal: any }) => {
  const { t } = useTranslation()
  const { toastSuccess, toastError } = useToast()
  const [allowanceChoices, setAllowanceChoices] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (Array.isArray(allowanceModal?.data.sources)) {
      const initialChoices = allowanceModal.data.sources.reduce((acc, source) => {
        if (source.token && typeof source.token === 'object' && source.token.contractAddress) {
          return {
            ...acc,
            [`${source.chainID}-${source.token.contractAddress}`]: String(source.minAllowance) || 'min',
          }
        }
        // Fallback or error handling if token structure is not as expected
        console.warn('Source token or contractAddress is missing:', source)
        return acc
      }, {})
      setAllowanceChoices(initialChoices)
    }
  }, [allowanceModal?.data.sources])

  const handleAllowanceChange = (sourceKey: string, value: string) => {
    setAllowanceChoices((prev) => ({ ...prev, [sourceKey]: value }))
  }

  const handleAllow = () => {
    if (!allowanceModal || !Array.isArray(allowanceModal.data.sources)) return
    const allowances = allowanceModal.data.sources
      .map((source) => {
        if (source.token && typeof source.token === 'object' && source.token.contractAddress) {
          const choice = allowanceChoices[`${source.chainID}-${source.token.contractAddress}`]
          return choice
        }
        return undefined // Or handle error appropriately
      })
      .filter(Boolean) // Filter out undefined choices if any source was problematic
    console.log('Passing allowances to resolve:', allowances)
    allowanceModal.resolve(allowances)
    toastSuccess(t('Allowances Approved'))
  }

  const handleDeny = () => {
    if (!allowanceModal) return
    allowanceModal.reject('User denied allowance request')
    toastError(t('Allowance Request Denied'))
  }

  if (!allowanceModal) return null
  const allowanceModalData = allowanceModal.data
  console.log('allowanceModalData', allowanceModalData)

  return (
    <Box>
      <Heading size="md" mb="24px">
        {t('Approve Allowances')}
      </Heading>
      <Text mb="16px">{t('The following allowances are required to proceed:')}</Text>
      {Array.isArray(allowanceModalData.sources) &&
        allowanceModalData.sources.map((source) => {
          // Ensure source.token is an object and has contractAddress and symbol
          if (
            !source.token ||
            typeof source.token !== 'object' ||
            !source.token.contractAddress ||
            !source.token.symbol
          ) {
            console.warn('Invalid source token data for rendering:', source)
            return null // Or render some fallback UI
          }
          const sourceKey = `${source.chainID}-${source.token.contractAddress}`
          return (
            <Box key={sourceKey} mb="16px" p="8px" border="1px solid" borderColor="cardBorder" borderRadius="4px">
              <Text bold>
                {source.token.symbol} ({t('Chain ID')}: {source.chainID})
              </Text>
              <Text fontSize="12px" color="textSubtle">
                {t('Minimum required: %amount%', { amount: source.minAllowance })}
              </Text>
              <Flex mt="8px">
                <Button variant="secondary" scale="sm" mr="8px" onClick={() => handleAllowanceChange(sourceKey, 'min')}>
                  {t('Use Minimum')} {allowanceChoices[sourceKey] === 'min' && '✅'}
                </Button>
                <Button variant="secondary" scale="sm" onClick={() => handleAllowanceChange(sourceKey, 'max')}>
                  {t('Use Maximum')} {allowanceChoices[sourceKey] === 'max' && '✅'}
                </Button>
              </Flex>
            </Box>
          )
        })}
      <Flex justifyContent="space-between" mt="24px">
        <Button variant="secondary" onClick={handleDeny}>
          {t('Deny')}
        </Button>
        <Button onClick={handleAllow}>{t('Allow')}</Button>
      </Flex>
    </Box>
  )
}

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
