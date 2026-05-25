/** @internal Implementation detail for `adb shell input text`. */
export function escapeAdbText(text: string): string {
  return text
    .replace(/[&|;<>()$`\\"]/g, " ")
    .trim()
    .replace(/\s+/g, "%s");
}
