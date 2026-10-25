import type { Role } from '../types'

const key = 'supplylink.navigation-role'
const roles: Role[] = ['admin', 'distributor', 'retailer', 'delivery']

// Presentation hint only: never restores authentication, permissions, or page data.
export function readNavigationRole(): Role | null {
  try {
    const value = window.sessionStorage.getItem(key)
    return roles.includes(value as Role) ? value as Role : null
  } catch {
    return null
  }
}

export function saveNavigationRole(role: Role | null) {
  try {
    if (role) window.sessionStorage.setItem(key, role)
    else window.sessionStorage.removeItem(key)
  } catch {
    // Storage restrictions must not prevent sign-in or sign-out.
  }
}
