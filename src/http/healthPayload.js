export function createHealthPayload({ providerRegistry, env, alertJob }) {
  return {
    ok: true,
    configuredProviders: providerRegistry.getConfiguredProviderNames(),
    enabledProviders: providerRegistry.getEnabledProviderNames(),
    unknownProviders: providerRegistry.getUnknownProviders(),
    priceAlerts: {
      enabled: env.priceAlertsEnabled,
      jobRunning: Boolean(alertJob),
      recheckIntervalMs: env.priceAlertRecheckIntervalMs
    }
  };
}
