import { MotionBox, TooltipText, useTooltip, WalletFilledV2Icon } from "@pancakeswap/uikit";
import { memo, useMemo } from "react";
import { styled } from "styled-components";
import { truncateDecimals } from "../utils/numbers";

const StyledText = styled(TooltipText)`
  font-size: 12px;
  font-weight: 600;
`;

const Wrapper = styled(MotionBox)`
  position: absolute;
  top: 0;
  right: 0px;
  display: flex;
  gap: 2px;
  transition: opacity 0.2s ease-in, transform 0.2s ease-in-out;
  &.clickable {
    cursor: pointer;
    &:hover {
      opacity: 0.8;
      transform: scale(1.02);
    }
    &:active {
      transform: scale(1);
    }
  }
`;

export const WalletAssetDisplay: React.FC<{
  onMax?: () => void;
  balance?: string;
  isUserInsufficientBalance?: boolean;
  balanceOnSelectedChain?: string;
  chainName?: string;
  symbol?: string;
}> = memo(({ balance, onMax, isUserInsufficientBalance, balanceOnSelectedChain, chainName, symbol }) => {
  const toolTipContent = useMemo(() => {
    if (chainName && balanceOnSelectedChain) {
      return `Total ${symbol} Balance: ${balance} \n ${symbol} Balance on ${chainName ?? ""}: ${
        balanceOnSelectedChain ?? ""
      }`;
    }
    return balance ?? "";
  }, [balance, balanceOnSelectedChain, chainName]);

  const { targetRef, tooltip, tooltipVisible } = useTooltip(toolTipContent, {
    placement: "right",
    avoidToStopPropagation: true,
  });

  return (
    <Wrapper
      key="WalletAssetDisplay"
      initial={{ x: -2, opacity: 0 }}
      animate={{ x: 0, opacity: 1, transition: { duration: 0.05, delay: 0.2 } }}
      exit={{ x: 2, opacity: 0 }}
      className={onMax ? "clickable" : undefined}
      onClick={onMax}
    >
      <WalletFilledV2Icon color={isUserInsufficientBalance ? "#D14293" : "textSubtle"} width="16px" />
      <StyledText ref={targetRef} color={isUserInsufficientBalance ? "#D14293" : "textSubtle"}>
        {truncateDecimals(balance)}
      </StyledText>
      {tooltipVisible && tooltip}
    </Wrapper>
  );
});
