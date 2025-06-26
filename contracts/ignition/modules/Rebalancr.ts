
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RebalancrModule = buildModule("RebalancrModule", (m) => {
  const positionManager = m.contract("PositionManager");
  return {positionManager}
});

export default RebalancrModule;
