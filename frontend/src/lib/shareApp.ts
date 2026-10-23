export const APP_SHARE_TITLE = 'Package Boss'
export const APP_SHARE_TEXT =
  'Ship packages from Fort Lauderdale to Jamaica with Package Boss.'

/** Public sign-up page, so the link works for someone who is not signed in. */
export function appShareUrl() {
  return `${window.location.origin}/signup`
}

function copyWithSelection(url: string) {
  const input = document.createElement('textarea')
  input.value = url
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(input)
  return copied
}

export async function shareApp(): Promise<'shared' | 'copied'> {
  const url = appShareUrl()
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: APP_SHARE_TITLE, text: APP_SHARE_TEXT, url })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
    }
  }

  // Run before any await so the click is still allowed to write the clipboard.
  if (copyWithSelection(url)) return 'copied'

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
    return 'copied'
  }

  throw new Error('Could not copy the link')
}
