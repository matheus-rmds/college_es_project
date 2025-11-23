// src/services/api.js
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function getToken() {
  return localStorage.getItem('access_token');
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  const contentType = res.headers.get('content-type');
  const json = contentType && contentType.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    const message = json && json.error ? json.error : `HTTP error ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return handleResponse(res);
}

export async function register(payload) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function listClasses() {
  const res = await fetch(`${API_BASE}/api/classes`, {
    method: 'GET',
    headers: { ...getAuthHeaders() }
  });
  return handleResponse(res);
}

export async function listSubjects() {
  const res = await fetch(`${API_BASE}/api/subjects`, {
    method: 'GET',
    headers: { ...getAuthHeaders() }
  });
  return handleResponse(res);
}

export async function listStudents() {
  const res = await fetch(`${API_BASE}/api/students`, {
    method: 'GET',
    headers: { ...getAuthHeaders() }
  });
  return handleResponse(res);
}

export async function listScores() {
  const res = await fetch(`${API_BASE}/api/scores`, {
    method: 'GET',
    headers: { ...getAuthHeaders() }
  });
  return handleResponse(res);
}

// Atualizar notas (PATCH) - para professores/admin (não usado pelo admin-read-only view)
export async function updateScores(studentId, subject, scores) {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
  const res = await fetch(`${API_BASE}/api/scores/${studentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ subject, scores })
  });
  return handleResponse(res);
}
