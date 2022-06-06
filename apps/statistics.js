import path from 'path';
import fs from 'fs';
import Page from '../utils/Page.js';
import {Data, _paths, getMysApi, achievementsMap, readUserJson} from '../utils/common.js';
import {segment} from 'oicq';

// 成就查漏功能
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
  let {saveData} = readUserJson(userJsonName)
  // 目前仅支持【天地万象】
  let doneList = saveData.wonders_of_the_world;
  if (doneList.length === 0) {
    e.replyAt('你尚未录入任何成就，无法使用成就查漏功能，请发送“#成就帮助”来查看录入方法');
    return true;
  }
  // 遍历未完成的成就
  let list = [];
  for (const [id, achievement] of achievementsMap.entries()) {
    // 过滤未实装的成就
    if (NO_INSTALLATION.includes(id)) continue;
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
      `在「天地万象」中你还有 ${page.total} 个成就未完成，详情见下图`,
      segment.image(`base64://${base64}`),
    ]);
  } else {
    e.replyAt('图片渲染失败……');
  }
  return true;
}

/** 未实装的成就列表 */
const NO_INSTALLATION = [
  // 测试数据
  84027,
  // 绀田祟神
  81101,
  // 在提瓦特寻求昭和七四式是不是搞错了什么？
  81102,
  // 狸猫的报恩
  81103,
  // 丽影萍踪
  81107,
  // 「第七个武士」
  81110,
  // 谁打碎了我的陶罐
  81126,
  // 戳穿绀田传助的谎言
  81127,
  // 她的愿望
  81128,
  // 为了未来的鸣神…
  81129,
  // 「我有金钟罩♬」
  82016,
  // 善事有善报
  84517,
  // 未曾设想的味道
  84521,
];
