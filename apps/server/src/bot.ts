import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";

const bot = new Bot(config.botToken);

bot.use(async (ctx, next) => {
  const user = ctx.from ? `${ctx.from.id} (@${ctx.from.username ?? "no-username"})` : "unknown";
  const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? ctx.message?.web_app_data?.data ?? "update";
  console.log(`[bot] ${user}: ${text}`);
  await next();
});

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard().webApp("Открыть город", config.clientUrl);
  await ctx.reply("Город готов. Открой Mini App и выбери локацию.", { reply_markup: keyboard });
});

bot.catch((err) => {
  console.error("Bot error", err);
});


bot.start({
  onStart: (info) => {
    console.log(`MMOBot Telegram bot started as @${info.username}`);
  }
});
