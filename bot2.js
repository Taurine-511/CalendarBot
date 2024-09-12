const { ActivityHandler, MessageFactory } = require('botbuilder');

const botName = process.env.BotName;

class EchoBot extends ActivityHandler {
    constructor() {
        super();
        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            context.activity.text = context.activity.text.replace(botName, '');
            const replyTextList = [
                "1.お寿司",
                "2.ラーメン",
                "3.ピザ",
                "4.ハンバーガー",
                "5.幻のカレー",
            ];
            const replyText = replyTextList[Math.floor(Math.random() * replyTextList.length)];
            await context.sendActivity(MessageFactory.text(replyText, replyText));
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = '今日の夕飯を決めてやる! 以下から選ぶぞ! \n1. お寿司 \n2. ラーメン \n3. ピザ \n4. ハンバーガー \n5. 幻のカレー';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.EchoBot = EchoBot;