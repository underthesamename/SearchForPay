export function createHealthPayload({ providerRegistry, env, alertJob }) {
  return {
    ok: true,
    searchMode: env.searchMode,
    openaiWebSearch: {
      enabled: env.providerOptions.openaiweb.enabled,
      disabledReason: env.providerOptions.openaiweb.enabled ? undefined : env.providerOptions.openaiweb.disabledReason
    },
    configuredProviders: providerRegistry.getConfiguredProviderNames(),
    enabledProviders: providerRegistry.getEnabledProviderNames(),
    unknownProviders: providerRegistry.getUnknownProviders(),
    disabledProviders: providerRegistry.getDisabledProviders?.() || [],
    priceAlerts: {
      enabled: env.priceAlertsEnabled,
      jobRunning: Boolean(alertJob),
      recheckIntervalMs: env.priceAlertRecheckIntervalMs
    }
  };
}
