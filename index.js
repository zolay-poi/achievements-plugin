import { isV2 } from './version/getVersion.js';

const apps = {};
const rule = {};

let v2, v3;

if (isV2) {
  // 2.x 版本
  v2 = await import(`./version/2x.js`);
  Object.assign(rule, v2.rule);
} else {
  // 3.x 版本
  v3 = await import(`./version/3x.js`);
  Object.assign(apps, v3);
}

/**
 * v2 的方法，要显式定义并导出，所以这里写一个中转方法，v3中不处理，v2中中转
 * 也就是说如果你的插件导出的方法很多的话，每个都需要中转一下~
 * @param fnName 方法名
 */
function bindV2Func(fnName) {
  if (!v2) return;
  let fn = v2[fnName];
  if (typeof fn === 'function') {
    return function(...args) {
      return fn(...args);
    };
  }
}

// 使用方式参考此处：
export const achRouter = bindV2Func('achRouter');
export const waitInputCheck = bindV2Func('waitInputCheck');

export { apps, rule };
