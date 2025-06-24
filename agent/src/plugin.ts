import type { Plugin } from "@elizaos/core";
import { logger } from "@elizaos/core";

const plugin: Plugin = {
  name: "plugin-base",
  description: "Base plugin for Rebalncr",
  priority: 100,
  config: {},
  async init(config: Record<string, string>) {
    logger.info('+++++++++++++++++++++++ Plugin Loaded (base)');
  },
  routes: [],
  events: {},
  services: [],
  actions: [],
  evaluators: [],
  providers: [],
};

export default plugin;
