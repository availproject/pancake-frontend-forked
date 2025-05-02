import { CA } from '@arcana/ca-sdk'
import Decimal from 'decimal.js'
import { RetryableError, retry } from 'state/multicall/retry'
import { publicClient } from 'utils/wagmi'
import { Hex, TransactionNotFoundError, TransactionReceipt, TransactionReceiptNotFoundError } from 'viem'

export const retryWaitForTransaction = async ({
  hash,
  chainId,
  confirmations,
}: {
  hash?: Hex
  chainId?: number
  confirmations?: number
}) => {
  if (hash && chainId) {
    let retryTimes = 0
    const getReceipt = async () => {
      console.info('retryWaitForTransaction', hash, retryTimes++)
      try {
        return await publicClient({ chainId }).waitForTransactionReceipt({
          hash,
          confirmations,
        })
      } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError || error instanceof TransactionNotFoundError) {
          throw new RetryableError()
        }
        throw error
      }
    }
    const { promise } = retry<TransactionReceipt>(getReceipt, {
      n: 6,
      minWait: 2000,
      maxWait: confirmations ? confirmations * 5000 : 5000,
    })
    return promise
  }
  return undefined
}

export async function getBalanceOnChain(
  ca: CA,
  tokenSymbol: string,
  chainId: number,
): Promise<{ balance: Decimal; balanceStr: string } | null> {
  try {
    const balances = await ca.getUnifiedBalances()
    const tokenBalance = balances?.find((b) => b.symbol.toUpperCase() === tokenSymbol.toUpperCase())
    const chainBalanceInfo = tokenBalance?.breakdown?.find((bd) => bd.chain?.id === chainId)
    const balanceStr = chainBalanceInfo?.balance
    return balanceStr ? { balance: new Decimal(balanceStr), balanceStr } : { balance: new Decimal(0), balanceStr: '0' }
  } catch (error) {
    console.error(`Error fetching balance for ${tokenSymbol} on chain ${chainId}:`, error)
    return null
  }
}

export async function waitForBalanceUpdate(
  ca: CA,
  tokenSymbol: string,
  targetChainId: number,
  expectedMinimumAmount: Decimal,
  timeoutMs: number = 120000,
  pollIntervalMs: number = 5000,
): Promise<{ balance: Decimal; balanceStr: string } | null> {
  const startTime = Date.now()
  console.log(
    `Polling for balance update: ${tokenSymbol} on chain ${targetChainId}. Expecting >= ${expectedMinimumAmount.toString()}`,
  )

  const initialBalanceInfo = await getBalanceOnChain(ca, tokenSymbol, targetChainId)
  if (initialBalanceInfo && initialBalanceInfo.balance.gte(expectedMinimumAmount)) {
    console.log(`Balance confirmed immediately for ${tokenSymbol}: ${initialBalanceInfo.balanceStr}`)
    return initialBalanceInfo
  }
  console.log(`Initial balance: ${initialBalanceInfo?.balanceStr ?? 'N/A'}`)

  return new Promise((resolve) => {
    const checkBalance = async () => {
      const currentBalanceInfo = await getBalanceOnChain(ca, tokenSymbol, targetChainId)

      if (currentBalanceInfo && currentBalanceInfo.balance.gte(expectedMinimumAmount)) {
        console.log(`Balance confirmed for ${tokenSymbol} on chain ${targetChainId}: ${currentBalanceInfo.balanceStr}`)
        resolve(currentBalanceInfo)
        return
      }

      console.log(
        `Polling balance for ${tokenSymbol} on chain ${targetChainId}... Current: ${
          currentBalanceInfo?.balanceStr ?? 'N/A'
        }`,
      )

      if (Date.now() - startTime < timeoutMs) {
        setTimeout(checkBalance, pollIntervalMs)
      } else {
        console.error(`Timeout waiting for balance update for ${tokenSymbol} on chain ${targetChainId}`)
        resolve(null)
      }
    }

    checkBalance()
  })
}
