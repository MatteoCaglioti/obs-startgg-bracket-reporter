import fs from "fs";
import path from "path";

declare global {
  namespace NodeJS {
    interface Process {
      pkg?: any;
    }
  }
}

const appDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
const configPath = path.join(appDir, "config.json");

type AppConfig = {
  STARTGG_API_TOKEN?: string;
};

export function readConfig(): AppConfig {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ STARTGG_API_KEY: "" }, null, 2),
    );
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

export function saveConfig(config: AppConfig) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function getStartggApiKey() {
  const config = readConfig();

  return (
    process.env.STARTGG_API_TOKEN ||
    config.STARTGG_API_TOKEN ||
    ""
  );
}
