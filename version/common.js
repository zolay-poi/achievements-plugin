import fs from 'fs';
import { segment } from 'oicq';
import { _paths, _version, loadAchievements, replyAt } from '../utils/common.js';
import { dynamicImport, isV2 } from './getVersion.js';

import * as otherApp from '../apps/other.js';
import * as importApp from '../apps/import.js';
import * as statisticsApp from '../apps/statistics.js';
import * as settingsApp from '../apps/settings.js';
import * as searchApp from '../apps/search.js';
import path from 'path';

const common = await dynamicImport('../../../lib/common.js', '../../../lib/common/common.js');
const { default: Puppeteer } = await dynamicImport('', '../../../lib/puppeteer/puppeteer.js');

const actionsMap = new Map();
use(settingsApp);
use(otherApp);
use(importApp);
use(statisticsApp);
use(searchApp);

export function use(app) {
  if (typeof app.install === 'function') {
    let register = (reg, func, options) => {
      actionsMap.set(reg, bind(func, options));
    };
    app.install({ register });
  } else {
    throw 'app.install is not a function';
  }
}

/** 路由 */
export function achRouter(e, components) {
  for (const [reg, func] of actionsMap.entries()) {
    if (reg.test(e.msg)) {
      return func(e, components, reg);
    }
  }
}

export const waitInputCheck = bind(otherApp.waitInputCheck);

export function bind(fn, options = {}) {
  if (isV2) {
    return v2Bind(fn, options);
  }
  return v3Bind(fn, options);
}

// 兼容v2
function v2Bind(fn, options = {}) {
  return function (e, components, ...args) {
    if (options.isMaster && !e.isMaster) return;
    e.replyAt = (...args) => replyAt(e, ...args);
    let render = components.render;
    components.render = async (...args) => {
      let base64 = await render('template', ...args);
      // 这里统一一下新版v3的写法
      if (base64) {
        return segment.image(`base64://${base64}`);
      }
    };
    return fn(e, components, ...args);
  };
}

// 兼容v3
function v3Bind(fn, options = {}) {
  return function (e, components = {}, ...args) {
    if (options.isMaster && !e.isMaster) return;
    e.replyAt = (...args) => replyAt(e, ...args);
    components.render = (name, data = {}) => Puppeteer.screenshot(name, {
      // v3渲染图片必须要写这些参数
      // 模板路径
      tplFile: path.join(_paths.templatePath, `${name}.html`),
      // 绝对路径
      pluResPath: _paths.resourcesPath,
      // 【兼容】v2
      _res_path: _paths.resourcesPath,
      ...data,
    });
    return fn(e, components, ...args);
  };
}

export function init() {
  // 初始化目录
  if (!fs.existsSync(_paths.userDataPath)) {
    fs.mkdirSync(_paths.userDataPath);
  }
  // 初始化全成就列表
  loadAchievements(true);

  console.log(`成就查漏插件${_version}初始化完成~`);

  setTimeout(async function () {
    let msgStr = await redis.get('zolay:restart-msg');
    if (msgStr) {
      let msg = JSON.parse(msgStr);
      await common.relpyPrivate(msg.qq, msg.msg);
      await redis.del('zolay:restart-msg');
      let msgs = [`当前插件版本: ${_version}`];
      await common.relpyPrivate(msg.qq, msgs.join('\n'));
    }
  }, 1000);
}
