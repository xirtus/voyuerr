import type { ProxySettings } from '@server/lib/settings';
import logger from '@server/logger';

/**
 * VPN-aware proxy configuration utility.
 *
 * Extends the existing HTTP proxy support with SOCKS5 proxy capabilities
 * for enhanced VPN tunneling. SOCKS5 proxies are commonly provided by VPN
 * services (Mullvad, ProtonVPN, etc.) and offer better protocol support
 * for torrenting and adult content acquisition.
 *
 * Phase 6 — Privacy & Security Hardening
 */

/** Extended proxy settings including SOCKS5 support. */
export interface VpnProxySettings extends ProxySettings {
  /** Proxy type: 'http' (default) or 'socks5' */
  proxyType?: 'http' | 'socks5';
  /** SOCKS5 authentication username */
  socksUser?: string;
  /** SOCKS5 authentication password */
  socksPassword?: string;
}

/**
 * Build a proxy URL from settings.
 * Returns a standard proxy URL string or null if proxy is disabled.
 */
export function buildProxyUrl(settings: VpnProxySettings): string | null {
  if (!settings.enabled) return null;

  const proto = settings.useSsl ? 'https' : 'http';
  const socksProto = settings.proxyType === 'socks5' ? 'socks5' : undefined;

  if (settings.user && settings.password) {
    // HTTP proxy with auth
    return `${proto}://${settings.user}:${settings.password}@${settings.hostname}:${settings.port}`;
  }

  if (socksProto && settings.socksUser && settings.socksPassword) {
    // SOCKS5 with auth
    return `${socksProto}://${settings.socksUser}:${settings.socksPassword}@${settings.hostname}:${settings.port}`;
  }

  if (socksProto) {
    return `${socksProto}://${settings.hostname}:${settings.port}`;
  }

  return `${proto}://${settings.hostname}:${settings.port}`;
}

/**
 * Create an environment-ready proxy configuration object.
 * Can be used with axios, undici, or passed to child processes.
 */
export function getProxyEnv(settings: VpnProxySettings): Record<string, string> {
  if (!settings.enabled) return {};

  const env: Record<string, string> = {};

  if (settings.proxyType === 'socks5') {
    const socksUrl = buildProxyUrl(settings);
    if (socksUrl) {
      env.SOCKS5_PROXY = socksUrl;
      env.ALL_PROXY = socksUrl;
    }
  } else {
    const httpUrl = buildProxyUrl(settings);
    if (httpUrl) {
      env.HTTP_PROXY = httpUrl;
      env.HTTPS_PROXY = httpUrl;
      env.http_proxy = httpUrl;
      env.https_proxy = httpUrl;
    }
  }

  // No proxy for local addresses
  env.NO_PROXY = 'localhost,127.0.0.1,::1,*.local';
  env.no_proxy = 'localhost,127.0.0.1,::1,*.local';

  return env;
}

/**
 * Log proxy status (but never log credentials).
 */
export function logProxyStatus(settings: VpnProxySettings): void {
  if (!settings.enabled) {
    logger.info('Proxy/VPN is disabled. All connections are direct.', { label: 'VPN' });
    return;
  }

  const type = settings.proxyType === 'socks5' ? 'SOCKS5' : 'HTTP(S)';
  logger.info(`VPN/Proxy enabled: ${type} proxy at ${settings.hostname}:${settings.port}`, {
    label: 'VPN',
    useSsl: settings.useSsl,
    proxyType: settings.proxyType || 'http',
  });
}
