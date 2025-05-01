import { useTranslation } from '@pancakeswap/localization'
import {
  ArrowDownIcon,
  Box,
  Button,
  Flex,
  Heading,
  LinkExternal,
  RefreshIcon,
  Spinner,
  Text,
  useToast,
} from '@pancakeswap/uikit'
import truncateHash from '@pancakeswap/utils/truncateHash'
import {
  ConfirmModalState,
  CurrencyLogo,
  SwapPendingModalContent,
  SwapTransactionReceiptModalContent,
} from '@pancakeswap/widgets-internal'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmSwapModalContainer from 'views/Swap/components/ConfirmSwapModalContainer'
import { SwapTransactionErrorContent } from 'views/Swap/components/SwapTransactionErrorContent'
import { ArcanaConfirmBridgeModalProps, ExtendedBridgingState } from './types'

const ArcanaAllowanceContent = ({ allowanceModal }: { allowanceModal: any }) => {
  const { t } = useTranslation()
  const { toastSuccess, toastError } = useToast()
  const [allowanceChoices, setAllowanceChoices] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (Array.isArray(allowanceModal?.data.sources)) {
      const initialChoices = allowanceModal.data.sources.reduce((acc, source) => {
        return {
          ...acc,
          [`${source.chainID}-${source.token}`]: String(source.minAllowance) || 'min',
        }
      }, {})
      setAllowanceChoices(initialChoices)
    }
  }, [allowanceModal?.data.sources])

  const handleAllowanceChange = (sourceKey: string, value: string) => {
    setAllowanceChoices((prev) => ({ ...prev, [sourceKey]: value }))
  }

  const handleAllow = () => {
    if (!allowanceModal || !Array.isArray(allowanceModal.data.sources)) return
    const allowances = allowanceModal.data.sources.map((source) => {
      const choice = allowanceChoices[`${source.chainID}-${source.token}`]
      return choice
    })
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
        allowanceModalData.sources.map((source, index) => {
          const sourceKey = `${source.chainID}-${source.token}`
          return (
            <Box key={source.token} mb="16px" p="8px" border="1px solid" borderColor="cardBorder" borderRadius="4px">
              <Text bold>
                {source.token} ({t('Chain ID')}: {source.chainID})
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

const ArcanaIntentContent = ({ intentModal }: { intentModal: any }) => {
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
          <Text key={source?.amount} fontSize="12px">
            -{' '}
            {t('Use %amount% on %chainName%', {
              amount: source.amount,
              chainName: source.chainName,
            })}
          </Text>
        ))}
        <Text fontSize="12px" mt="4px">
          - {t('Total Gas: %gas% ', { gas: intentData.fees.caGas })}
        </Text>
        <Text fontSize="12px" mt="4px">
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

const ArcanaConfirmBridgeContent = ({
  inputCurrency,
  outputCurrency,
  inputChain,
  outputChain,
  inputAmount,
  outputAmount,
  onConfirm,
  sourceChain,
}: Pick<
  ArcanaConfirmBridgeModalProps,
  | 'inputCurrency'
  | 'outputCurrency'
  | 'inputChain'
  | 'outputChain'
  | 'inputAmount'
  | 'outputAmount'
  | 'onConfirm'
  | 'sourceChain'
>) => {
  const { t } = useTranslation()

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" mb="16px">
        <Flex alignItems="center">
          <CurrencyLogo currency={inputAmount?.currency} size="32px" />
          <Text bold ml="8px">
            {inputAmount?.toSignificant(6)}
          </Text>
        </Flex>
        <Flex alignItems="flex-end" flexDirection="column">
          <Text bold>{inputCurrency?.symbol}</Text>
          <Text fontSize="12px" color="textSubtle">
            ({t('From %chain%', { chain: sourceChain?.name })})
          </Text>
        </Flex>
      </Flex>

      <Flex justifyContent="center" alignItems="center" my="4px">
        <ArrowDownIcon color="textSubtle" width="24px" />
      </Flex>

      <Flex justifyContent="space-between" alignItems="center" mb="16px">
        <Flex alignItems="center">
          <CurrencyLogo currency={inputCurrency ?? undefined} size="32px" />
          <Text bold ml="8px" color="textDisabled">
            {t('Swap')}...
          </Text>
        </Flex>
        <Flex alignItems="flex-end" flexDirection="column">
          <Text bold>{inputCurrency?.symbol}</Text>
          <Text fontSize="12px" color="textSubtle">
            ({t('On %chain%', { chain: inputChain?.name })})
          </Text>
        </Flex>
      </Flex>

      <Flex justifyContent="center" alignItems="center" my="4px">
        <ArrowDownIcon color="textSubtle" width="24px" />
      </Flex>
      {outputCurrency && outputAmount && (
        <Flex justifyContent="space-between" alignItems="center" mt="16px" mb="24px">
          <Flex alignItems="center">
            <CurrencyLogo currency={outputCurrency ?? undefined} size="32px" />
            <Text bold ml="8px">
              ~{outputAmount?.toSignificant(6)}
            </Text>
          </Flex>
          <Flex alignItems="flex-end" flexDirection="column">
            <Text bold>{outputCurrency.symbol}</Text>
            <Text fontSize="12px" color="textSubtle">
              ({t('To %chain%', { chain: outputChain?.name })})
            </Text>
          </Flex>
        </Flex>
      )}

      <Text fontSize="14px" color="textSubtle" textAlign="center" mb="24px">
        {t('This transaction uses Nexus for cross-chain swaps.')}
      </Text>
      <Button width="100%" onClick={onConfirm}>
        {t('Confirm Swap')}
      </Button>
    </Box>
  )
}

const INTERRUPTIBLE_STATES: ExtendedBridgingState[] = ['idle', 'success', 'error']

export const ArcanaConfirmBridgeModal: React.FC<ArcanaConfirmBridgeModalProps> = ({
  inputCurrency,
  outputCurrency,
  inputChain,
  outputChain,
  sourceChain,
  inputAmount,
  outputAmount,
  onConfirm,
  bridgingState: executionBridgingState,
  errorMessage,
  txHash,
  onDismiss,
  allowanceModal,
  intentModal,
}) => {
  const { t } = useTranslation()

  console.log(
    '[ArcanaBridgeModal] Received props: executionBridgingState=',
    executionBridgingState,
    'allowanceModal=',
    !!allowanceModal,
    'intentModal=',
    !!intentModal,
  )

  const currentModalState = useMemo(() => {
    console.log(
      '[ArcanaBridgeModal] Calculating currentModalState. executionBridgingState:',
      executionBridgingState,
      'allowanceModal:',
      !!allowanceModal,
      'intentModal:',
      !!intentModal,
    )
    if (allowanceModal) return 'allowance_request'
    if (intentModal) return 'intent_request'
    return executionBridgingState
  }, [allowanceModal, intentModal, executionBridgingState])

  const handleDismiss = useCallback(() => {
    if (currentModalState === 'allowance_request') {
      allowanceModal?.reject('User dismissed modal')
    } else if (currentModalState === 'intent_request') {
      intentModal?.reject('User dismissed modal')
    }
    if (INTERRUPTIBLE_STATES.includes(executionBridgingState)) {
      onDismiss?.()
    } else {
      console.log('Dismissal prevented during non-interruptible operation:', executionBridgingState)
    }
  }, [onDismiss, currentModalState, executionBridgingState, allowanceModal, intentModal])

  const modalContent = useMemo(() => {
    const amountDisplay = inputAmount?.toSignificant(6) ?? ''
    const inputSymbol = inputCurrency?.symbol ?? ''
    const outputSymbol = outputCurrency?.symbol ?? ''
    const targetChainName = outputChain?.name ?? t('Target Chain')

    if (currentModalState === 'allowance_request') {
      return <ArcanaAllowanceContent allowanceModal={allowanceModal} />
    }
    if (currentModalState === 'intent_request') {
      return <ArcanaIntentContent intentModal={intentModal} />
    }
    if (errorMessage && currentModalState === 'error') {
      return (
        <Flex width="100%" alignItems="center" minHeight="250px">
          <SwapTransactionErrorContent message={errorMessage} onDismiss={handleDismiss} openSettingModal={undefined} />
        </Flex>
      )
    }

    if (
      ['pending', 'bridging_in', 'swapping', 'bridging_out'].includes(currentModalState) &&
      inputCurrency &&
      outputCurrency
    ) {
      let title: string
      let step: ConfirmModalState
      switch (currentModalState) {
        case 'bridging_in':
          title = t('Bridging to Swap Chain...')
          step = ConfirmModalState.APPROVING_TOKEN
          break
        case 'swapping':
          title = t('Executing Swap...')
          step = ConfirmModalState.PERMITTING
          break
        case 'bridging_out':
          title = t('Bridging to Destination...')
          step = ConfirmModalState.PENDING_CONFIRMATION
          break
        default:
          title = t('Processing Request...')
          step = ConfirmModalState.REVIEWING
          break
      }

      return (
        <SwapPendingModalContent
          title={title}
          currencyA={inputCurrency}
          currencyB={outputCurrency}
          amountA={amountDisplay}
          amountB={outputAmount?.toSignificant(6) ?? t('Processing...')}
          currentStep={step}
        />
      )
    }

    if (currentModalState === 'success') {
      const explorerLinkContent = txHash ? (
        <LinkExternal href={`EXPLORER_URL/${txHash}`}>
          {' '}
          {/* Replace EXPLORER_URL with actual logic */}
          {t('View Last Tx: %hash%', { hash: truncateHash(txHash) })}
        </LinkExternal>
      ) : (
        <></>
      )

      return (
        <SwapTransactionReceiptModalContent explorerLink={explorerLinkContent}>
          <Text fontSize="20px" bold mb="16px" textAlign="center">
            {t('Swap Request Successful!')}
          </Text>
          <Text fontSize="14px" textAlign="center" mb="8px">
            {t('Your request to swap %amountA% %symbolA% for %symbolB% via Nexus has completed.', {
              amountA: amountDisplay,
              symbolA: inputSymbol,
              symbolB: outputSymbol,
            })}
          </Text>
          <Text fontSize="12px" color="textSubtle" textAlign="center">
            {t('The assets should be available in your wallet on %chain%.', { chain: targetChainName })}
          </Text>
          <Button variant="primary" onClick={handleDismiss} mt="16px">
            {t('Close')}
          </Button>
        </SwapTransactionReceiptModalContent>
      )
    }

    return (
      <ArcanaConfirmBridgeContent
        inputCurrency={inputCurrency}
        outputCurrency={outputCurrency}
        inputChain={inputChain}
        sourceChain={sourceChain}
        outputChain={outputChain}
        inputAmount={inputAmount}
        outputAmount={outputAmount}
        onConfirm={onConfirm}
      />
    )
  }, [
    currentModalState,
    errorMessage,
    handleDismiss,
    t,
    inputCurrency,
    outputCurrency,
    inputChain,
    outputChain,
    sourceChain,
    inputAmount,
    outputAmount,
    txHash,
    onConfirm,
    allowanceModal,
    intentModal,
  ])

  const hideTitleAndBackground = useMemo(() => {
    return (
      currentModalState !== 'idle' &&
      currentModalState !== 'allowance_request' &&
      currentModalState !== 'intent_request'
    )
  }, [currentModalState])

  const modalTitle = useMemo(() => {
    switch (currentModalState) {
      case 'idle':
        return t('Confirm Bridge & Swap')
      case 'allowance_request':
        return t('Approve Allowances')
      case 'intent_request':
        return t('Confirm Transaction')
      default:
        return ''
    }
  }, [currentModalState, t])

  return (
    <ConfirmSwapModalContainer
      title={modalTitle}
      minHeight={currentModalState === 'error' ? 'auto' : '350px'}
      width={['100%', '100%', '100%', '420px']}
      hideTitleAndBackground={hideTitleAndBackground}
      bodyPadding={hideTitleAndBackground ? '24px' : '0 24px 24px 24px'}
      handleDismiss={handleDismiss}
    >
      <Box>{modalContent}</Box>
    </ConfirmSwapModalContainer>
  )
}
