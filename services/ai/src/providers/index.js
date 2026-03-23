/**
 * AI 提供商工厂
 */
const OpenAIProvider = require('./openai');
const AnthropicProvider = require('./anthropic');
const OllamaProvider = require('./ollama');
const MockProvider = require('./mock');
const config = require('../config');

const providers = {
  openai: () => new OpenAIProvider(config.providers?.openai || {}),
  anthropic: () => new AnthropicProvider(config.providers?.anthropic || {}),
  ollama: () => new OllamaProvider(config.providers?.ollama || {}),
  mock: () => new MockProvider({})
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