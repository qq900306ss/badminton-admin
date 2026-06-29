// Detect Meta / LINE / WeChat in-app webviews (Threads, IG, FB, Messenger, LINE…).
// Google OAuth refuses to run in these ("disallowed_useragent", 403), so we warn
// the user to reopen the page in a real browser (Safari / Chrome) before login.
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|FB_IAB|Instagram|Threads|Barcelona|Line\/|Messenger|MicroMessenger/i.test(ua)
}
