import { CA } from '@arcana/ca-sdk'
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

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
}

interface ArcanaContextType {
  ca: CA | null
  isLoading: boolean
  error: Error | null
  allowanceModal: AllowanceModalTrigger | null
  intentModal: IntentModalTrigger | null
  initArcana: () => Promise<void>
  arcanaBridge: (props: ArcanaBridgeProps) => Promise<void>
}

const ArcanaContext = createContext<ArcanaContextType | undefined>(undefined)

const ArcanaProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [ca, setCa] = useState<CA | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
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
    async ({ tokenSymbol, amount, targetChainId }: ArcanaBridgeProps) => {
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
      allowanceModal,
      intentModal,
      initArcana,
      arcanaBridge,
    }),
    [ca, isLoading, error, allowanceModal, intentModal],
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
