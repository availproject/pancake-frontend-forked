import { CA } from '@arcana/ca-sdk'
import React, { createContext, Dispatch, SetStateAction, useCallback, useContext, useMemo, useState } from 'react'

export type ArcanaBridgingState =
  | 'idle'
  | 'pending'
  | 'bridging_in'
  | 'swapping'
  | 'bridging_out'
  | 'success'
  | 'error'
  | 'checking_chains'
  | 'fetching_quote'
  | 'waiting_for_swap_trigger'
  | 'waiting_for_balance_update'
  | 'updating_swap_input'
  | 'waiting_for_second_bridge'
  | 'second_bridge_pending'
  | 'second_bridge_success'

interface AllowanceRequestData {
  sources: any[]
}

interface IntentRequestData {
  intent: any
  refresh: () => void
}

export interface AllowanceModalTrigger {
  data: AllowanceRequestData
  resolve: (allowances: any[]) => void
  reject: (reason?: any) => void
}

export interface IntentModalTrigger {
  data: IntentRequestData
  resolve: () => void
  reject: (reason?: any) => void
}

export interface ArcanaBridgeProps {
  tokenSymbol: string
  amount: string
  targetChainId: number
  callback: (updatedAmount: string) => void
}

interface ArcanaContextType {
  ca: CA | null
  isLoading: boolean
  error: Error | null
  bridgingState: ArcanaBridgingState
  setBridgingState: Dispatch<SetStateAction<ArcanaBridgingState>>
  allowanceModal: AllowanceModalTrigger | null
  setAllowanceModal: Dispatch<SetStateAction<AllowanceModalTrigger | null>>
  intentModal: IntentModalTrigger | null
  setIntentModal: Dispatch<SetStateAction<IntentModalTrigger | null>>
  initArcana: () => Promise<void>
  arcanaBridge: (props: ArcanaBridgeProps) => Promise<void>
}

const ArcanaContext = createContext<ArcanaContextType | undefined>(undefined)

const ArcanaProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [ca, setCa] = useState<CA | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [bridgingState, setBridgingState] = useState<ArcanaBridgingState>('idle')
  const [allowanceModal, setAllowanceModal] = useState<AllowanceModalTrigger | null>(null)
  const [intentModal, setIntentModal] = useState<IntentModalTrigger | null>(null)

  const initArcana = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setAllowanceModal(null)
    setIntentModal(null)

    if (typeof window === 'undefined' || !window.ethereum) {
      console.error('Window or Ethereum provider not available for Arcana initialization.')
      setError(new Error('Ethereum provider not available'))
      setIsLoading(false)
      return
    }

    const provider = window?.ethereum
    console.log('provider object being passed to Arcana:', provider)
    const caInstance = new CA()
    caInstance.setEVMProvider(provider as any)

    try {
      await caInstance.init()
      setCa(caInstance)
      console.log('Arcana CA initialized successfully.')
      caInstance.setOnAllowanceHook(async ({ allow, deny, sources }) => {
        console.log('setOnAllowanceHook triggered:', sources)
        try {
          const chosenAllowances = await new Promise<any[]>((resolve, reject) => {
            setAllowanceModal({ data: { sources }, resolve, reject })
          })
          console.log('Allowance approved via UI:', chosenAllowances)
          allow(chosenAllowances)
        } catch (rejectionReason) {
          console.log('Allowance denied via UI:', rejectionReason)
          deny()
        } finally {
          setAllowanceModal(null)
        }
      })

      caInstance.setOnIntentHook(({ intent, allow, deny, refresh }) => {
        console.log('setOnIntentHook triggered:', intent)
        new Promise<void>((resolve, reject) => {
          setIntentModal({ data: { intent, refresh }, resolve, reject })
        })
          .then(() => {
            console.log('Intent approved via UI.')
            allow()
          })
          .catch((rejectionReason) => {
            console.log('Intent denied via UI:', rejectionReason)
            deny()
          })
          .finally(() => {
            setIntentModal(null)
          })
      })
    } catch (err) {
      console.error('Failed to initialize Arcana CA or set hooks:', err)
      setError(err instanceof Error ? err : new Error('Failed to initialize Arcana CA'))
    } finally {
      setIsLoading(false)
    }
  }, [setAllowanceModal, setIntentModal])

  const arcanaBridge = useCallback(
    async ({ tokenSymbol, amount, targetChainId, callback }: ArcanaBridgeProps) => {
      if (!ca) {
        throw new Error('Arcana client not found')
      }
      try {
        await ca.bridge().token(tokenSymbol).amount(amount).chain(targetChainId).exec()
      } catch (bridgeError) {
        console.error('Bridge failed:', bridgeError)
        throw bridgeError
      }
    },
    [ca],
  )

  const contextValue = useMemo(
    () => ({
      ca,
      isLoading,
      error,
      bridgingState,
      setBridgingState,
      allowanceModal,
      setAllowanceModal,
      intentModal,
      setIntentModal,
      initArcana,
      arcanaBridge,
    }),
    [ca, isLoading, error, bridgingState, allowanceModal, intentModal],
  )

  return <ArcanaContext.Provider value={contextValue}>{children}</ArcanaContext.Provider>
}

export const useArcana = (): ArcanaContextType => {
  const context = useContext(ArcanaContext)
  if (context === undefined) {
    throw new Error('useArcana must be used within an ArcanaProvider')
  }
  return context
}

export default ArcanaProvider
