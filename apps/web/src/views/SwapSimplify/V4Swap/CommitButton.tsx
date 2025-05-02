import { InterfaceOrder } from 'views/Swap/utils'
import { SwapCommitButton } from './SwapCommitButton'

export type CommitButtonProps = {
  order: InterfaceOrder | undefined
  tradeError?: Error | null
  tradeLoaded: boolean
  refreshOrder?: () => void
  beforeCommit?: () => void
  afterCommit?: () => void
}

export const CommitButton: React.FC<CommitButtonProps> = ({
  order,
  tradeError,
  tradeLoaded,
  refreshOrder,
  beforeCommit,
  afterCommit,
}) => {
  return (
    <SwapCommitButton
      order={order}
      tradeError={tradeError}
      tradeLoading={!tradeLoaded}
      refreshOrder={refreshOrder}
      beforeCommit={beforeCommit}
      afterCommit={afterCommit}
    />
  )
}
