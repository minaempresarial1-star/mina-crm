const API_URL = window.MINA_CRM_API_URL || '';
const API_KEY_STORAGE = 'mina-crm-api-key';
const ACTOR_STORAGE = 'mina-crm-actor';
const CACHE_STORAGE = 'mina-crm-last-snapshot';

export function getConnectionSettings() {
  return {
    configured: Boolean(API_URL),
    apiKey: localStorage.getItem(API_KEY_STORAGE) || '',
    actor: localStorage.getItem(ACTOR_STORAGE) || 'Alejandro'
  };
}

export function saveConnectionSettings({ apiKey, actor }) {
  localStorage.setItem(API_KEY_STORAGE, String(apiKey || '').trim());
  localStorage.setItem(ACTOR_STORAGE, actor || 'Alejandro');
}

export function clearConnectionSettings() {
  localStorage.removeItem(API_KEY_STORAGE);
}

async function blobPayload(blob) {
  if (!blob) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const [, data = ''] = String(dataUrl).split(',', 2);
  return { mimeType: blob.type || 'image/jpeg', data };
}

async function request(action, payload = {}) {
  const { apiKey, actor } = getConnectionSettings();
  if (!API_URL) throw new Error('La dirección de sincronización todavía no está configurada.');
  if (!apiKey) {
    const error = new Error('Ingresa la clave compartida para abrir el CRM.');
    error.code = 'CONNECTION_REQUIRED';
    throw error;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, apiKey, actor, ...payload })
  });
  if (!response.ok) throw new Error(`Google respondió con el estado ${response.status}.`);
  const result = await response.json();
  if (!result.ok) {
    const error = new Error(result.error || 'No fue posible sincronizar los datos.');
    error.code = result.code || 'SYNC_ERROR';
    throw error;
  }
  return result;
}

function cacheProspects(prospects) {
  localStorage.setItem(CACHE_STORAGE, JSON.stringify(prospects));
  return prospects;
}

function cachedProspects() {
  try { return JSON.parse(localStorage.getItem(CACHE_STORAGE) || '[]'); }
  catch { return []; }
}

export function createProspectStore() {
  return {
    async all({ allowCache = false } = {}) {
      try {
        const result = await request('list');
        return cacheProspects(result.prospects || []);
      } catch (error) {
        if (allowCache && error.code !== 'UNAUTHORIZED' && error.code !== 'CONNECTION_REQUIRED') {
          const cached = cachedProspects();
          if (cached.length) return cached;
        }
        throw error;
      }
    },

    async save(prospect) {
      const photo = prospect.photo instanceof Blob ? await blobPayload(prospect.photo) : null;
      const result = await request('save', { prospect: { ...prospect, photo } });
      return result.prospect;
    },

    async update(id, changes) {
      const current = (await this.all()).find(item => item.id === id);
      if (!current) throw new Error('Prospecto no encontrado');
      return this.save({ ...current, ...changes, id });
    },

    async remove(id) {
      await request('remove', { id });
      return id;
    },

    async photo(photoId) {
      if (!photoId) return null;
      const result = await request('photo', { photoId });
      if (!result.photo) return null;
      return `data:${result.photo.mimeType};base64,${result.photo.data}`;
    }
  };
}
