function sanitizeErrorMessage(raw, fallback = 'An unexpected error occurred') {
  if (!raw || typeof raw !== 'string') return fallback;
  const stripped = raw.replace(/<[^>]*>/g, '').trim();
  if (!stripped) return fallback;
  return stripped.length > 200 ? `${stripped.slice(0, 200)}…` : stripped;
}

function getToken() { return localStorage.getItem('crm_token'); }
export function setToken(t) { localStorage.setItem('crm_token', t); }
export function setRefreshToken(t) { localStorage.setItem('crm_refresh', t); }
function getRefreshToken() { return localStorage.getItem('crm_refresh'); }
export function clearTokens() {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_refresh');
}

export function upload(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }
    xhr.addEventListener('load', () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(sanitizeErrorMessage(data.error?.message, `Upload failed (${xhr.status})`)));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.send(formData);
  });
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res = await fetch(path, opts);

  if (res.status === 401) {
    const rt = getRefreshToken();
    if (rt) {
      const rRes = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (rRes.ok) {
        const { data } = await rRes.json();
        setToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        res = await fetch(path, { ...opts, headers });
      } else {
        clearTokens();
        window.location.replace('/login');
        throw new Error('Session expired');
      }
    } else {
      clearTokens();
      window.location.replace('/login');
      throw new Error('Unauthorized');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(sanitizeErrorMessage(data.error?.message, `Request failed (${res.status})`));
    e.status = res.status;
    throw e;
  }
  return data;
}

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
};

export default api;
