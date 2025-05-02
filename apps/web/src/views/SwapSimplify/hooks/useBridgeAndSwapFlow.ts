import { useArcana } from 'contexts/ArcanaProvider'
import Decimal from 'decimal.js'
import { useCallback } from 'react'
import { waitForBalanceUpdate } from '../Arcana/utils/util'

interface ArcanaBridgeProps {
  tokenSymbol: string
  amount: string
  targetChainId: number
  callback?: (updatedAmount: string) => void
}

function useArcanaBridge() {
  const { ca } = useArcana()

  const arcanaBridge = useCallback(
    async ({ tokenSymbol, amount, targetChainId, callback }: ArcanaBridgeProps) => {
      if (!ca) {
        throw new Error('Arcana client not found')
      }
      try {
        await ca.bridge().token(tokenSymbol).amount(amount).chain(targetChainId).exec()
        const updatedAmount = await waitForBalanceUpdate(ca, tokenSymbol, targetChainId, new Decimal(amount))
        callback?.(updatedAmount?.balanceStr ?? amount)
      } catch (error) {
        console.error('Bridge failed:', error)
        throw error
      }
    },
    [ca],
  )

  return {
    arcanaBridge,
  }
}

export default useArcanaBridge
