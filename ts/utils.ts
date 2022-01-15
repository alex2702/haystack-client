export function setCookie(name: string, val: string) {
  localStorage.setItem(name, val);
}

export function getCookie(name: string) {
  return localStorage.getItem(name);
}