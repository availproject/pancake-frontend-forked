import { useEffect } from 'react'
import { useAccount } from 'wagmi'

function useSentryUser() {
  const { address: account } = useAccount()
  useEffect(() => {
    if (account) {
      console.log('account', account)
    }
  }, [account])
}

export default useSentryUser
