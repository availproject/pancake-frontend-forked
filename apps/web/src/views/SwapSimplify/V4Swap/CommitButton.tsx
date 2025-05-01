import { InterfaceOrder } from 'views/Swap/utils'
import { SwapCommitButton } from './SwapCommitButton'

export type CommitButtonProps = {
  order: InterfaceOrder | undefined
  tradeError?: Error | null
  tradeLoaded: boolean
  refreshOrder?: () => void
  beforeCommit?: () => void
  afterCommit?: () => void
  withArcana?: boolean
}

export const CommitButton: React.FC<CommitButtonProps> = ({
  order,
  tradeError,
  tradeLoaded,
  refreshOrder,
  beforeCommit,
  afterCommit,
  withArcana = false,
}) => {
  return (
    <SwapCommitButton
      order={order}
      tradeError={tradeError}
      tradeLoading={!tradeLoaded}
      refreshOrder={refreshOrder}
      beforeCommit={beforeCommit}
      afterCommit={afterCommit}
      withArcana={withArcana}
    />
  )
}
