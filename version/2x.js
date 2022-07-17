import { init, achRouter, waitInputCheck } from './common.js';

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

// 路由
export {
  achRouter,
  waitInputCheck,
};

init();
