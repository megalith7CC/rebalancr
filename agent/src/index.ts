import { type Project } from "@elizaos/core";
import yieldCharacter from "./character/yield";
import providers from "./provider";
import actions from "./action";
import basePlugin from "./plugin";


const project: Project = {
  agents: [
    {
      character: yieldCharacter,
      plugins: [basePlugin],
      init: async (runtime) => {
        // Register all providers
        providers.forEach(provider => runtime.registerProvider(provider));
        
        // Register all actions
        actions.forEach(action => runtime.registerAction(action));
        
        console.log("YieldAgent initialized with providers and actions");
      }
    }
  ],
};

export default project;
