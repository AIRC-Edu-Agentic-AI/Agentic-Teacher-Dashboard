let _getAccessToken: (() => Promise<string>) | null = null

export function setAccessTokenGetter(fn: () => Promise<string>) {
  _getAccessToken = fn
}

export async function getAccessToken(): Promise<string> {
  if (!_getAccessToken) throw new Error('Auth not initialized')
  return _getAccessToken()
}