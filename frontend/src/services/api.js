const configuredApiBase = import.meta.env.VITE_API_BASE ?? '/api';
const API_BASE =
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  typeof configuredApiBase === 'string' &&
  configuredApiBase.startsWith('http://')
    ? '/api'
    : configuredApiBase;

async function request(path, method = 'GET', body) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? 'Erro ao se comunicar com o servidor');
  }

  return response.json();
}

export function getConfiguration() {
  return request('configuration');
}

export function saveConfiguration(values) {
  return request('configuration', 'POST', values);
}

export function generateCodes(quantity, configurationId) {
  return request('codes', 'POST', { quantity, configuration_id: configurationId });
}

export function resetCodes(configurationId, quantity) {
  return request('codes/reset', 'POST', {
    configuration_id: configurationId,
    quantity,
  });
}

export function listCodes(configurationId) {
  const query = configurationId ? `?configuration_id=${configurationId}` : '';
  return request(`codes${query}`);
}

export function getPlaySummary() {
  return request('play/summary');
}

export function popBalloon() {
  return request('play/pop', 'POST');
}

export function validateCode(code) {
  return request('codes/validate', 'POST', { code });
}

export function checkToken(code) {
  return request('codes/check', 'POST', { code });
}
