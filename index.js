import fs from 'fs';
import apps from './apps/index.js';
import { _version, _paths, loadAchievements, replyAt } from "./utils/common.js";
import common from '../../lib/common.js';

export const rule = {
  achRouter: {
    reg: '^#成就.+$',
    priority: 100,
    describe: '成就查漏功能',
    hashMark: true,
  },
  // 用于检测用户上传的图片、视频
  achImportCheck: {
    reg: '',
    priority: 0,
    describe: '成就查漏功能',
  },
};

const actionsMap = new Map();
// #成就插件配置
// 主人命令
actionsMap.set(/^#成就配置/, bind(apps.settings.settingsRouter));
// #成就录入
// 需要发送图片或者视频
actionsMap.set(/^#成就(录入|识别|扫描|记录)/, bind(apps.import.achImport));
// #成就查漏
// 可以根据已经识别的成就生成未完成的成就列表
actionsMap.set(/^#成就(查漏|统计)/, bind(apps.statistics.actStatistics));
// #成就帮助
actionsMap.set(/^#成就(帮助|help)/, bind(apps.other.help));
// #成就插件更新
// #成就插件强制更新
// 主人命令
actionsMap.set(/^#成就插件更新$/, bind(apps.other.updateWithGit));

// 路由
export function achRouter(e, components) {
  for (const [reg, func] of actionsMap.entries()) {
    if (reg.test(e.msg)) {
      return func(e, components, reg);
    }
  }
}

export const achImportCheck = bind(importApp.achImportCheck);

function bind(fn) {
  return function (e, components) {
    e.replyAt = (...args) => replyAt(e, ...args);
    let render = components.render;
    components.render = (...args) => render('template', ...args);
    return fn(e, components);
  };
}

function init() {
  // 初始化目录
  if (!fs.existsSync(_paths.userDataPath)) {
    fs.mkdirSync(_paths.userDataPath);
  }
  // 初始化全成就列表
  loadAchievements(true);

  console.log(`成就查漏插件${_version}初始化完成~`);

  setTimeout(async function () {
    let msgStr = await redis.get("zolay:restart-msg");
    if (msgStr) {
      let msg = JSON.parse(msgStr);
      await common.relpyPrivate(msg.qq, msg.msg);
      await redis.del("zolay:restart-msg");
      let msgs = [`当前插件版本: ${_version}`];
      await common.relpyPrivate(msg.qq, msgs.join("\n"));
    }
  }, 1000);
}

init();
