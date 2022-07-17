import fs from 'fs';
import path from 'path';
import { segment } from 'oicq';
import Page from '../models/Page.js';
import { _paths, achievementsMap, getMysApi, readUserJson } from '../utils/common.js';
import { waitInputAt } from '../utils/waitInput.js';
import { dynamicImport, isV2 } from '../version/getVersion.js';

const { default: MysInfo } = await dynamicImport('', '../../genshin/model/mys/mysInfo.js');

export function install(app) {
  // #成就查漏
  // 可以根据已经识别的成就生成未完成的成就列表
  app.register(/^#成就(查漏|统计)/, actStatistics);
  // #成就重置
  // 强制重置自己的成就
  app.register(/^#成就(重置|重新配置|清空)$/, achReset);
}

// 成就查漏功能
export async function actStatistics(e, c) {
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.replyAt('请先绑定uid');
    return true;
  }
  // 【兼容写法】
  let res;
  if (isV2) {
    res = await MysApi.getIndex();
  } else {
    res = await MysInfo.get(e, 'index');
    if (res) res = res.data;
  }
  if (!res) return true;
  let { achievement_number } = res.stats;

  let userJsonName = `${uid}.json`;
  let { saveData } = readUserJson(userJsonName);
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
  if (list.length === 0) {
    e.replyAt('恭喜你已经完成了「天地万象」中所有的成就了！');
    return true;
  }
  let img = await renderStatistics(uid, e, c, list, {
    achievement_number,
  });
  if (img) {
    e.replyAt([`在「天地万象」中你还有 ${list.length} 个成就未完成，详情见下图`, img]);
  } else {
    e.replyAt('图片渲染失败……');
  }
  return true;
}

export async function renderStatistics(uid, e, { render }, list, renderOptions) {
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
  // 算出内容区域高度
  let topHeight = 202;
  let bottomHeight = 228;
  let middleHeight = (Math.round(116.8 * page.records.length) + 150) - (topHeight + bottomHeight);
  let img = await render('statistics', {
    save_id: uid,
    page,
    middleHeight: middleHeight < 0 ? 0 : middleHeight,
    uid,
    user_id: e.user_id,
    name: e.sender.card.replace(uid, '').trim(),
    pageInfo: `第 ${page.pageNum} / ${page.maxNum} 页`,
    // 是否显示顶部的成就数量
    showTopInfo: true,
    ...renderOptions,
  });
  if (img) {
    return img;
  } else {
    e.replyAt('图片渲染失败……');
    return null;
  }
}

/** 未实装的成就列表 */
export const NO_INSTALLATION = [
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

export async function achReset(e) {
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.replyAt('请先绑定uid');
    return true;
  }
  waitInputAt(e, {
    key: `ach-reset-${e.user_id}`,
    message: `确定要清空你录入的所有成就吗？此操作不可逆，请谨慎操作！\n请发送“确定”继续，或者发送其他任意内容取消。`,
    timeout: 12000,
    checkFn: (e) => {
      if (/^(确定|是|[Yy](es)?)$/.test((e.msg || '').trim())) {
        let userJsonFile = path.join(_paths.userDataPath, `${uid}.json`);
        if (fs.existsSync(userJsonFile)) {
          fs.unlinkSync(userJsonFile);
        }
        e.replyAt('已成功清空所有录入的成就');
      } else {
        e.replyAt('已取消重置');
      }
      return true;
    },
    timeoutCb: () => e.replyAt('输入超时，请重试。'),
  });
  return true;
}
