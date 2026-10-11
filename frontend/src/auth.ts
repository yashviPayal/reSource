import { Amplify } from 'aws-amplify'
import { confirmSignUp, fetchAuthSession, fetchUserAttributes, getCurrentUser, signIn, signOut, signUp } from 'aws-amplify/auth'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined

export const authConfigured = Boolean(userPoolId && userPoolClientId)

if (authConfigured) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId!,
        userPoolClientId: userPoolClientId!,
        loginWith: { email: true },
        signUpVerificationMethod: 'code',
      },
    },
  })
}

export type AppUser = { userId: string; username: string; email?: string }

export async function currentAppUser(): Promise<AppUser | null> {
  if (!authConfigured) return null
  try {
    const user = await getCurrentUser()
    let displayName = user.username
    let email = ''
    try {
      const attrs = await fetchUserAttributes()
      if (attrs.name && attrs.name.trim()) {
        displayName = attrs.name.trim()
      } else if (attrs.email) {
        displayName = attrs.email.split('@')[0]
      }
      if (attrs.email) {
        email = attrs.email.trim()
      }
    } catch {
      // Fallback to user.username if attributes fetch fails
    }
    return { userId: user.userId, username: displayName, email }
  } catch {
    return null
  }
}

export async function authToken(): Promise<string | null> {
  if (!authConfigured) return null
  try {
    const session = await fetchAuthSession()
    return session.tokens?.accessToken?.toString() ?? null
  } catch {
    return null
  }
}

export async function registerUser(email: string, password: string, name: string) {
  return signUp({
    username: email.trim().toLowerCase(),
    password,
    options: { userAttributes: { email: email.trim().toLowerCase(), name: name.trim() } },
  })
}

export async function confirmUser(email: string, code: string) {
  return confirmSignUp({ username: email.trim().toLowerCase(), confirmationCode: code.trim() })
}

export async function loginUser(email: string, password: string) {
  return signIn({ username: email.trim().toLowerCase(), password })
}

export async function logoutUser() {
  if (authConfigured) await signOut()
}
