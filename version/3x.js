import { init, achRouter, waitInputCheck } from './common.js';

// plugin 是全局对象，不用单独引用
export class AchievementsPlugin extends plugin {
  constructor() {
    super({
      name: '成就查漏',
      dsc: '提供成就查漏、搜索、统计等功能',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#成就.+$',
          fnc: 'achRouter',
        },
      ],
    });
  }

  async achRouter(e) {
    let ret = await achRouter(e, {});
    if (ret) {
      // 返回任意，代表跳出循环（相当于2.x的return true）
      return ret;
    }
    // 返回false代表继续循环
    return false;
  }

  // 此方法不经过正则校验，每次收到消息都会调用
  async accept(...args) {
    let ret = await waitInputCheck(...args);
    return ret ? ret : false;
  }

}

init();