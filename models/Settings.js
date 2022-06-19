import fs from "fs";
import lodash from "lodash";
import {_paths} from "../utils/common.js";

/** 配置类 */
export default class Settings {

  constructor() {
    this.$source = this.read();
  }

  get importMethod() {
    return this.get("importMethod");
  }

  get(path) {
    return lodash.get(this.$source, path);
  }

  set(path, value) {
    return lodash.set(this.$source, path, value);
  }

  setAndSave(path, value) {
    this.set(path, value);
    this.save();
  }

  getText(path) {
    return lodash.get(SETTINGS_TEXT, path) || path;
  }

  // 通过 text 获取 key
  getKeyByText(text) {
    let res = null;
    let fn = (obj, keys) => {
      for (const [key, value] of Object.entries(obj)) {
        let tempKey = keys.concat(key);
        if (lodash.isObject(value)) {
          fn(value, tempKey);
        }
        if (value === text) {
          res = tempKey.join(".");
        }
        if (res) {
          break;
        }
      }
    };
    fn(SETTINGS_TEXT, []);
    return res;
  }

  /** 读取配置 */
  read() {
    if (!fs.existsSync(_paths.settingsPath)) {
      initSettingsJson();
    }
    let text = fs.readFileSync(_paths.settingsPath, "utf8");
    let json = JSON.parse(text);
    return lodash.merge({}, DEFAULT_SETTINGS, json);
  }

  save() {
    saveSettings(this.$source);
  }

}

const DEFAULT_SETTINGS = {
  importMethod: {
    video: false,
    image: true,
    cocoGoat: true,
    input: true,
  },
};

const SETTINGS_TEXT = {
  importMethod: {
    video: "录屏",
    image: "截图",
    cocoGoat: "椰羊",
    input: "手动",
  },
};

function initSettingsJson() {
  saveSettings(DEFAULT_SETTINGS);
}

function saveSettings(settings) {
  fs.writeFileSync(_paths.settingsPath, JSON.stringify(settings, null, 2));
}
