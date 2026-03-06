export const config = {
    platform: import.meta.env.VITE_PLATFORM || 'development',
    apiKey: process.env.API_KEY || '', // Polyfilled by Vite define
};

export const isCloudflare = config.platform === 'cloudflare';
export const isCpanel = config.platform === 'cpanel';
