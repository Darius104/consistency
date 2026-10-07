/** True inside the iPhone/iPad app (WKWebView reports an iOS user agent;
 *  iPadOS can pose as a Mac, so touch support settles that case). */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
