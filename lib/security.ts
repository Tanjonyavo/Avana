export function serializeJsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isSafeSitePathOrHttpsUrl(value: string) {
  return (
    (/^\/(?!\/)[^\u0000-\u001f\u007f\\]*$/.test(value) && !value.includes("..")) || isSafeHttpsUrl(value)
  );
}
