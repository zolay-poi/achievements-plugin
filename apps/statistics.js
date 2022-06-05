// 成就统计
import path from 'path';
import fs from 'fs';
import Page from '../utils/Page.js';
import {Data, _paths, getMysApi, achievementsMap} from '../utils/common.js';
import {segment} from 'oicq';

export async function actStatistics(e, {render}) {
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.replyAt('请先绑定uid');
    return true;
  }
  let res = await MysApi.getIndex();
  if (!res) return true;
  let {achievement_number} = res.stats;

  let userJsonName = `${uid}.json`;
  let userJsonFile = path.join(_paths.userDataPath, userJsonName);
  let noImportHelp = '你尚未录入任何成就，无法查看成就统计，请发送“#成就帮助”来查看录入方法';
  if (!fs.existsSync(userJsonFile)) {
    e.replyAt(noImportHelp);
    return true;
  }
  let saveData = Data.readJSON(_paths.userDataPath, userJsonName);
  if (!saveData || !saveData.wonders_of_the_world) {
    e.replyAt(noImportHelp);
    return true;
  }
  // 目前仅支持【天地万象】
  let doneList = saveData.wonders_of_the_world;
  if (doneList.length === 0) {
    e.replyAt(noImportHelp);
    return true;
  }
  // 过滤测试数据
  let filters = [84027];
  // 遍历未完成的成就
  let list = [];
  for (const [id, achievement] of achievementsMap.entries()) {
    if (filters.includes(id)) continue;
    if (achievement.preStage != null) continue;
    if (doneList.findIndex(i => i.id === achievement.id) === -1) {
      list.push(achievement);
    }
  }
  let pageNum = 1;
  let page = new Page(list, pageNum, 30);
  let patten = /.+[^\d](\d+)$/;
  if (patten.test(e.msg)) {
    pageNum = Number.parseInt(e.msg.match(patten)[1]);
    if (pageNum < 1) {
      page.pageNum = 1;
    } else if (pageNum > page.maxNum) {
      page.pageNum = page.maxNum;
    } else {
      page.pageNum = pageNum;
    }
  }
  if (page.records.length === 0) {
    e.replyAt('恭喜你已经完成了「天地万象」中所有的成就了！');
    return true;
  }
  // 算出内容区域高度
  let topHeight = 202;
  let bottomHeight = 228;
  let middleHeight = (Math.round(116.8 * page.records.length) + 150) - (topHeight + bottomHeight);
  let base64 = await render('statistics', {
    save_id: uid,
    page,
    middleHeight: middleHeight < 0 ? 0 : middleHeight,
    uid,
    user_id: e.user_id,
    achievement_number,
    name: e.sender.card.replace(uid, '').trim(),
    pageInfo: `第 ${page.pageNum} / ${page.maxNum} 页`,
  });
  if (base64) {
    e.replyAt([
      `\n在「天地万象」中你还有 ${page.total} 个成就未完成，详情见下图`,
      segment.image(`base64://${base64}`),
    ]);
  } else {
    e.replyAt('图片渲染失败……');
  }
  return true;
}
