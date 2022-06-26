import { achievementsMap } from '../utils/common.js';
import { NO_INSTALLATION, renderStatistics } from './statistics.js';

export function install(app) {
  // #成就查询xxx
  // 可以模糊搜索成就
  app.register(/^#成就(查询|搜索|查找)(.*)$/, achSearch);
}

/** 模糊搜索成就 */
export async function achSearch(e, c, reg) {
  let match = e.msg.match(reg)
  let keyword = (match[2] || '').trim()
  if (!keyword) {
    e.replyAt(`请输入要查询的关键词，如：#成就查询食神`);
    return true;
  }
  let list = []
  for (const achItem of achievementsMap.values()) {
    // 过滤未实装的成就
    if (NO_INSTALLATION.includes(achItem.id)) continue;
    if (achItem.name.includes(keyword)) {
      list.push(achItem)
    }
  }
  if (list.length === 0) {
    e.replyAt(`没有找到“${keyword}”相关成就`);
    return true;
  }
  let img = await renderStatistics('-', e, c, list, {
    showTopInfo: false,
  })
  if (img) {
    e.replyAt([`查询到了以下成就：\n`, img]);
  } else {
    e.replyAt(`查询到了以下成就：\n${list.map(i => `${i.id} ${i.name}`).join('\n')}`);
  }
  return true;
}