/**
 * AI 提供商工厂
 */
const OpenAIProvider = require('./openai');
const AnthropicProvider = require('./anthropic');
const OllamaProvider = require('./ollama');
const MockProvider = require('./mock');
const KimiProvider = require('./kimi');
const GLMFlashProvider = require('./glm-flash');
const config = require('../config');

const providers = {
  openai: () => new OpenAIProvider(config.providers?.openai || {}),
  anthropic: () => new AnthropicProvider(config.providers?.anthropic || {}),
  ollama: () => new OllamaProvider(config.providers?.ollama || {}),
  mock: () => new MockProvider({}),
  kimi: () => new KimiProvider(config.providers?.kimi || {}),
  'glm-flash': () => new GLMFlashProvider({
    apiKey: process.env.GLM_API_KEY || config.providers?.glmFlash?.apiKey || '',
    baseUrl: process.env.GLM_BASE_URL || config.providers?.glmFlash?.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || config.providers?.glmFlash?.model || 'glm-4-flash'
  })
};

let currentProvider = null;

/**
 * 获取 AI 提供商实例
 */
function getProvider(name) {
  const providerName = name || config.ai?.provider || 'mock';
  
  if (!providers[providerName]) {
    throw new Error(`Unknown AI provider: ${providerName}`);
  }
  
  return providers[providerName]();
}

/**
 * 注册自定义提供商
 */
function registerProvider(name, providerClass) {
  providers[name] = () => new providerClass(config.providers?.[name] || {});
}

module.exports = {
  getProvider,
  registerProvider
};