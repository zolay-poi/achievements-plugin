import fs from 'fs';
import { _version, _paths, loadAchievements, replyAt } from "./utils/common.js";
import common from '../../lib/common.js';

import * as otherApp from './apps/other.js';
import * as importApp from './apps/import.js';
import * as statisticsApp from './apps/statistics.js';
import * as settingsApp from './apps/settings.js';

export const rule = {
  achRouter: {
    reg: '^#成就.+$',
    priority: 100,
    describe: '成就查漏功能',
    hashMark: true,
  },
  // 用户输入检测
  waitInputCheck: { reg: '', priority: 0, describe: '' },
};

const actionsMap = new Map();

function use(app) {
  if (typeof app.install === 'function') {
    let register = (reg, func, options) => {
      actionsMap.set(reg, bind(func, options));
    }
    app.install({ register });
  } else {
    throw 'app.install is not a function';
  }
}

use(settingsApp);
use(otherApp);
use(importApp);
use(statisticsApp);

// 路由
export function achRouter(e, components) {
  for (const [reg, func] of actionsMap.entries()) {
    if (reg.test(e.msg)) {
      return func(e, components, reg);
    }
  }
}

export const waitInputCheck = bind(otherApp.waitInputCheck);

function bind(fn, options = {}) {
  return function (e, components, ...args) {
    if (options.isMaster && !e.isMaster) return;
    e.replyAt = (...args) => replyAt(e, ...args);
    let render = components.render;
    components.render = (...args) => render('template', ...args);
    return fn(e, components, ...args);
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
