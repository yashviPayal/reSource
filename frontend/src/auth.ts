const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')

export const authConfigured = true

export type AppUser = { userId: string; username: string; email?: string }

export async function currentAppUser(): Promise<AppUser | null> {
  const token = authToken()
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
      return null
    }

    const data = await response.json()
    if (data.user) {
      localStorage.setItem('auth_user', JSON.stringify(data.user))
      return {
        userId: String(data.user.id),
        username: data.user.name || data.user.email?.split('@')[0] || 'User',
        email: data.user.email,
      }
    }
    return null
  } catch {
    const cached = localStorage.getItem('auth_user')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        return {
          userId: String(parsed.id),
          username: parsed.name,
          email: parsed.email,
        }
      } catch {
        return null
      }
    }
    return null
  }
}

export function authToken(): string | null {
  try {
    return localStorage.getItem('auth_token')
  } catch {
    return null
  }
}

export async function registerUser(email: string, password: string, name: string) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed.')
  }

  if (data.token) {
    localStorage.setItem('auth_token', data.token)
  }
  if (data.user) {
    localStorage.setItem('auth_user', JSON.stringify(data.user))
  }

  return {
    isSignUpComplete: true,
    nextStep: { signUpStep: 'DONE' as 'DONE' | 'CONFIRM_SIGN_UP' },
    user: data.user,
  }
}

export async function confirmUser(_email: string, _code: string) {
  return { isSignUpComplete: true, nextStep: { signUpStep: 'DONE' as 'DONE' | 'CONFIRM_SIGN_UP' } }
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Invalid email or password.')
  }

  if (data.token) {
    localStorage.setItem('auth_token', data.token)
  }
  if (data.user) {
    localStorage.setItem('auth_user', JSON.stringify(data.user))
  }

  return {
    isSignedIn: true,
    nextStep: { signInStep: 'DONE' as 'DONE' | 'CONFIRM_SIGN_UP' },
    user: data.user,
  }
}

export async function logoutUser() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Ignore network error on logout
  } finally {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }
}
