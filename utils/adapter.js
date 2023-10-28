const weChatFileRegex = /file\.wx2\.qq\.com.*?&filename=([^&]*)/

export function isWeChatFile(url) {
  return weChatFileRegex.test(url)
}

/**
 * 获取文件名
 * @param fileUrl
 * @return {string|null}
 */
export function matchFilename(fileUrl) {
  let match = fileUrl.match(weChatFileRegex);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}
