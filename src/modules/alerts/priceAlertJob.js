export function startPriceAlertJob({ alertService, cadenceMs }) {
  let running = false;

  async function tick() {
    if (running) {
      return;
    }

    running = true;

    try {
      await alertService.runDueAlerts();
    } catch {
      // Erros publicos ficam salvos no alerta; o job nao deve vazar dados em log.
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, cadenceMs);
  timer.unref?.();
  void tick();

  return {
    stop() {
      clearInterval(timer);
    }
  };
}
