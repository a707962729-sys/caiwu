/**
 * AI Tools - 模块入口
 */
const { tools, toolMap } = require('./definitions');
const { executeTool } = require('./executor');
const { shouldCallTool, detectIntent, extractParams } = require('./intent');

function getToolDefinitions() {
  return tools.map(t => ({
    type: t.type,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters
    }
  }));
}

module.exports = {
  tools,
  toolMap,
  getToolDefinitions,
  executeTool,
  shouldCallTool,
  detectIntent,
  extractParams
};
