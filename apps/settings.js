import { waitInputAt } from '../utils/waitInput.js';
import { _version, settings } from "../utils/common.js";

export function install(app) {
  app.register(/^#成就配置$/, getSettings, { isMaster: true });
  app.register(/^#成就配置录入(启用|禁用)(.+)$/, updateImportMethod, { isMaster: true });
}

function getSettings(e) {
  let msg = [];
  msg.push(`欢迎使用成绩查漏插件${_version}\n`);
  msg.push("当前配置如下：");
  msg.push("- 成就录入方式：");
  for (const [key, value] of Object.entries(settings.importMethod.value)) {
    let text = settings.getText(`importMethod.${key}`);
    msg.push(`  - ${text}：${value ? "已启用" : "已禁用"}`);
  }
  msg.push(`\n你可以使用“#成就配置录入[启用|禁用][方式]”来开关成就录入方式。\n例：#成就配置录入启用录屏`);
  e.reply(msg.join("\n"));
  return true;
}

function updateImportMethod(e, c, reg) {
  let [, action, method] = e.msg.match(reg);
  let key = settings.getPathByText(method);
  if (!key) {
    e.reply(`未知的成就录入方式：${method}`);
    return true;
  }
  settings.setAndSave(key, action === "启用");
  e.reply(`成就录入方式“${method}”已${action}`);
  return true;
}
