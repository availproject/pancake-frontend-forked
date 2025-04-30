import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import { ArrowDownIcon, Box, Button, Flex, InjectedModalProps, Text } from '@pancakeswap/uikit'
import truncateHash from '@pancakeswap/utils/truncateHash'
import {
  ConfirmModalState,
  CurrencyLogo,
  SwapPendingModalContent,
  SwapTransactionReceiptModalContent,
} from '@pancakeswap/widgets-internal'
import { useCallback, useMemo } from 'react'
import ConfirmSwapModalContainer from 'views/Swap/components/ConfirmSwapModalContainer'
import { SwapTransactionErrorContent } from 'views/Swap/components/SwapTransactionErrorContent'
import { Chain } from 'wagmi/chains'

export type ArcanaBridgingState = 'idle' | 'pending' | 'success' | 'error' | 'checking_chains'

interface ArcanaConfirmBridgeModalProps extends InjectedModalProps {
  inputCurrency?: Currency | null
  outputCurrency?: Currency | null
  inputChain?: Chain | null
  outputChain?: Chain | null
  sourceChain?: Chain | null
  inputAmount?: CurrencyAmount<Currency> | null
  outputAmount?: CurrencyAmount<Currency> | null
  bridgingState: ArcanaBridgingState
  errorMessage?: string | null
  txHash?: string | null
  onConfirm: () => void
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

  if (!inputCurrency || !inputChain || !outputChain || !sourceChain || !inputAmount || !outputAmount) {
    return (
      <Flex justifyContent="center" alignItems="center" minHeight="200px">
        <Text color="failure">{t('Missing bridge information. Please check selection.')}</Text>
      </Flex>
    )
  }

  console.log('info display', {
    inputCurrency,
    outputCurrency,
    inputChain,
    outputChain,
    sourceChain,
    inputAmount,
    outputAmount,
  })

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
          <Text bold>{inputCurrency.symbol}</Text>
          <Text fontSize="12px" color="textSubtle">
            ({t('From %chain%', { chain: sourceChain.name })})
          </Text>
        </Flex>
      </Flex>

      <Flex justifyContent="center" alignItems="center" my="4px">
        <ArrowDownIcon color="textSubtle" width="24px" />
      </Flex>

      <Flex justifyContent="space-between" alignItems="center" mb="16px">
        <Flex alignItems="center">
          <CurrencyLogo currency={inputCurrency} size="32px" />
          <Text bold ml="8px" color="textDisabled">
            {t('Receiving...')}
          </Text>
        </Flex>
        <Flex alignItems="flex-end" flexDirection="column">
          <Text bold>{inputCurrency.symbol}</Text>
          <Text fontSize="12px" color="textSubtle">
            ({t('To %chain%', { chain: inputChain.name })})
          </Text>
        </Flex>
      </Flex>

      <Flex justifyContent="center" alignItems="center" my="4px">
        <ArrowDownIcon color="textSubtle" width="24px" />
      </Flex>
      {outputCurrency && outputAmount && (
        <Flex justifyContent="space-between" alignItems="center" mt="16px" mb="24px">
          <Flex alignItems="center">
            <CurrencyLogo currency={outputCurrency} size="32px" />
            <Text bold ml="8px">
              {outputAmount?.toSignificant(6)}
            </Text>
          </Flex>
          <Flex alignItems="flex-end" flexDirection="column">
            <Text bold>{outputCurrency.symbol}</Text>
            <Text fontSize="12px" color="textSubtle">
              ({t('To %chain%', { chain: outputChain.name })})
            </Text>
          </Flex>
        </Flex>
      )}

      <Text fontSize="14px" color="textSubtle" textAlign="center" mb="24px">
        {t('You are swapping assets directly using Nexus.')}
      </Text>
      <Button width="100%" onClick={onConfirm}>
        {t('Confirm Swap')}
      </Button>
    </Box>
  )
}

export const ArcanaConfirmBridgeModal: React.FC<ArcanaConfirmBridgeModalProps> = ({
  inputCurrency,
  outputCurrency,
  inputChain,
  outputChain,
  sourceChain,
  inputAmount,
  outputAmount,
  bridgingState,
  errorMessage,
  txHash,
  onConfirm,
  onDismiss,
}) => {
  const { t } = useTranslation()

  const handleDismiss = useCallback(() => {
    onDismiss?.()
  }, [onDismiss])

  const modalContent = useMemo(() => {
    const amountDisplay = inputAmount?.toSignificant(6) ?? ''
    const displaySymbol = inputCurrency?.symbol ?? ''
    const sourceChainName = inputChain?.name ?? t('Source Chain')
    const targetChainName = outputChain?.name ?? t('Target Chain')

    if (errorMessage && bridgingState === 'error') {
      return (
        <Flex width="100%" alignItems="center" minHeight="250px">
          <SwapTransactionErrorContent message={errorMessage} onDismiss={handleDismiss} openSettingModal={undefined} />
        </Flex>
      )
    }

    if (bridgingState === 'pending' && inputCurrency && outputCurrency) {
      return (
        <SwapPendingModalContent
          title={t('Bridging Assets')}
          currencyA={inputCurrency}
          currencyB={outputCurrency}
          amountA={amountDisplay}
          amountB={t('Receiving...')}
          currentStep={ConfirmModalState.PENDING_CONFIRMATION}
        />
      )
    }

    if (bridgingState === 'success') {
      const explorerLinkContent = txHash ? (
        <Text fontSize="12px" color="textSubtle" textAlign="center" mt="8px">
          {t('Transaction ID: %hash%', { hash: truncateHash(txHash) })}
        </Text>
      ) : (
        <></>
      )

      return (
        <SwapTransactionReceiptModalContent explorerLink={explorerLinkContent}>
          <Text fontSize="20px" bold mb="16px" textAlign="center">
            {t('Bridge Submitted!')}
          </Text>
          <Text fontSize="14px" textAlign="center" mb="8px">
            {t(
              'Your request to bridge %amount% %symbol% from %sourceChainName% to %targetChainName% has been submitted.',
              {
                amount: amountDisplay,
                symbol: displaySymbol,
                sourceChainName,
                targetChainName,
              },
            )}
          </Text>
          <Text fontSize="12px" color="textSubtle" textAlign="center">
            {t('The assets will arrive in your wallet on %chain% shortly.', { chain: targetChainName })}
          </Text>
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
    errorMessage,
    bridgingState,
    handleDismiss,
    t,
    inputCurrency,
    inputChain,
    outputChain,
    inputAmount,
    outputAmount,
    txHash,
    onConfirm,
  ])

  const hideTitleAndBackground = useMemo(() => {
    return bridgingState !== 'idle'
  }, [bridgingState])

  const modalTitle = useMemo(() => {
    if (bridgingState === 'idle') return t('Confirm Bridge')
    return ''
  }, [bridgingState, t])

  return (
    <ConfirmSwapModalContainer
      title={modalTitle}
      minHeight={bridgingState === 'error' ? 'auto' : '350px'}
      width={['100%', '100%', '100%', '420px']}
      hideTitleAndBackground={hideTitleAndBackground}
      bodyPadding={bridgingState === 'idle' ? '0 24px 24px 24px' : '24px'}
      handleDismiss={handleDismiss}
    >
      <Box>{modalContent}</Box>
    </ConfirmSwapModalContainer>
  )
}
