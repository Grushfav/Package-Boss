/** Focus a text input and try to open the on-screen keyboard (mobile / tablet). */
export function focusInputForSoftKeyboard(input: HTMLInputElement | null) {
  if (!input) return

  input.readOnly = false
  input.removeAttribute('readonly')
  input.disabled = false

  // iOS often suppresses the virtual keyboard when a hardware keyboard is connected.
  // Focusing a temporary input in the same user gesture can force the soft keyboard.
  const tmp = document.createElement('input')
  tmp.setAttribute('type', 'text')
  tmp.setAttribute('inputmode', 'text')
  tmp.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;margin:0;'
  document.body.appendChild(tmp)
  tmp.focus()
  document.body.removeChild(tmp)

  input.focus({ preventScroll: false })

  try {
    const len = input.value.length
    input.setSelectionRange(len, len)
  } catch {
    /* setSelectionRange not supported for all input types */
  }
}
