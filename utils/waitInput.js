import { autoAt } from './common.js';

export const waitMap = new Map();

/**
 * 异步等待用户输入内容
 * @param e
 * @param key 标识符
 * @param checkFn 检查函数，也可以是regExp
 * @param timeout 超时时间，默认为10秒
 * @param message 提示信息
 * @param successCb 成功回调，只有当checkFn为regExp时才会调用
 * @param timeoutCb 超时回调，等待超时后会调用
 */
export function waitInput(e, { key, checkFn, timeout = 10000, message = ["请输入"], successCb, timeoutCb }) {
  let wait = waitMap.get(key);
  if (wait) {
    clearTimeout(wait.timer);
  }
  wait = {
    checkFn,
    timer: setTimeout(() => {
      waitMap.delete(key);
      timeoutCb && timeoutCb();
    }, timeout),
    successCb,
  }
  waitMap.set(key, wait);
  return e.reply(message);
}

export function waitInputAt(e, opt) {
  if (opt.message) {
    if (!Array.isArray(opt.message)) {
      opt.message = [opt.message];
    }
    opt.message.unshift(autoAt(e));
  }
  return waitInput(e, opt);
}
