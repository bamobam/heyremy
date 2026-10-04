const pad = (n: number) => String(n).padStart(2, '0')

/** File name for a saved hat cam photo, e.g. hatcam-20261004-130509.jpg. Sorts in the order taken. */
export function grabFileName(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `hatcam-${day}-${time}.jpg`
}
